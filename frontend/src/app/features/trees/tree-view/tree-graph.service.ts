import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import type {
  Core, EdgeDefinition, EdgeSingular, NodeDefinition, NodeSingular, StylesheetStyle
} from 'cytoscape';
import { Person, Relationship } from '../../../core/api/api-client.service';
import { ThemeService } from '../../../core/theme/theme.service';
import {
  LAYOUT_VERSION, LineageIndex, SavedLayout,
  buildElements, indexLineage, isLayoutReusable, lineageOf
} from './tree-graph.model';

export type GraphLayout = 'auto' | 'tree';

const SNAP_GRID = 24;

export interface GraphCallbacks {
  /** Single tap / sidebar click — selects without leaving the page. */
  onSelect: (personId: string) => void;
  /** Double tap — navigate to the person's profile. */
  onOpen: (personId: string) => void;
}

/**
 * Owns the cytoscape instance for one tree view.
 *
 * Provided by TreeViewComponent (not in root): the instance is bound to a
 * DOM container and must die with it.
 */
@Injectable()
export class TreeGraphService {
  private readonly theme = inject(ThemeService);

  private cy?: Core;
  private container?: HTMLElement;
  private callbacks?: GraphCallbacks;
  private resizeObserver?: ResizeObserver;

  private treeId = '';
  private lineage: LineageIndex = indexLineage([]);

  readonly layoutMode = signal<GraphLayout>('tree');
  readonly loading = signal(true);
  readonly selectedId = signal<string | null>(null);
  readonly searchTerm = signal('');
  readonly nodeCount = signal(0);
  readonly hasCustomLayout = signal(false);

