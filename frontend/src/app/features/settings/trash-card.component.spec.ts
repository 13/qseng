import { TestBed } from '@angular/core/testing';
import { DatePipe } from '@angular/common';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TrashCardComponent } from './trash-card.component';
import { PersonsApi, TrashApi, TrashedPersonDto } from '../../core/api/generated';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import { ToastService } from '../../core/ui/toast.service';
import { I18nService } from '../../core/i18n/i18n.service';

const items: TrashedPersonDto[] = [
  { id: 'p1', firstName: 'Anna', lastName: 'Smith', treeId: 't1', treeName: 'Smith Family', deletedAt: '2026-01-01T00:00:00Z', purgeAt: '2026-01-31T00:00:00Z' },
  { id: 'p2', firstName: 'Bob', lastName: 'Jones', treeId: 't2', treeName: 'Jones Family', deletedAt: '2026-02-05T00:00:00Z', purgeAt: '2026-03-07T00:00:00Z' }
];

// The stub's t() echoes the key except for the two keys under test, which carry a real
// placeholder so replace('__DAYS__'/'__NAME__', ...) has something to substitute.
const dict: Record<string, string> = {
  'trash.hint': 'stays __DAYS__ days',
  'trash.purgeConfirm': 'remove __NAME__?'
};

function setup(listResult: TrashedPersonDto[] = items, confirmResult: boolean | string = true) {
  TestBed.resetTestingModule();
  const trashApi = { trashList: vi.fn(() => of({ retentionDays: 30, items: listResult })), trashPurge: vi.fn(() => of(undefined)) };
  const personsApi = { personsRestore: vi.fn(() => of({})) };
  const confirm = { confirm: vi.fn(async () => confirmResult) };
  const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), errorFrom: vi.fn() };
  const i18n = { t: (k: string) => dict[k] ?? k, dynamic: (k: string) => dict[k] ?? k };
  TestBed.configureTestingModule({
    providers: [
      provideNoopAnimations(),
      { provide: TrashApi, useValue: trashApi }, { provide: PersonsApi, useValue: personsApi },
      { provide: ConfirmDialogService, useValue: confirm }, { provide: ToastService, useValue: toast },
      { provide: I18nService, useValue: i18n }
    ]
  });
  const fixture = TestBed.createComponent(TrashCardComponent);
  fixture.detectChanges();
  return { fixture, trashApi, personsApi, confirm, toast, cmp: fixture.componentInstance };
}

describe('TrashCardComponent', () => {
  it('renders one row per item with name, tree and formatted dates, and the hint with __DAYS__ replaced', () => {
    const { fixture } = setup();
    const el = fixture.nativeElement as HTMLElement;
    const rows = el.querySelectorAll('table tbody tr');
    expect(rows.length).toBe(2);

    const dp = new DatePipe('en-US');
    const rowText = (i: number) => rows[i].textContent ?? '';
    expect(rowText(0)).toContain('Anna Smith');
    expect(rowText(0)).toContain('Smith Family');
    expect(rowText(0)).toContain(dp.transform(items[0].deletedAt, 'mediumDate')!);
    expect(rowText(0)).toContain(dp.transform(items[0].purgeAt, 'mediumDate')!);
    expect(rowText(1)).toContain('Bob Jones');
    expect(rowText(1)).toContain('Jones Family');

    expect(el.textContent).toContain('stays 30 days');
  });

  it('shows trash.empty when the list is empty', () => {
    const { fixture } = setup([]);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('table')).toBeNull();
    expect(el.textContent).toContain('trash.empty');
  });

  it('Restore calls personsRestore with the id, reloads, and toasts trash.restored', () => {
    const { fixture, personsApi, trashApi, toast } = setup();
    const el = fixture.nativeElement as HTMLElement;
    const restoreBtn = el.querySelectorAll('.qs-col-actions button')[0] as HTMLButtonElement;
    trashApi.trashList.mockClear();
    restoreBtn.click();
    fixture.detectChanges();

    expect(personsApi.personsRestore).toHaveBeenCalledWith({ id: 'p1' });
    expect(trashApi.trashList).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('trash.restored');
  });

  it('Delete now confirms with the name, then on true calls trashPurge and reloads; on false calls nothing', async () => {
    const { fixture, confirm, trashApi } = setup();
    const el = fixture.nativeElement as HTMLElement;
    const purgeBtn = el.querySelectorAll('.qs-col-actions button')[1] as HTMLButtonElement;
    trashApi.trashList.mockClear();

    purgeBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(confirm.confirm).toHaveBeenCalledWith(expect.objectContaining({ message: 'remove Anna Smith?' }));
    expect(trashApi.trashPurge).toHaveBeenCalledWith({ personId: 'p1' });
    expect(trashApi.trashList).toHaveBeenCalled();
  });

  it('firing purge() twice before the confirm dialog resolves only calls trashPurge once', async () => {
    const { cmp, confirm, trashApi } = setup();
    trashApi.trashList.mockClear();

    const first = cmp.purge(items[0]);
    const second = cmp.purge(items[0]);
    await Promise.all([first, second]);

    expect(confirm.confirm).toHaveBeenCalledTimes(1);
    expect(trashApi.trashPurge).toHaveBeenCalledTimes(1);
    expect(cmp.busy()).toBe(false);
  });

  it('Delete now does nothing further when the confirm dialog is cancelled', async () => {
    const { fixture, confirm, trashApi } = setup(items, false);
    const el = fixture.nativeElement as HTMLElement;
    const purgeBtn = el.querySelectorAll('.qs-col-actions button')[1] as HTMLButtonElement;
    trashApi.trashList.mockClear();

    purgeBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(confirm.confirm).toHaveBeenCalled();
    expect(trashApi.trashPurge).not.toHaveBeenCalled();
    expect(trashApi.trashList).not.toHaveBeenCalled();
  });
});
