import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import type { Core, EdgeSingular, EventObjectNode, NodeSingular, StylesheetStyle } from 'cytoscape';
import { PersonDto as Person, RelationshipDto as Relationship } from '../../../core/api/generated';
import { ThemeService } from '../../../core/theme/theme.service';
import { NodeTheme, NODE_W, cssVar, readNodeTheme, renderCompactNodeSvg, renderNodeSvg } from './node-svg';
import { COUPLE_DOT_SIZE, graphStylesheet } from './graph-stylesheet';
import {
  LAYOUT_VERSION, LineageIndex, SavedLayout,
  buildElements, indexLineage, isLayoutReusable, lineageOf
} from './tree-graph.model';

export type GraphLayout = 'auto' | 'tree';

const SNAP_GRID = 24;

/** Minimum clearance between a spouse card's inner edge and the couple dot. */
const MIN_SPOUSE_GAP = 12;
/** Half the space a couple pair needs either side of its dot's centre. */
const MIN_SPOUSE_HALF_SPAN = NODE_W / 2 + COUPLE_DOT_SIZE / 2 + MIN_SPOUSE_GAP;

export interface GraphCallbacks {
  /** Single tap / sidebar click — selects without leaving the page. */
  onSelect: (personId: string) => void;
  /** Double tap — navigate to the person's profile. */
  onOpen: (personId: string) => void;
  /** Right-click / context tap — open the context menu at the given viewport position. */
  onContext: (personId: string, clientX: number, clientY: number) => void;
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
  private nodeTheme: NodeTheme = readNodeTheme();

  private cy?: Core;
  private container?: HTMLElement;
  private callbacks?: GraphCallbacks;
  private resizeObserver?: ResizeObserver;
  private personsById = new Map<string, Person>();

  private treeId = '';
  private lineage: LineageIndex = indexLineage([]);

  /** Shared by the 'cxttap' (right-click / two-finger tap) and 'taphold' (one-finger long press) node handlers. */
  private readonly onNodeContext = (evt: EventObjectNode) => {
    if (evt.target.data('coupleNode')) return;
    const { x, y } = evt.renderedPosition ?? { x: 0, y: 0 };
    const rect = this.container?.getBoundingClientRect();
    this.callbacks?.onContext(evt.target.id(), (rect?.left ?? 0) + x, (rect?.top ?? 0) + y);
  };

  readonly layoutMode = signal<GraphLayout>('tree');
  readonly loading = signal(true);
  readonly selectedId = signal<string | null>(null);
  readonly searchTerm = signal('');
  readonly nodeCount = signal(0);
  readonly hasCustomLayout = signal(false);
  readonly compact = signal(false);