  readonly isFiltered = computed(() => this.searchTerm().trim().length > 0);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.destroy());

    // Repaint on theme change instead of rebuilding the whole graph.
    effect(() => {
      const dark = this.theme.dark();
      this.cy?.style(stylesheet(dark));
    });

    // Dimming is derived from selection + search; recompute on either.
    effect(() => {
      this.selectedId();
      this.searchTerm();
      this.applyEmphasis();
    });
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  async build(
    container: HTMLElement,
    persons: Person[],
    rels: Relationship[],
    callbacks: GraphCallbacks
  ): Promise<void> {
    this.loading.set(true);
    this.container = container;
    this.callbacks = callbacks;
    this.treeId = persons[0]?.treeId ?? this.treeId;

    const cytoscape = await loadCytoscape();

    this.cy?.destroy();
    this.lineage = indexLineage(rels);

    const { nodes, edges } = buildElements(persons, rels);
    this.nodeCount.set(persons.length);

    this.cy = cytoscape({
      container,
      elements: { nodes, edges },
      style: stylesheet(this.theme.dark()),
      layout: { name: 'preset' },
      wheelSensitivity: 0.25,
      minZoom: 0.1,
      maxZoom: 3,
      textureOnViewport: persons.length > 150,
      hideEdgesOnViewport: persons.length > 300
    });

    this.cy.on('dragfree', 'node', evt => {
      const pos = evt.target.position();
      evt.target.position({
        x: Math.round(pos.x / SNAP_GRID) * SNAP_GRID,
        y: Math.round(pos.y / SNAP_GRID) * SNAP_GRID
      });
      this.savePositions();
    });

    this.cy.on('tap', 'node', evt => {
      if (evt.target.data('coupleNode')) return;
      this.callbacks?.onSelect(evt.target.id());
    });

    this.cy.on('dbltap', 'node', evt => {
      if (evt.target.data('coupleNode')) return;
      this.callbacks?.onOpen(evt.target.id());
    });

    // Tapping empty canvas clears the selection.
    this.cy.on('tap', evt => {
      if (evt.target === this.cy) this.selectedId.set(null);
    });

    this.observeResize(container);
    this.runLayout();
    this.applyEmphasis();
    this.loading.set(false);
  }

  destroy() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.cy?.destroy();
    this.cy = undefined;
  }

  private observeResize(container: HTMLElement) {
    this.resizeObserver?.disconnect();
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.cy?.resize());
    this.resizeObserver.observe(container);
  }

  // ── Viewport controls ───────────────────────────────────────────────────────

  fit() { this.cy?.fit(undefined, 50); }

  zoomIn() { this.zoomBy(1.25); }
  zoomOut() { this.zoomBy(1 / 1.25); }

  private zoomBy(factor: number) {
    if (!this.cy) return;
    this.cy.zoom({
      level: this.cy.zoom() * factor,
      renderedPosition: { x: this.cy.width() / 2, y: this.cy.height() / 2 }
    });
  }

  toggleLayout() {
    this.layoutMode.update(m => (m === 'auto' ? 'tree' : 'auto'));
    this.resetLayout();
  }

  /** Discard hand-dragged positions and re-run the automatic layout. */
  resetLayout() {
    this.clearPositions();
    this.runLayout({ ignoreSaved: true });
  }

  /** Download the current graph as a PNG. */
  exportPng(fileName: string) {
    if (!this.cy) return;
    const uri = this.cy.png({
      full: true,
      scale: 2,
      bg: this.theme.dark() ? '#0f172a' : '#ffffff'
    });
    const a = document.createElement('a');
    a.href = uri;
    a.download = fileName;
    a.click();
  }

  // ── Selection & emphasis ────────────────────────────────────────────────────

  select(personId: string | null) {
    this.selectedId.set(personId);
    if (!personId || !this.cy) return;

    const node = this.cy.getElementById(personId);
    if (!node.nonempty()) return;

    this.cy.$(':selected').unselect();
    node.select();
    this.cy.animate({ center: { eles: node }, duration: 250 });
  }

  /**
   * Dim everything that is neither part of the selected person's direct
   * lineage nor a search hit. Both filters compose.
   */
  private applyEmphasis() {
    const cy = this.cy;
    if (!cy) return;

    const selected = this.selectedId();
    const term = this.searchTerm().trim().toLowerCase();

    cy.batch(() => {
      cy.elements().removeClass('dimmed lineage');

      if (!selected && !term) return;

      const keep = new Set<string>();

      if (selected) {
        for (const id of lineageOf(selected, this.lineage)) keep.add(id);
      }
      if (term) {
        cy.nodes('[!coupleNode]').forEach(n => {
          if ((n.data('search') as string | undefined)?.includes(term)) keep.add(n.id());
        });
      }

      cy.nodes('[!coupleNode]').forEach(n => {
        if (keep.has(n.id())) n.addClass('lineage');
        else n.addClass('dimmed');
      });

      // A couple dot stays lit only while at least one person it links is lit.
      cy.nodes('[?coupleNode]').forEach(dot => {
        const lit = edgesOf(dot).some(e => keep.has(e.source().id()) || keep.has(e.target().id()));
        if (!lit) dot.addClass('dimmed');
      });

      cy.edges().forEach(e => {
        const endsLit = [e.source(), e.target()].every((n: NodeSingular) =>
          n.data('coupleNode') ? !n.hasClass('dimmed') : keep.has(n.id())
        );
        if (!endsLit) e.addClass('dimmed');
      });
    });
  }

  // ── Layout ──────────────────────────────────────────────────────────────────

  private runLayout(opts: { ignoreSaved?: boolean } = {}) {
    const cy = this.cy;
    if (!cy) return;

    const saved = opts.ignoreSaved ? null : this.loadPositions();
    this.hasCustomLayout.set(!!saved);

    if (saved) {
      cy.layout({
        name: 'preset',
        positions: saved.pos,
        animate: false,
        fit: true,
        padding: 60
      }).run();
      return;
    }

    const mode = this.layoutMode();
    // dagre's 'tight-tree' ranker throws on the zero-length marriage edges
    // ("Not possible to find intersection inside of the rectangle"), so both
    // modes use network-simplex and differ only in spacing.
    const layout = cy.layout({
      name: 'dagre',
      rankDir: 'TB',
      nodeSep: mode === 'tree' ? 30 : 50,
      rankSep: mode === 'tree' ? 110 : 130,
      edgeSep: 5,
      ranker: 'network-simplex',
      minLen: (e: { data(k: string): unknown }) => (e.data('ek') === 'marriage' ? 0 : 1),
      animate: false
    } as never);

    layout.on('layoutstop', () => {
      this.alignCoupleRows();
      this.equalizeSiblingRows();
      this.savePositions();
      cy.fit(undefined, 60);
    });

    try {
      layout.run();
    } catch {
      // Never leave the graph unrendered if dagre fails.
      const fallback = cy.layout({ name: 'breadthfirst', directed: true, spacingFactor: 1.3 });
      fallback.on('layoutstop', () => cy.fit(undefined, 60));
      fallback.run();
    }
  }

  /** Marriage bars must be perfectly horizontal, dot centred between spouses. */
  private alignCoupleRows() {
    this.cy?.nodes('[?coupleNode]').forEach(dot => {
      const spouseEdges = edgesOf(dot, '[ek = "marriage"]');
      if (spouseEdges.length < 2) return;

      const spouses = spouseEdges.map(e =>
        e.source().id() === dot.id() ? e.target() : e.source()
      );
      const avgX = spouses.reduce((s, n) => s + n.position('x'), 0) / spouses.length;
      const avgY = spouses.reduce((s, n) => s + n.position('y'), 0) / spouses.length;

      dot.position({ x: avgX, y: avgY });
      spouses.forEach(s => s.position('y', avgY));
    });
  }

  /** Siblings of one couple share a row. */
  private equalizeSiblingRows() {
    this.cy?.nodes('[?coupleNode]').forEach(dot => {
      const children = edgesOf(dot, '[ek = "descent"]')
        .filter(e => e.source().id() === dot.id())
        .map(e => e.target());
      if (children.length < 2) return;
      const avgY = children.reduce((s, n) => s + n.position('y'), 0) / children.length;
      children.forEach(c => c.position('y', avgY));
    });
  }

  // ── Position persistence ────────────────────────────────────────────────────

  private get storageKey(): string | null {
    return this.treeId ? `qs-layout-${this.treeId}` : null;
  }

  private loadPositions(): SavedLayout | null {
    const key = this.storageKey;
    if (!key || !this.cy) return null;

    let saved: SavedLayout | null;
    try {
      const raw = localStorage.getItem(key);
      saved = raw ? (JSON.parse(raw) as SavedLayout) : null;
    } catch {
      return null;
    }

    const currentIds = this.cy.nodes().map(n => n.id());
    return isLayoutReusable(saved, currentIds) ? saved : null;
  }

  private savePositions() {
    const key = this.storageKey;
    if (!key || !this.cy) return;

    const pos: Record<string, { x: number; y: number }> = {};
    this.cy.nodes().forEach(n => { pos[n.id()] = { ...n.position() }; });

    const payload: SavedLayout = { v: LAYOUT_VERSION, ids: Object.keys(pos), pos };
    try {
      localStorage.setItem(key, JSON.stringify(payload));
      this.hasCustomLayout.set(true);
    } catch {
      // Quota exceeded / private mode — layout simply isn't remembered.
    }
  }

  private clearPositions() {
    const key = this.storageKey;
    if (!key) return;
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    this.hasCustomLayout.set(false);
  }
}

