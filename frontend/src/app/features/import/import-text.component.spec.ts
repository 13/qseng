import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ImportTextComponent } from './import-text.component';
import { ImportApi, TreesApi } from '../../core/api/generated';
import { ToastService } from '../../core/ui/toast.service';
import { BreadcrumbService } from '../../core/ui/breadcrumb.service';
import { I18nService } from '../../core/i18n/i18n.service';

function setup() {
  const api = {
    importPreview: vi.fn(() => of({ personsCreated: 2, relationshipsCreated: 1, warnings: ['Line 3 skipped'], isDryRun: true })),
    importCommit: vi.fn(() => of({ personsCreated: 2, relationshipsCreated: 1, warnings: [], isDryRun: false }))
  };
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideNoopAnimations(),
    { provide: ImportApi, useValue: api }, { provide: TreesApi, useValue: { treesGetAll: vi.fn(() => of([{ id: 't1', name: 'Familie' }])) } },
    { provide: ToastService, useValue: { success: vi.fn(), errorFrom: vi.fn(), error: vi.fn(), info: vi.fn() } },
    { provide: BreadcrumbService, useValue: { set: vi.fn() } },
    { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k } }] });
  const fixture = TestBed.createComponent(ImportTextComponent);
  fixture.componentRef.setInput('treeId', 't1');
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance, api };
}

describe('ImportTextComponent', () => {
  it('previews, shows counts and warnings, then commits', () => {
    const { cmp, api, fixture } = setup();
    cmp.text.setValue('Max Mustermann * 1880');
    cmp.preview();
    fixture.detectChanges();
    expect(api.importPreview).toHaveBeenCalledWith({ treeId: 't1', body: { text: 'Max Mustermann * 1880' } });
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Line 3 skipped');
    expect(cmp.step()).toBe('preview');
    cmp.commit();
    fixture.detectChanges();
    expect(api.importCommit).toHaveBeenCalledWith({ treeId: 't1', body: { text: 'Max Mustermann * 1880' } });
    expect(cmp.step()).toBe('done');
    expect((fixture.nativeElement as HTMLElement).querySelector('a[href="/trees/t1"]')).not.toBeNull();
  });

  it('does not preview empty text', () => {
    const { cmp, api } = setup();
    cmp.preview();
    expect(api.importPreview).not.toHaveBeenCalled();
  });
});
