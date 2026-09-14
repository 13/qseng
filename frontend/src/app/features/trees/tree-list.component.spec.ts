import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TreeListComponent } from './tree-list.component';
import { TreesApi } from '../../core/api/generated';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import { ToastService } from '../../core/ui/toast.service';
import { I18nService } from '../../core/i18n/i18n.service';

const trees = [
  { id: 't1', name: 'Familie Escobar', description: 'Fünf Generationen', createdAt: '2026-09-01T00:00:00Z', personCount: 42 },
  { id: 't2', name: 'Smith', description: null, createdAt: '2026-09-02T00:00:00Z', personCount: 0 }
];

function setup(list = trees, dialogResult: unknown = undefined, confirmResult = true, queryParams: Record<string, string> = {}) {
  const api = {
    treesGetAll: vi.fn(() => of(list)),
    treesCreate: vi.fn(() => of({ id: 't3', name: 'New', personCount: 0, createdAt: '2026-09-03T00:00:00Z' })),
    treesUpdate: vi.fn(() => of({ ...list[0], name: 'Renamed' })),
    treesDelete: vi.fn(() => of(undefined))
  };
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(dialogResult) })) };
  const confirm = { confirm: vi.fn(async () => confirmResult) };
  const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), errorFrom: vi.fn() };
  const route = { queryParamMap: of(convertToParamMap(queryParams)) };
  // Reset first: the "deletes only after confirmation" test calls setup() twice
  // in one `it`, and TestBed forbids reconfiguring after it's been instantiated.
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideNoopAnimations(),
      provideRouter([]),
      { provide: TreesApi, useValue: api },
      { provide: MatDialog, useValue: dialog },
      { provide: ConfirmDialogService, useValue: confirm },
      { provide: ToastService, useValue: toast },
      { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k, lang: () => 'en' } },
      { provide: ActivatedRoute, useValue: route }
    ]
  });
  const router = TestBed.inject(Router);
  vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(TreeListComponent);
  fixture.detectChanges();
  return { fixture, api, dialog, confirm, toast, router, cmp: fixture.componentInstance };
}

describe('TreeListComponent', () => {
  it('renders one card per tree with name and people count', () => {
    const { fixture } = setup();
    const el: HTMLElement = fixture.nativeElement;
    const cards = el.querySelectorAll('mat-card');
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('Familie Escobar');
    expect(cards[0].textContent).toContain('42');
  });

  it('shows the empty state when there are no trees', () => {
    const { fixture } = setup([]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('trees.emptyTitle');
  });

  it('reloads and toasts success when the dialog closes with the created tree, without calling the API itself', async () => {
    const { cmp, api, toast } = setup(trees, { id: 't3', name: 'New', description: null });
    await cmp.openCreate();
    expect(api.treesCreate).not.toHaveBeenCalled();
    expect(api.treesGetAll).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledWith('trees.created.toast');
  });

  it('opens the create dialog once for ?new=1, then clears the query param', async () => {
    const { dialog, router } = setup(trees, { id: 't3', name: 'New', description: null }, true, { new: '1' });
    await Promise.resolve(); await Promise.resolve();
    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith([], { queryParams: {}, replaceUrl: true });
  });

  it('does not open the create dialog without ?new=1', async () => {
    const { dialog } = setup();
    await Promise.resolve(); await Promise.resolve();
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('shows the hero actions in the empty state', () => {
    const { fixture } = setup([]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('onb.start');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('onb.importInstead');
  });

  it('startOnboarding lazy-loads the stepper and, on success, toasts and navigates to the tree with the created person selected', async () => {
    const { cmp, dialog, toast, router } = setup(trees, { treeId: 't9', personId: 'p9' });
    await cmp.startOnboarding();
    expect(dialog.open).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ width: '640px', maxWidth: '95vw' }));
    expect(toast.success).toHaveBeenCalledWith('onb.ready');
    expect(router.navigate).toHaveBeenCalledWith(['/trees', 't9'], { queryParams: { select: 'p9' } });
  });

  it('startOnboarding does nothing further when the dialog closes without a result', async () => {
    const { cmp, toast, router } = setup(trees, undefined);
    await cmp.startOnboarding();
    expect(toast.success).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('importInstead creates a tree, then navigates straight to its import page without reloading the list', async () => {
    const { cmp, api, router } = setup(trees, { id: 't9', name: 'New', personCount: 0 });
    await cmp.importInstead();
    expect(api.treesGetAll).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/trees', 't9', 'import']);
  });

  it('importInstead does nothing when the create dialog is cancelled', async () => {
    const { cmp, router } = setup(trees, undefined);
    await cmp.importInstead();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('deletes only after confirmation', async () => {
    const declined = setup(trees, undefined, false);
    await declined.cmp.remove(trees[0]);
    expect(declined.api.treesDelete).not.toHaveBeenCalled();

    const accepted = setup(trees, undefined, true);
    await accepted.cmp.remove(trees[0]);
    expect(accepted.api.treesDelete).toHaveBeenCalledWith({ id: 't1' });
  });
});