// ── Module loading ────────────────────────────────────────────────────────────

/** `cytoscape` and `cytoscape-dagre` both use `export =`, hence the interop. */
type CyFactory = typeof import('cytoscape');
type CyExt = Parameters<CyFactory['use']>[0];

function interop<T>(mod: T): T {
  return (mod as { default?: T }).default ?? mod;
}

let cytoscapePromise: Promise<CyFactory> | null = null;

/**
 * cytoscape + dagre are ~400 kB and only the tree view needs them, so they are
 * loaded on demand rather than bundled into the initial chunk.
 */
function loadCytoscape(): Promise<CyFactory> {
  cytoscapePromise ??= (async () => {
    const [core, dagreExt] = await Promise.all([
      import('cytoscape'),
      import('cytoscape-dagre')
    ]);
    const cytoscape = interop(core) as unknown as CyFactory;
    cytoscape.use(interop(dagreExt) as unknown as CyExt);
    return cytoscape;
  })();
  return cytoscapePromise;
}

// ── cytoscape helpers ─────────────────────────────────────────────────────────

/** cytoscape's Collection callbacks are loosely typed; arrays are not. */
function edgesOf(node: NodeSingular, selector?: string): EdgeSingular[] {
  return (selector ? node.connectedEdges(selector) : node.connectedEdges()).toArray();
}


// ── Stylesheet ────────────────────────────────────────────────────────────────

