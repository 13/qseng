import { Injectable, signal } from '@angular/core';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { Person, Relationship } from '../../../core/api/api-client.service';

cytoscape.use(dagre);

export type GraphLayout = 'auto' | 'tree';

const SNAP_GRID = 24;

@Injectable({ providedIn: 'root' })
export class TreeGraphService {
  private cy?: cytoscape.Core;
  readonly layoutMode = signal<GraphLayout>('tree');

  private lastPersons: Person[] = [];
  private lastOnSelect?: (id: string) => void;

  private get _posKey(): string | null {
    const tid = this.lastPersons[0]?.treeId;
    return tid ? `qs-pos-${tid}` : null;
  }

  private _loadPositions(): Record<string, { x: number; y: number }> | null {
    const key = this._posKey;
    if (!key) return null;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  private _savePositions() {
    const key = this._posKey;
    if (!key || !this.cy) return;
    const pos: Record<string, { x: number; y: number }> = {};
    this.cy.nodes().forEach(n => { pos[n.id()] = { ...n.position() }; });
    try { localStorage.setItem(key, JSON.stringify(pos)); } catch {}
  }

  private _clearPositions() {
    const key = this._posKey;
    if (key) try { localStorage.removeItem(key); } catch {}
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  build(
    container: HTMLElement,
    persons: Person[],
    rels: Relationship[],
    onSelect: (personId: string) => void
  ): cytoscape.Core {
    this.cy?.destroy();
    this.lastPersons = persons;
    this.lastOnSelect = onSelect;
    return this._build(container, persons, rels, onSelect);
  }

  toggleLayout() {
    this.layoutMode.set(this.layoutMode() === 'auto' ? 'tree' : 'auto');
    this._clearPositions();
    this._runLayout();
  }

  highlight(personId: string) {
    this.cy?.$(':selected').unselect();
    const node = this.cy?.$(`#${personId}`);
    node?.select();
    if (node?.length) {
      this.cy?.animate({ fit: { eles: node, padding: 140 }, duration: 350 });
    }
  }

  fit()     { this.cy?.fit(undefined, 50); }
  zoomIn()  { if (this.cy) this.cy.zoom({ level: this.cy.zoom() * 1.25, renderedPosition: { x: this.cy.width() / 2, y: this.cy.height() / 2 } }); }
  zoomOut() { if (this.cy) this.cy.zoom({ level: this.cy.zoom() / 1.25, renderedPosition: { x: this.cy.width() / 2, y: this.cy.height() / 2 } }); }
  destroy() { this.cy?.destroy(); this.cy = undefined; }

  // ── Internal ────────────────────────────────────────────────────────────────

  private _build(
    container: HTMLElement,
    persons: Person[],
    rels: Relationship[],
    onSelect: (personId: string) => void
  ): cytoscape.Core {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    const spouseRels = rels.filter(r => r.type === 'Spouse');
    const parentRels = rels.filter(r => r.type === 'Parent' || r.type === 'Adoptive');

    // person → set of children
    const parentToChildren = new Map<string, Set<string>>();
    for (const r of parentRels) {
      if (!parentToChildren.has(r.fromPersonId)) parentToChildren.set(r.fromPersonId, new Set());
      parentToChildren.get(r.fromPersonId)!.add(r.toPersonId);
    }

    const coveredEdgeIds = new Set<string>();
    const coupleNodes: cytoscape.NodeDefinition[] = [];
    const structureEdges: cytoscape.EdgeDefinition[] = [];

    // Build couple nodes; route all shared-child descent FROM the couple node
    for (const sr of spouseRels) {
      const aKids = parentToChildren.get(sr.fromPersonId) ?? new Set<string>();
      const bKids = parentToChildren.get(sr.toPersonId)   ?? new Set<string>();
      const shared = [...aKids].filter(c => bKids.has(c));

      const cid = `_c_${sr.id}`;
      coupleNodes.push({ data: { id: cid, coupleNode: true } });

      // Horizontal marriage bar: each spouse → couple dot
      structureEdges.push({ data: { id: `_ma_${cid}`, source: sr.fromPersonId, target: cid, ek: 'marriage' } });
      structureEdges.push({ data: { id: `_mb_${cid}`, source: sr.toPersonId,   target: cid, ek: 'marriage' } });

      // Vertical descent: couple dot → each shared child (one edge per child)
      const connected = new Set<string>();
      for (const childId of shared) {
        parentRels
          .filter(r => r.toPersonId === childId &&
            (r.fromPersonId === sr.fromPersonId || r.fromPersonId === sr.toPersonId))
          .forEach(r => coveredEdgeIds.add(r.id));

        if (!connected.has(childId)) {
          connected.add(childId);
          const relType = parentRels.find(r =>
            r.toPersonId === childId &&
            (r.fromPersonId === sr.fromPersonId || r.fromPersonId === sr.toPersonId)
          )?.type ?? 'Parent';
          structureEdges.push({
            data: { id: `_d_${cid}_${childId}`, source: cid, target: childId, ek: 'descent', relType }
          });
        }
      }
    }

    // Single-parent descent (not covered by any couple node)
    for (const r of parentRels.filter(r => !coveredEdgeIds.has(r.id))) {
      structureEdges.push({
        data: { id: r.id, source: r.fromPersonId, target: r.toPersonId, ek: 'descent', relType: r.type }
      });
    }

    // Person nodes — name on line 1, life dates on line 2
    const personNodes: cytoscape.NodeDefinition[] = persons.map(p => {
      const name = `${p.firstName} ${p.lastName}`;
      const dates = p.birth?.year
        ? (p.death?.year ? `${p.birth.year} – ${p.death.year}` : `* ${p.birth.year}`)
        : '';
      return {
        data: {
          id: p.id,
          label: dates ? `${name}\n${dates}` : name,
          sex: p.sex,
          avatarUrl: p.avatarUrl ?? ''
        }
      };
    });

    // Connector colour — same for marriage bar and descent lines
    const lineCol = isDark ? '#64748b' : '#94a3b8';

    this.cy = cytoscape({
      container,
      elements: { nodes: [...personNodes, ...coupleNodes], edges: structureEdges },
      style: [
        // ── Person node (default / unknown sex) ────────────────────────────
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'text-valign': 'center' as const,
            'text-halign': 'center' as const,
            'text-wrap': 'wrap' as const,
            'text-max-width': '112px',
            'color': isDark ? '#e2e8f0' : '#0f172a',
            'font-size': 11,
            'font-weight': 600 as any,
            'font-family': 'system-ui, -apple-system, sans-serif',
            'width': 130,
            'height': 62,
            'shape': 'roundrectangle' as const,
            'background-color': isDark ? '#1e293b' : '#fafafa',
            'border-width': 1,
            'border-color': isDark ? '#334155' : '#e2e8f0',
            'transition-property': 'background-color border-color border-width',
            'transition-duration': '150ms' as any
          }
        },
        // Male
        {
          selector: 'node[sex = "Male"]',
          style: {
            'background-color': isDark ? '#0c1a35' : '#eff6ff',
            'border-color': isDark ? '#3b82f6' : '#93c5fd',
            'border-width': 1.5,
            'color': isDark ? '#93c5fd' : '#1e40af'
          }
        },
        // Female
        {
          selector: 'node[sex = "Female"]',
          style: {
            'background-color': isDark ? '#200a2a' : '#fdf4ff',
            'border-color': isDark ? '#a855f7' : '#d946ef',
            'border-width': 1.5,
            'color': isDark ? '#d8b4fe' : '#7e22ce'
          }
        },
        // Selected
        {
          selector: 'node:selected',
          style: {
            'border-width': 2.5,
            'border-color': '#7c3aed',
            'background-color': isDark ? '#2e1065' : '#f5f3ff',
            'color': isDark ? '#c4b5fd' : '#5b21b6'
          }
        },
        { selector: 'node:active', style: { 'overlay-opacity': 0.08 } },
        // Avatar circle
        {
          selector: 'node[?avatarUrl]',
          style: {
            'background-image': 'data(avatarUrl)',
            'background-fit': 'cover' as const,
            'background-clip': 'node' as const,
            'width': 68, 'height': 68,
            'shape': 'ellipse' as const,
            'text-valign': 'bottom' as const,
            'text-margin-y': 6,
            'font-size': 10,
            'text-background-color': isDark ? '#1e293b' : '#ffffff',
            'text-background-opacity': 0.92,
            'text-background-padding': '3px',
            'text-background-shape': 'roundrectangle' as const,
            'color': isDark ? '#e2e8f0' : '#0f172a'
          }
        },
        { selector: 'node[?avatarUrl][sex = "Male"]',   style: { 'border-color': isDark ? '#3b82f6' : '#93c5fd', 'border-width': 2.5 } },
        { selector: 'node[?avatarUrl][sex = "Female"]', style: { 'border-color': isDark ? '#a855f7' : '#d946ef', 'border-width': 2.5 } },
        { selector: 'node[?avatarUrl]:selected',        style: { 'border-color': '#7c3aed', 'border-width': 3 } },
        // ── Couple junction dot ─────────────────────────────────────────────
        {
          selector: 'node[?coupleNode]',
          style: {
            'width': 10, 'height': 10,
            'shape': 'ellipse' as const,
            'background-color': lineCol,
            'border-width': 0,
            'label': '',
            'events': 'no' as any
          }
        },
        // ── Marriage bar (straight horizontal) ──────────────────────────────
        {
          selector: 'edge[ek = "marriage"]',
          style: {
            'line-color': lineCol,
            'width': 1.5,
            'line-style': 'solid' as const,
            'curve-style': 'straight' as const,
            'source-arrow-shape': 'none' as const,
            'target-arrow-shape': 'none' as const
          }
        },
        // ── Descent (orthogonal: vertical drop then horizontal comb) ────────
        {
          selector: 'edge[ek = "descent"]',
          style: {
            'line-color': lineCol,
            'width': 1.5,
            'line-style': 'solid' as const,
            'curve-style': 'taxi' as const,
            'taxi-direction': 'downward' as any,
            'taxi-turn': '-50px' as any,
            'source-arrow-shape': 'none' as const,
            'target-arrow-shape': 'none' as const
          }
        },
        // Adoptive descent — dotted green
        {
          selector: 'edge[ek = "descent"][relType = "Adoptive"]',
          style: {
            'line-style': 'dotted' as const,
            'line-color': isDark ? '#34d399' : '#10b981'
          }
        }
      ],
      layout: { name: 'preset' },
      wheelSensitivity: 0.25,
      minZoom: 0.1,
      maxZoom: 3
    });

    this.cy.on('dragfree', 'node', evt => {
      const pos = evt.target.position();
      evt.target.position({
        x: Math.round(pos.x / SNAP_GRID) * SNAP_GRID,
        y: Math.round(pos.y / SNAP_GRID) * SNAP_GRID
      });
      this._savePositions();
    });

    this.cy.on('tap', 'node', evt => {
      if (!evt.target.data('coupleNode')) onSelect(evt.target.id());
    });

    this._runLayout();
    return this.cy;
  }

