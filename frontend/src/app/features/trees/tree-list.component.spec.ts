import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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

function setup(list = trees, dialogResult: unknown = undefined, confirmResult = true) {
  const api = {
    treesGetAll: vi.fn(() => of(list)),
    treesCreate: vi.fn(() => of({ id: 't3', name: 'New', personCount: 0, createdAt: '2026-09-03T00:00:00Z' })),
    treesUpdate: vi.fn(() => of({ ...list[0], name: 'Renamed' })),
    treesDelete: vi.fn(() => of(undefined))
  };
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(dialogResult) })) };
  const confirm = { confirm: vi.fn(async () => confirmResult) };
  const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), errorFrom: vi.fn() };
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
      { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k, lang: () => 'en' } }
    ]
  });
  const fixture = TestBed.createComponent(TreeListComponent);
  fixture.detectChanges();
  return { fixture, api, dialog, confirm, toast, cmp: fixture.componentInstance };
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

  it('deletes only after confirmation', async () => {
    const declined = setup(trees, undefined, false);
    await declined.cmp.remove(trees[0]);
    expect(declined.api.treesDelete).not.toHaveBeenCalled();

    const accepted = setup(trees, undefined, true);
    await accepted.cmp.remove(trees[0]);
    expect(accepted.api.treesDelete).toHaveBeenCalledWith({ id: 't1' });
  });
});