function stylesheet(isDark: boolean): StylesheetStyle[] {
  const lineCol = isDark ? '#64748b' : '#94a3b8';

  return [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'text-valign': 'center',
        'text-halign': 'center',
        'text-wrap': 'wrap',
        'text-max-width': '112px',
        color: isDark ? '#e2e8f0' : '#0f172a',
        'font-size': 11,
        'font-weight': 600,
        'font-family': 'system-ui, -apple-system, sans-serif',
        width: 130,
        height: 62,
        shape: 'roundrectangle',
        'background-color': isDark ? '#1e293b' : '#fafafa',
        'border-width': 1,
        'border-color': isDark ? '#334155' : '#e2e8f0',
        'transition-property': 'opacity background-color border-color border-width',
        'transition-duration': 150
      }
    },
    {
      selector: 'node[sex = "Male"]',
      style: {
        'background-color': isDark ? '#0c1a35' : '#eff6ff',
        'border-color': isDark ? '#3b82f6' : '#93c5fd',
        'border-width': 1.5,
        color: isDark ? '#93c5fd' : '#1e40af'
      }
    },
    {
      selector: 'node[sex = "Female"]',
      style: {
        'background-color': isDark ? '#200a2a' : '#fdf4ff',
        'border-color': isDark ? '#a855f7' : '#d946ef',
        'border-width': 1.5,
        color: isDark ? '#d8b4fe' : '#7e22ce'
      }
    },
    {
      selector: 'node:selected',
      style: {
        'border-width': 3,
        'border-color': '#7c3aed',
        'background-color': isDark ? '#2e1065' : '#f5f3ff',
        color: isDark ? '#c4b5fd' : '#5b21b6'
      }
    },
    { selector: 'node:active', style: { 'overlay-opacity': 0.08 } },
    {
      selector: 'node[?avatarUrl]',
      style: {
        'background-image': 'data(avatarUrl)',
        'background-fit': 'cover',
        'background-clip': 'node',
        width: 68,
        height: 68,
        shape: 'ellipse',
        'text-valign': 'bottom',
        'text-margin-y': 6,
        'font-size': 10,
        'text-background-color': isDark ? '#1e293b' : '#ffffff',
        'text-background-opacity': 0.92,
        'text-background-padding': '3px',
        'text-background-shape': 'roundrectangle',
        color: isDark ? '#e2e8f0' : '#0f172a'
      }
    },
    {
      selector: 'node[?avatarUrl][sex = "Male"]',
      style: { 'border-color': isDark ? '#3b82f6' : '#93c5fd', 'border-width': 2.5 }
    },
    {
      selector: 'node[?avatarUrl][sex = "Female"]',
      style: { 'border-color': isDark ? '#a855f7' : '#d946ef', 'border-width': 2.5 }
    },
    { selector: 'node[?avatarUrl]:selected', style: { 'border-color': '#7c3aed', 'border-width': 3 } },
    {
      selector: 'node[?coupleNode]',
      style: {
        width: 10,
        height: 10,
        shape: 'ellipse',
        'background-color': lineCol,
        'border-width': 0,
        label: '',
        events: 'no'
      }
    },
    {
      selector: 'edge[ek = "marriage"]',
      style: {
        'line-color': lineCol,
        width: 1.5,
        'line-style': 'solid',
        'curve-style': 'straight',
        'source-arrow-shape': 'none',
        'target-arrow-shape': 'none',
        'transition-property': 'opacity',
        'transition-duration': 150
      }
    },
    {
      selector: 'edge[ek = "descent"]',
      style: {
        'line-color': lineCol,
        width: 1.5,
        'line-style': 'solid',
        'curve-style': 'taxi',
        'taxi-direction': 'downward',
        'taxi-turn': '-50px',
        'source-arrow-shape': 'none',
        'target-arrow-shape': 'none',
        'transition-property': 'opacity',
        'transition-duration': 150
      }
    },
    {
      selector: 'edge[ek = "descent"][relType = "Adoptive"]',
      style: { 'line-style': 'dotted', 'line-color': isDark ? '#34d399' : '#10b981' }
    },
    { selector: '.dimmed', style: { opacity: 0.12 } },
    { selector: 'node.lineage', style: { 'border-width': 2 } }
  ] as StylesheetStyle[];
}