  private _runLayout(saved?: Record<string, { x: number; y: number }> | null) {
    if (!this.cy) return;
    const positions = saved !== undefined ? saved : this._loadPositions();

    if (positions && Object.keys(positions).length > 0) {
      const ly = this.cy.layout({
        name: 'preset',
        positions: (n: cytoscape.NodeSingular) => positions[n.id()] ?? { x: 0, y: 0 },
        animate: false
      } as any);
      ly.on('layoutstop', () => {
        this._alignCoupleRow();
        this._equalizeSiblingRows();
        this._savePositions();
        this.cy?.fit(undefined, 60);
      });
      ly.run();
      return;
    }

    const mode = this.layoutMode();
    const ly = this.cy.layout({
      name: 'dagre',
      rankDir: 'TB',
      nodeSep: mode === 'tree' ? 30 : 50,
      rankSep: mode === 'tree' ? 110 : 130,
      edgeSep: 5,
      ranker: mode === 'tree' ? 'tight-tree' : 'network-simplex',
      minLen: (e: cytoscape.EdgeSingular) => e.data('ek') === 'marriage' ? 0 : 1,
      animate: false
    } as any);

    ly.on('layoutstop', () => {
      this._alignCoupleRow();
      this._equalizeSiblingRows();
      this._savePositions();
      this.cy?.fit(undefined, 60);
    });
    ly.run();
  }

