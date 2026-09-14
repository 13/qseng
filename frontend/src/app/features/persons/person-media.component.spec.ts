import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { PersonMediaComponent, kindFor } from './person-media.component';
import { PersonStore } from './person.store';
import { MediaApi } from '../../core/api/generated';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import { ToastService } from '../../core/ui/toast.service';
import { I18nService } from '../../core/i18n/i18n.service';

const media = [
  { id: 'm1', personId: 'p1', url: '/u/a.jpg', kind: 'Photo' as const, isAvatar: true },
  { id: 'm2', personId: 'p1', url: '/u/b.pdf', kind: 'Document' as const, isAvatar: false, caption: 'Certificate' }
];

function setup(confirmResult = true) {
  const store = { person: signal({ id: 'p1' }), media: signal(media), addMedia: vi.fn(), removeMedia: vi.fn(), setAvatar: vi.fn(), reloadMedia: vi.fn() };
  const api = {
    mediaUpload: vi.fn(() => of({ id: 'm3', personId: 'p1', url: '/u/c.png', kind: 'Photo', isAvatar: false })),
    mediaSetAvatar: vi.fn(() => of(undefined)), mediaDelete: vi.fn(() => of(undefined))
  };
  const confirm = { confirm: vi.fn(async () => confirmResult) };
  const toast = { success: vi.fn(), error: vi.fn(), errorFrom: vi.fn(), info: vi.fn() };
  TestBed.configureTestingModule({ providers: [provideNoopAnimations(),
    { provide: PersonStore, useValue: store }, { provide: MediaApi, useValue: api }, { provide: ConfirmDialogService, useValue: confirm },
    { provide: ToastService, useValue: toast }, { provide: MatDialog, useValue: { open: vi.fn(() => ({ afterClosed: () => of(undefined) })) } },
    { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k } }] });
  const fixture = TestBed.createComponent(PersonMediaComponent);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance, store, api, toast };
}

describe('PersonMediaComponent', () => {
  it('derives the media kind from the MIME type', () => {
    expect(kindFor(new File([''], 'a.jpg', { type: 'image/jpeg' }))).toBe('Photo');
    expect(kindFor(new File([''], 'a.pdf', { type: 'application/pdf' }))).toBe('Document');
    expect(kindFor(new File([''], 'a.mp3', { type: 'audio/mpeg' }))).toBe('Audio');
    expect(kindFor(new File([''], 'a.bin', { type: '' }))).toBe('Document');
  });

  it('renders thumbnails and the avatar badge', () => {
    const { fixture } = setup();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('[data-media-id]').length).toBe(2);
    expect(el.textContent).toContain('media.avatarBadge');
    expect(el.textContent).toContain('Certificate');
  });

  it('uploads files sequentially, adds them to the store and toasts once', async () => {
    const { cmp, api, store, toast } = setup();
    await cmp.upload([new File(['x'], 'c.png', { type: 'image/png' }), new File(['y'], 'd.png', { type: 'image/png' })]);
    expect(api.mediaUpload).toHaveBeenCalledTimes(2);
    expect(api.mediaUpload).toHaveBeenCalledWith({ personId: 'p1', body: { file: expect.any(File), kind: 'Photo' } });
    expect(store.addMedia).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledWith('media.uploaded.toast'.replace('__N__', '2'));
  });

  it('rejects files over 20 MB without calling the API', async () => {
    const { cmp, api, toast } = setup();
    const big = new File([new Uint8Array(1)], 'big.png', { type: 'image/png' });
    Object.defineProperty(big, 'size', { value: 21 * 1024 * 1024 });
    await cmp.upload([big]);
    expect(api.mediaUpload).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it('sets the avatar and deletes after confirm', async () => {
    const { cmp, api, store } = setup(true);
    cmp.setAvatar(media[1]);
    expect(api.mediaSetAvatar).toHaveBeenCalledWith({ personId: 'p1', mediaId: 'm2' });
    expect(store.setAvatar).toHaveBeenCalledWith('m2');
    await cmp.remove(media[0]);
    expect(api.mediaDelete).toHaveBeenCalledWith({ personId: 'p1', mediaId: 'm1' });
    expect(store.removeMedia).toHaveBeenCalledWith('m1');
  });
});
