import type { EdgeDefinition, NodeDefinition } from 'cytoscape';
import { Person, Relationship, RelationshipType } from '../../../core/api/api-client.service';

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
    if (r.type === 'Spouse') {
      addTo(index.spousesOf, r.fromPersonId, r.toPersonId);
      addTo(index.spousesOf, r.toPersonId, r.fromPersonId);
      continue;
    }
    if (r.type !== 'Parent' && r.type !== 'Adoptive') continue;
    addTo(index.childrenOf, r.fromPersonId, r.toPersonId);
    addTo(index.parentsOf, r.toPersonId, r.fromPersonId);
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
  return `${p.firstName} ${p.lastName} ${p.maidenName ?? ''} ${p.birthPlace ?? ''}`.toLowerCase();
}

function personLabel(p: Person): string {
  const name = `${p.firstName} ${p.lastName}`;
  const dates = p.birth?.year
    ? p.death?.year
      ? `${p.birth.year} – ${p.death.year}`
      : `* ${p.birth.year}`
    : '';
  return dates ? `${name}\n${dates}` : name;
}

/**
 * Builds the cytoscape elements. Couples get a junction node so that children
 * shared by both parents descend from a single point rather than from each
 * parent separately.
 */
export function buildElements(persons: Person[], rels: Relationship[]) {
  const spouseRels = rels.filter(r => r.type === 'Spouse');
  const parentRels = rels.filter(r => r.type === 'Parent' || r.type === 'Adoptive');

  const childrenOf = new Map<string, Set<string>>();
  for (const r of parentRels) addTo(childrenOf, r.fromPersonId, r.toPersonId);

  const coveredEdgeIds = new Set<string>();
  const coupleNodes: NodeDefinition[] = [];
  const edges: EdgeDefinition[] = [];

  for (const sr of spouseRels) {
    const aKids = childrenOf.get(sr.fromPersonId) ?? new Set<string>();
    const bKids = childrenOf.get(sr.toPersonId) ?? new Set<string>();
    const shared = [...aKids].filter(c => bKids.has(c));

    const cid = `_c_${sr.id}`;
    coupleNodes.push({ data: { id: cid, coupleNode: true } });
    edges.push({ data: { id: `_ma_${cid}`, source: sr.fromPersonId, target: cid, ek: 'marriage' } });
    edges.push({ data: { id: `_mb_${cid}`, source: sr.toPersonId, target: cid, ek: 'marriage' } });

    for (const childId of shared) {
      const parentEdges = parentRels.filter(
        r => r.toPersonId === childId &&
          (r.fromPersonId === sr.fromPersonId || r.fromPersonId === sr.toPersonId)
      );
      parentEdges.forEach(r => coveredEdgeIds.add(r.id));
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
  for (const r of parentRels.filter(r => !coveredEdgeIds.has(r.id))) {
    edges.push({
      data: { id: r.id, source: r.fromPersonId, target: r.toPersonId, ek: 'descent', relType: r.type }
    });
  }

  const personNodes: NodeDefinition[] = persons.map(p => ({
    data: {
      id: p.id,
      label: personLabel(p),
      sex: p.sex,
      avatarUrl: p.avatarUrl ?? '',
      // Precomputed so filtering never re-derives it per keystroke.
      search: personSearchText(p)
    }
  }));

  return { nodes: [...personNodes, ...coupleNodes], edges };
}