  /**
   * Force all three nodes on a marriage bar (spouse A, couple dot, spouse B)
   * to the same Y so the bar is perfectly horizontal. The dot is centred at
   * the midpoint X between the two spouses.
   */
  private _alignCoupleRow() {
    this.cy?.nodes('[?coupleNode]').forEach(cn => {
      const spouseEdges = cn.connectedEdges('[ek = "marriage"]');
      if (spouseEdges.length < 2) return;

      let sumX = 0, sumY = 0;
      const spouseNodes: cytoscape.NodeSingular[] = [];

      spouseEdges.forEach(e => {
        const edge = e as unknown as cytoscape.EdgeSingular;
        const other = edge.source().id() === cn.id() ? edge.target() : edge.source();
        sumX += other.position('x');
        sumY += other.position('y');
        spouseNodes.push(other);
      });

      const avgY = sumY / spouseEdges.length;
      cn.position({ x: sumX / spouseEdges.length, y: avgY });
      spouseNodes.forEach(s => s.position('y', avgY));
    });
  }

  /**
   * Snap all children of the same couple node to an identical Y row so
   * siblings never drift to different vertical positions.
   */
  private _equalizeSiblingRows() {
    this.cy?.nodes('[?coupleNode]').forEach(cn => {
      const children: cytoscape.NodeSingular[] = [];
      cn.connectedEdges('[ek = "descent"]').forEach(e => {
        const edge = e as unknown as cytoscape.EdgeSingular;
        if (edge.source().id() === cn.id()) children.push(edge.target());
      });
      if (children.length < 2) return;
      const avgY = children.reduce((s, n) => s + n.position('y'), 0) / children.length;
      children.forEach(c => c.position('y', avgY));
    });
  }
}