  readonly isFiltered = computed(() => this.searchTerm().trim().length > 0);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.destroy());

    // Repaint on theme change instead of rebuilding the whole graph.
    effect(() => {
      this.theme.dark();
      this.refreshTheme();
    });

    // The stylesheet picks the image/size per node by the compact flag.
    effect(() => {
      this.compact();
      this.cy?.style(this.stylesheet());
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
    this.personsById = new Map(persons.map(p => [p.id ?? '', p]));

    this.nodeTheme = readNodeTheme();
    const { nodes, edges } = buildElements(persons, rels, this.nodeTheme);
    this.nodeCount.set(persons.length);

    this.cy = cytoscape({
      container,
      elements: { nodes, edges },
      style: this.stylesheet(),
      layout: { name: 'preset' },
      wheelSensitivity: 0.25,
      minZoom: 0.2,
      maxZoom: 2.5,
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

    // cytoscape's one-finger long press on touch emits 'taphold', not
    // 'cxttap' (that needs a two-finger tap), so both must open the menu.
    this.cy.on('cxttap', 'node', this.onNodeContext);
    this.cy.on('taphold', 'node', this.onNodeContext);

    this.cy.on('zoom', () => this.compact.set((this.cy?.zoom() ?? 1) < 0.45));

    // Tapping empty canvas clears the selection.
    this.cy.on('tap', evt => {
      if (evt.target === this.cy) this.selectedId.set(null);
    });

    this.observeResize(container);
    this.runLayout();
    this.applyEmphasis();
    this.compact.set(this.cy.zoom() < 0.45);
    this.loading.set(false);

    // A reload (e.g. after deleting the selected person) can leave `selectedId`
    // pointing at a person no longer in the tree; without this, applyEmphasis
    // treats it as a real selection with an empty lineage and dims everything.
    const sel = this.selectedId();
    if (sel && !this.personsById.has(sel)) this.select(null);
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
    this.resizeObserver = new ResizeObserver(() => this.onContainerResize());
    this.resizeObserver.observe(container);
  }

  /**
   * The canvas shrinks when the selection panel opens (or the sidenav toggles),
   * which can leave the selected node partly or fully outside the new viewport.
   * Re-centre on it only when needed, so an unrelated resize doesn't yank the
   * view away from wherever the user has it.
   */
  private onContainerResize() {
    const cy = this.cy;
    if (!cy) return;
    cy.resize();

    const id = this.selectedId();
    if (!id) return;
    const node = cy.getElementById(id);
    if (!node.nonempty()) return;

    const box = node.renderedBoundingBox();
    const inView = box.x1 >= 0 && box.y1 >= 0 && box.x2 <= cy.width() && box.y2 <= cy.height();
    if (!inView) cy.animate({ center: { eles: node }, duration: 200 });
  }

  // ── Viewport controls ───────────────────────────────────────────────────────

  fit() { this.cy?.fit(undefined, 40); }

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
      bg: cssVar('--mat-sys-surface', '#ffffff')
    });
    const a = document.createElement('a');
    a.href = uri;
    a.download = fileName;
    a.click();
  }

  /** Re-read the palette from CSS custom properties and repaint node images + stylesheet. */
  refreshTheme() {
    if (!this.cy) return;
    this.nodeTheme = readNodeTheme();
    const cy = this.cy;
    cy.batch(() => {
      cy.nodes('[!coupleNode]').forEach(n => {
        const p = this.personsById.get(n.id());
        if (p) { n.data('image', renderNodeSvg(p, this.nodeTheme)); n.data('imageCompact', renderCompactNodeSvg(p, this.nodeTheme)); }
      });
    });
    cy.style(this.stylesheet());
  }

  // ── Selection & emphasis ────────────────────────────────────────────────────

  select(personId: string | null) {
    this.selectedId.set(personId);
    // Clear the cytoscape selection border even when unselecting (Escape,
    // closing the panel) — the early returns below only skip re-selecting.
    this.cy?.$(':selected').unselect();
    if (!personId || !this.cy) return;

    const node = this.cy.getElementById(personId);
    if (!node.nonempty()) return;

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
      cy.fit(undefined, 40);
    });

    try {
      layout.run();
    } catch {
      // Never leave the graph unrendered if dagre fails.
      const fallback = cy.layout({ name: 'breadthfirst', directed: true, spacingFactor: 1.3 });
      fallback.on('layoutstop', () => cy.fit(undefined, 40));
      fallback.run();
    }
  }

  /**
   * Marriage bars must be perfectly horizontal, dot centred between spouses.
   *
   * dagre's rank ordering doesn't reliably give a two-node rank the full
   * `nodeSep` on both sides of the dot between them (it's tuned for chains of
   * many same-rank nodes, not this couple/dot/couple triple), so spouse cards
   * can end up overlapping. Nudge them apart afterwards instead of trying to
   * coax dagre into it — this only ever moves cards outward, so a pair dagre
   * already spaced well enough is left untouched.
   */
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

      if (spouses.length === 2) {
        const [left, right] = spouses[0].position('x') <= spouses[1].position('x')
          ? spouses : [spouses[1], spouses[0]];
        if (avgX - left.position('x') < MIN_SPOUSE_HALF_SPAN) left.position('x', avgX - MIN_SPOUSE_HALF_SPAN);
        if (right.position('x') - avgX < MIN_SPOUSE_HALF_SPAN) right.position('x', avgX + MIN_SPOUSE_HALF_SPAN);
      }
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

  // ── Stylesheet ──────────────────────────────────────────────────────────────

  /** Token-driven; node visuals come from the pre-rendered SVG images, not cytoscape drawing. */
  private stylesheet(): StylesheetStyle[] {
    return graphStylesheet(this.compact(), {
      selected: cssVar('--qs-graph-selected', '#2f5d50'),
      marriage: cssVar('--qs-graph-marriage', '#8a6d3b'),
      descent: cssVar('--qs-graph-descent', '#8a8177')
    });
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


