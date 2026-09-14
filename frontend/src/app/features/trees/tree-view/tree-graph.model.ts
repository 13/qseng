import type { EdgeDefinition, NodeDefinition } from 'cytoscape';
import { PersonDto as Person, RelationshipDto as Relationship, RelationshipType } from '../../../core/api/generated';
import { NodeTheme, renderCompactNodeSvg, renderNodeSvg } from './node-svg';

/** The UI offers 'Child' as a convenience; the API only knows Parent edges. */
export type UiRelType = RelationshipType | 'Child';
export const UI_REL_TYPES: UiRelType[] = ['Parent', 'Child', 'Spouse', 'Adoptive'];

export interface LineageIndex {
  parentsOf: Map<string, Set<string>>;
  childrenOf: Map<string, Set<string>>;
  spousesOf: Map<string, Set<string>>;
}

export interface SavedLayout {
  v: number;
  ids: string[];
  pos: Record<string, { x: number; y: number }>;
}

export const LAYOUT_VERSION = 2;

function addTo(map: Map<string, Set<string>>, key: string, value: string) {
  (map.get(key) ?? map.set(key, new Set()).get(key)!).add(value);
}

/**
 * Normalises a UI relationship into the API's shape, where a Parent (or
 * Adoptive) edge always points parent → child.
 *
 * `uiType` describes **roleHolder's** role relative to `counterpart`: picking
 * 'Parent' means the role holder is the parent.
 */
export function toApiRelationship(
  uiType: UiRelType,
  roleHolderId: string,
  counterpartId: string
): { type: RelationshipType; fromPersonId: string; toPersonId: string } {
  if (uiType === 'Child') {
    return { type: 'Parent', fromPersonId: counterpartId, toPersonId: roleHolderId };
  }
  return { type: uiType, fromPersonId: roleHolderId, toPersonId: counterpartId };
}

export function indexLineage(rels: Relationship[]): LineageIndex {
  const index: LineageIndex = {
    parentsOf: new Map(),
    childrenOf: new Map(),
    spousesOf: new Map()
  };

  for (const r of rels) {
    const from = r.fromPersonId ?? '';
    const to = r.toPersonId ?? '';
    if (r.type === 'Spouse') {
      addTo(index.spousesOf, from, to);
      addTo(index.spousesOf, to, from);
      continue;
    }
    if (r.type !== 'Parent' && r.type !== 'Adoptive') continue;
    addTo(index.childrenOf, from, to);
    addTo(index.parentsOf, to, from);
  }

  return index;
}

/**
 * The person, every ancestor and descendant, plus their spouses — a co-parent
 * shown dimmed next to lit children reads as a bug. Cycle-safe.
 */
export function lineageOf(personId: string, index: LineageIndex): Set<string> {
  const seen = new Set<string>([personId]);

  const walk = (edges: Map<string, Set<string>>) => {
    const queue = [personId];
    while (queue.length) {
      for (const next of edges.get(queue.pop()!) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
  };

  walk(index.parentsOf);
  walk(index.childrenOf);
  for (const spouse of index.spousesOf.get(personId) ?? []) seen.add(spouse);

  return seen;
}

/**
 * Hand-dragged positions may only be replayed when they cover exactly the
 * current node set. Otherwise a newly added person would be placed at (0, 0),
 * stacked on top of the graph.
 */
export function isLayoutReusable(saved: SavedLayout | null, currentIds: string[]): boolean {
  if (!saved || saved.v !== LAYOUT_VERSION || !saved.pos || !saved.ids) return false;

  const stored = [...saved.ids].sort();
  const current = [...currentIds].sort();
  return current.length === stored.length && current.every((id, i) => id === stored[i]);
}

export function personSearchText(p: Person): string {
  return `${p.firstName ?? ''} ${p.lastName ?? ''} ${p.maidenName ?? ''} ${p.birthPlace ?? ''}`.toLowerCase();
}

/**
 * Builds the cytoscape elements. Couples get a junction node so that children
 * shared by both parents descend from a single point rather than from each
 * parent separately.
 */
export function buildElements(persons: Person[], rels: Relationship[], theme: NodeTheme) {
  const spouseRels = rels.filter(r => r.type === 'Spouse');
  const parentRels = rels.filter(r => r.type === 'Parent' || r.type === 'Adoptive');

  const childrenOf = new Map<string, Set<string>>();
  for (const r of parentRels) addTo(childrenOf, r.fromPersonId ?? '', r.toPersonId ?? '');

  const coveredEdgeIds = new Set<string>();
  const coupleNodes: NodeDefinition[] = [];
  const edges: EdgeDefinition[] = [];

  for (const sr of spouseRels) {
    const srFrom = sr.fromPersonId ?? '';
    const srTo = sr.toPersonId ?? '';
    const aKids = childrenOf.get(srFrom) ?? new Set<string>();
    const bKids = childrenOf.get(srTo) ?? new Set<string>();
    const shared = [...aKids].filter(c => bKids.has(c));

    const cid = `_c_${sr.id}`;
    coupleNodes.push({ data: { id: cid, coupleNode: true } });
    edges.push({ data: { id: `_ma_${cid}`, source: srFrom, target: cid, ek: 'marriage' } });
    edges.push({ data: { id: `_mb_${cid}`, source: srTo, target: cid, ek: 'marriage' } });

    for (const childId of shared) {
      const parentEdges = parentRels.filter(
        r => r.toPersonId === childId &&
          (r.fromPersonId === srFrom || r.fromPersonId === srTo)
      );
      parentEdges.forEach(r => coveredEdgeIds.add(r.id ?? ''));
      edges.push({
        data: {
          id: `_d_${cid}_${childId}`,
          source: cid,
          target: childId,
          ek: 'descent',
          relType: parentEdges[0]?.type ?? 'Parent'
        }
      });
    }
  }

  // Single-parent descent, not covered by a couple junction.
  for (const r of parentRels.filter(r => !coveredEdgeIds.has(r.id ?? ''))) {
    edges.push({
      data: { id: r.id, source: r.fromPersonId ?? '', target: r.toPersonId ?? '', ek: 'descent', relType: r.type }
    });
  }

  const personNodes: NodeDefinition[] = persons.map(p => ({
    data: {
      id: p.id ?? '',
      sex: p.sex ?? '',
      avatarUrl: p.avatarUrl ?? '',
      // Precomputed so filtering never re-derives it per keystroke.
      search: personSearchText(p),
      image: renderNodeSvg(p, theme),
      imageCompact: renderCompactNodeSvg(p, theme)
    }
  }));

  return { nodes: [...personNodes, ...coupleNodes], edges };
}
