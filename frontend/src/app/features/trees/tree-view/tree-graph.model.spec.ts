import { describe, expect, it } from 'vitest';
import { PersonDto as Person, RelationshipDto as Relationship } from '../../../core/api/generated';
import { NodeTheme } from './node-svg';
import {
  LAYOUT_VERSION, SavedLayout,
  buildElements, indexLineage, isLayoutReusable, lineageOf, personSearchText, toApiRelationship
} from './tree-graph.model';

const theme: NodeTheme = { bg: '#fff', border: '#ccc', text: '#111', muted: '#666', male: '#5b7a99', female: '#b5636f', unknown: '#999', nameFont: 'Fraunces Variable', textFont: 'Inter Variable' };

function person(id: string, overrides: Partial<Person> = {}): Person {
  return {
    id,
    treeId: 'tree-1',
    firstName: id,
    lastName: 'Test',
    sex: 'Male',
    ...overrides
  };
}

function parentOf(parent: string, child: string, id = `${parent}->${child}`): Relationship {
  return { id, treeId: 'tree-1', fromPersonId: parent, toPersonId: child, type: 'Parent' };
}

function spouses(a: string, b: string, id = `${a}+${b}`): Relationship {
  return { id, treeId: 'tree-1', fromPersonId: a, toPersonId: b, type: 'Spouse' };
}

describe('toApiRelationship', () => {
  // The API only understands Parent edges pointing parent → child. Getting this
  // backwards silently records the wrong family structure.
  it('keeps Parent as role-holder → counterpart', () => {
    expect(toApiRelationship('Parent', 'mother', 'kid')).toEqual({
      type: 'Parent', fromPersonId: 'mother', toPersonId: 'kid'
    });
  });

  it('flips Child into a Parent edge', () => {
    expect(toApiRelationship('Child', 'kid', 'mother')).toEqual({
      type: 'Parent', fromPersonId: 'mother', toPersonId: 'kid'
    });
  });

  it('treats Adoptive like Parent (adoptive parent → child)', () => {
    expect(toApiRelationship('Adoptive', 'guardian', 'kid')).toEqual({
      type: 'Adoptive', fromPersonId: 'guardian', toPersonId: 'kid'
    });
  });

  it('passes Spouse through unchanged', () => {
    expect(toApiRelationship('Spouse', 'a', 'b')).toEqual({
      type: 'Spouse', fromPersonId: 'a', toPersonId: 'b'
    });
  });

  it('Parent and Child are inverses of each other', () => {
    const asParent = toApiRelationship('Parent', 'mother', 'kid');
    const asChild = toApiRelationship('Child', 'kid', 'mother');
    expect(asChild).toEqual(asParent);
  });
});

describe('lineageOf', () => {
  //   grandma
  //      |
  //    father — mother        uncle
  //      |
  //     me
  //      |
  //    child
  const rels = [
    parentOf('grandma', 'father'),
    parentOf('grandma', 'uncle'),
    parentOf('father', 'me'),
    parentOf('mother', 'me'),
    parentOf('me', 'child'),
    spouses('father', 'mother')
  ];
  const index = indexLineage(rels);

  it('includes the person, ancestors and descendants', () => {
    const lineage = lineageOf('me', index);
    expect([...lineage].sort()).toEqual(['child', 'father', 'grandma', 'me', 'mother'].sort());
  });

  it('excludes collateral relatives such as uncles', () => {
    expect(lineageOf('me', index).has('uncle')).toBe(false);
  });

  it('includes the spouse of the selected person', () => {
    // A co-parent dimmed next to lit children reads as a rendering bug.
    expect(lineageOf('father', index).has('mother')).toBe(true);
  });

  it('does not include spouses of ancestors', () => {
    expect(lineageOf('child', index).has('mother')).toBe(true); // mother is an ancestor
    expect(lineageOf('grandma', index).has('mother')).toBe(false); // in-law only
  });

  it('terminates on a cyclic graph', () => {
    const cyclic = indexLineage([parentOf('a', 'b'), parentOf('b', 'a')]);
    expect([...lineageOf('a', cyclic)].sort()).toEqual(['a', 'b']);
  });

  it('returns just the person when they have no relationships', () => {
    expect([...lineageOf('loner', indexLineage([]))]).toEqual(['loner']);
  });
});

describe('indexLineage', () => {
  it('treats Adoptive edges as parent edges', () => {
    const index = indexLineage([
      { id: 'r', treeId: 't', fromPersonId: 'guardian', toPersonId: 'kid', type: 'Adoptive' }
    ]);
    expect(index.childrenOf.get('guardian')).toEqual(new Set(['kid']));
    expect(index.parentsOf.get('kid')).toEqual(new Set(['guardian']));
  });

  it('records spouses in both directions', () => {
    const index = indexLineage([spouses('a', 'b')]);
    expect(index.spousesOf.get('a')).toEqual(new Set(['b']));
    expect(index.spousesOf.get('b')).toEqual(new Set(['a']));
  });
});

