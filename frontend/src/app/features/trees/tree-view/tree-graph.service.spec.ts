import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { TreeGraphService, GraphCallbacks } from './tree-graph.service';
import { ThemeService } from '../../../core/theme/theme.service';
import { PersonDto as Person } from '../../../core/api/generated';

/**
 * A minimal fake of the cytoscape Core surface `TreeGraphService` touches
 * during `build()`/`select()`/`runLayout()` — no real cytoscape instance or
 * layout algorithm is needed for the behaviour under test here.
 */
function createFakeCy() {
  const selectedCollection = { unselect: vi.fn(), select: vi.fn() };
  const layoutHandle = { on: vi.fn(), run: vi.fn() };
  return {
    on: vi.fn(),
    destroy: vi.fn(),
    style: vi.fn(),
    layout: vi.fn(() => layoutHandle),
    fit: vi.fn(),
    zoom: vi.fn(() => 1),
    resize: vi.fn(),
    animate: vi.fn(),
    nodes: vi.fn(() => [] as unknown[]),
    edges: vi.fn(() => [] as unknown[]),
    elements: vi.fn(() => ({ removeClass: vi.fn() })),
    getElementById: vi.fn(() => ({ nonempty: () => false })),
    $: vi.fn(() => selectedCollection),
    batch: vi.fn((fn: () => void) => fn()),
    width: vi.fn(() => 800),
    height: vi.fn(() => 600),
    selectedCollection
  };
}

type FakeCy = ReturnType<typeof createFakeCy>;
let instances: FakeCy[] = [];

vi.mock('cytoscape', () => {
  const factory = Object.assign(
    vi.fn(() => {
      const cy = createFakeCy();
      instances.push(cy);
      return cy;
    }),
    { use: vi.fn() }
  );
  return { default: factory };
});

vi.mock('cytoscape-dagre', () => ({ default: {} }));

function person(id: string): Person {
  return { id, treeId: 't1', firstName: id, lastName: 'Test', sex: 'Male' };
}

const callbacks: GraphCallbacks = { onSelect: vi.fn(), onOpen: vi.fn(), onContext: vi.fn() };

function setup() {
  instances = [];
  TestBed.configureTestingModule({
    providers: [TreeGraphService, { provide: ThemeService, useValue: { dark: () => false } }]
  });
  return TestBed.inject(TreeGraphService);
}

describe('TreeGraphService', () => {
  it('select(null) clears the cytoscape selection', async () => {
    const service = setup();
    await service.build(document.createElement('div'), [person('a')], [], callbacks);

    const cy = instances.at(-1)!;
    service.select(null);

    expect(cy.$).toHaveBeenCalledWith(':selected');
    expect(cy.selectedCollection.unselect).toHaveBeenCalled();
  });

  it('clears a selection left dangling by a reload that dropped that person', async () => {
    const service = setup();
    const container = document.createElement('div');

    await service.build(container, [person('a'), person('b')], [], callbacks);
    service.select('a');
    expect(service.selectedId()).toBe('a');

    // Reload without 'a' (e.g. it was just deleted) — must not leave a dangling
    // selection, or applyEmphasis treats it as real and dims the whole graph.
    await service.build(container, [person('b')], [], callbacks);
    expect(service.selectedId()).toBeNull();
  });

  it('registers the context-menu handler for both cxttap (desktop) and taphold (touch long-press)', async () => {
    const service = setup();
    await service.build(document.createElement('div'), [person('a')], [], callbacks);

    const cy = instances.at(-1)!;
    const nodeHandlers = new Map<string, unknown>(
      cy.on.mock.calls
        .filter((call: unknown[]) => call[1] === 'node')
        .map((call: unknown[]) => [call[0] as string, call[2]])
    );

    expect(nodeHandlers.has('cxttap')).toBe(true);
    expect(nodeHandlers.has('taphold')).toBe(true);
    // Same handler on both — a fix that adds a second, diverging callback is as buggy as missing one.
    expect(nodeHandlers.get('cxttap')).toBe(nodeHandlers.get('taphold'));
  });

  it('ignores a taphold fired by a slow mouse press but honours touch taphold and mouse cxttap', async () => {
    const service = setup();
    const localCallbacks: GraphCallbacks = { onSelect: vi.fn(), onOpen: vi.fn(), onContext: vi.fn() };
    await service.build(document.createElement('div'), [person('a')], [], localCallbacks);

    const cy = instances.at(-1)!;
    const nodeHandlers = new Map<string, (evt: unknown) => void>(
      cy.on.mock.calls
        .filter((call: unknown[]) => call[1] === 'node')
        .map((call: unknown[]) => [call[0] as string, call[2] as (evt: unknown) => void])
    );
    const fakeTarget = { data: vi.fn(() => undefined), id: vi.fn(() => 'a') };

    // A slow mouse press also emits 'taphold' in cytoscape — must not open the menu.
    nodeHandlers.get('taphold')!({ type: 'taphold', originalEvent: new MouseEvent('mousedown'), target: fakeTarget });
    expect(localCallbacks.onContext).not.toHaveBeenCalled();

    // A genuine one-finger long press on touch must still open it.
    nodeHandlers.get('taphold')!({ type: 'taphold', originalEvent: { touches: [{}] }, target: fakeTarget });
    expect(localCallbacks.onContext).toHaveBeenCalledTimes(1);

    // Desktop right-click (two-finger tap on touch) is unaffected.
    nodeHandlers.get('cxttap')!({ type: 'cxttap', originalEvent: new MouseEvent('contextmenu'), target: fakeTarget });
    expect(localCallbacks.onContext).toHaveBeenCalledTimes(2);
  });
});
