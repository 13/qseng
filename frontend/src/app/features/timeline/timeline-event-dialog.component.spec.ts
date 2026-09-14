import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TimelineEventDialogComponent } from './timeline-event-dialog.component';
import { TimelineApi } from '../../core/api/generated';
import { ToastService } from '../../core/ui/toast.service';
import { I18nService } from '../../core/i18n/i18n.service';

const spouse = { id: 'p2', treeId: 't1', firstName: 'Maria', lastName: 'Smith', sex: 'Female' as const };

function setup(data: object, fail = false) {
  const api = {
    timelineAdd: vi.fn(() => fail ? throwError(() => new HttpErrorResponse({ status: 400, error: { status: 400, title: 'v', errors: { title: ['Too long.'] } } })) : of({ id: 'e9', type: 'Custom', title: 'Saved' })),
    timelineUpdate: vi.fn(() => of({ id: 'e1', type: 'Move', title: 'Updated' }))
  };
  const ref = { close: vi.fn() };
  const toast = { errorFrom: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() };
  TestBed.configureTestingModule({ providers: [provideNoopAnimations(),
    { provide: MAT_DIALOG_DATA, useValue: data }, { provide: MatDialogRef, useValue: ref },
    { provide: TimelineApi, useValue: api }, { provide: ToastService, useValue: toast },
    { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k, eventLabel: (t: string) => t } }] });
  const fixture = TestBed.createComponent(TimelineEventDialogComponent);
  fixture.detectChanges();
  return { cmp: fixture.componentInstance, api, ref, toast };
}

describe('TimelineEventDialogComponent', () => {
  it('adds an event with start/end dates and closes with the DTO', () => {
    const { cmp, api, ref } = setup({ personId: 'p1', treePersons: [] });
    cmp.form.patchValue({ type: 'Occupation', title: 'Weaver', location: 'Bregenz', description: 'd', start: { year: 1868 }, end: { year: 1900 } });
    cmp.save();
    expect(api.timelineAdd).toHaveBeenCalledWith({ personId: 'p1', body: { type: 'Occupation', title: 'Weaver', location: 'Bregenz', description: 'd', start: { year: 1868 }, end: { year: 1900 }, metadataJson: null } });
    expect(ref.close).toHaveBeenCalledWith(expect.objectContaining({ id: 'e9' }));
  });

  it('prefills for edit and calls update', () => {
    const ev = { id: 'e1', type: 'Move' as const, title: 'Moved', start: { year: 1880 }, location: 'Wien' };
    const { cmp, api } = setup({ personId: 'p1', treePersons: [], event: ev });
    expect(cmp.form.value.title).toBe('Moved');
    cmp.save();
    expect(api.timelineUpdate).toHaveBeenCalledWith({ personId: 'p1', id: 'e1', body: expect.objectContaining({ title: 'Moved', location: 'Wien' }) });
  });

  it('picking a spouse for a marriage fills the title', () => {
    const { cmp } = setup({ personId: 'p1', treePersons: [spouse] });
    cmp.form.controls.type.setValue('Marriage');
    cmp.pickSpouse(spouse);
    expect(cmp.form.value.title).toContain('Maria Smith');
  });

  it('maps validation problems and stays open', () => {
    const { cmp, ref } = setup({ personId: 'p1', treePersons: [] }, true);
    cmp.form.patchValue({ title: 'x' });
    cmp.save();
    expect(ref.close).not.toHaveBeenCalled();
    expect(cmp.form.controls.title.errors).toEqual({ server: 'Too long.' });
  });
});