describe('isLayoutReusable', () => {
  const layout = (ids: string[]): SavedLayout => ({
    v: LAYOUT_VERSION,
    ids,
    pos: Object.fromEntries(ids.map(id => [id, { x: 1, y: 2 }]))
  });

  it('accepts a layout covering exactly the current nodes', () => {
    expect(isLayoutReusable(layout(['a', 'b']), ['b', 'a'])).toBe(true);
  });

  it('rejects a layout missing a newly added person', () => {
    // Otherwise the new node is placed at (0, 0), stacked on the graph.
    expect(isLayoutReusable(layout(['a', 'b']), ['a', 'b', 'c'])).toBe(false);
  });

  it('rejects a layout describing a deleted person', () => {
    expect(isLayoutReusable(layout(['a', 'b']), ['a'])).toBe(false);
  });

  it('rejects a layout from an older schema version', () => {
    expect(isLayoutReusable({ ...layout(['a']), v: LAYOUT_VERSION - 1 }, ['a'])).toBe(false);
  });

  it('rejects null and malformed layouts', () => {
    expect(isLayoutReusable(null, ['a'])).toBe(false);
    expect(isLayoutReusable({ v: LAYOUT_VERSION } as SavedLayout, ['a'])).toBe(false);
  });
});

describe('buildElements', () => {
  it('routes children of a married couple through one junction node', () => {
    const persons = [person('dad'), person('mum'), person('kid')];
    const rels = [spouses('dad', 'mum', 'm1'), parentOf('dad', 'kid'), parentOf('mum', 'kid')];

    const { nodes, edges } = buildElements(persons, rels, theme);

    const couple = nodes.filter(n => n.data['coupleNode']);
    expect(couple).toHaveLength(1);

    // One descent edge from the junction, not one per parent.
    const descent = edges.filter(e => e.data['ek'] === 'descent');
    expect(descent).toHaveLength(1);
    expect(descent[0].data.source).toBe('_c_m1');
    expect(descent[0].data.target).toBe('kid');

    expect(edges.filter(e => e.data['ek'] === 'marriage')).toHaveLength(2);
  });

  it('keeps single-parent descent as a direct edge', () => {
    const { edges } = buildElements([person('mum'), person('kid')], [parentOf('mum', 'kid')], theme);

    const descent = edges.filter(e => e.data['ek'] === 'descent');
    expect(descent).toHaveLength(1);
    expect(descent[0].data.source).toBe('mum');
  });

  it('does not merge a child that belongs to only one of the spouses', () => {
    const rels = [spouses('dad', 'mum', 'm1'), parentOf('dad', 'stepkid')];
    const { edges } = buildElements([person('dad'), person('mum'), person('stepkid')], rels, theme);

    const descent = edges.filter(e => e.data['ek'] === 'descent');
    expect(descent).toHaveLength(1);
    expect(descent[0].data.source).toBe('dad');
  });

  it('preserves the Adoptive type on descent edges so they render dotted', () => {
    const rels: Relationship[] = [
      { id: 'r', treeId: 't', fromPersonId: 'guardian', toPersonId: 'kid', type: 'Adoptive' }
    ];
    const { edges } = buildElements([person('guardian'), person('kid')], rels, theme);
    expect(edges[0].data['relType']).toBe('Adoptive');
  });

  it('renders node images for full and compact variants', () => {
    const [node] = buildElements(
      [person('p', { firstName: 'Ada', lastName: 'Lovelace', birth: { year: 1815 }, death: { year: 1852 } })],
      [],
      theme
    ).nodes;
    const image = node.data['image'] as string;
    const imageCompact = node.data['imageCompact'] as string;
    expect(image.startsWith('data:image/svg+xml')).toBe(true);
    expect(decodeURIComponent(image)).toContain('Ada Lovelace');
    expect(imageCompact.startsWith('data:image/svg+xml')).toBe(true);
    expect(decodeURIComponent(imageCompact)).toContain('Lovelace');
  });
});

describe('personSearchText', () => {
  it('covers name, maiden name and birthplace, lowercased', () => {
    const text = personSearchText(
      person('p', { firstName: 'Marie', lastName: 'Escobar', maidenName: 'Smith', birthPlace: 'Bregenz' })
    );
    expect(text).toContain('marie');
    expect(text).toContain('smith');
    expect(text).toContain('bregenz');
  });

  it('also matches death place and notes', () => {
    const text = personSearchText(person('p', { deathPlace: 'Vienna', notes: 'Emigrated in 1920' }));
    expect(text).toContain('vienna');
    expect(text).toContain('emigrated');
  });
});
