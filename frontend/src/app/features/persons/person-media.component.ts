import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { MediaApi, MediaDto, MediaKind } from '../../core/api/generated';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import { ToastService } from '../../core/ui/toast.service';
import { PersonStore } from './person.store';
import { MediaLightboxComponent } from './media-lightbox.component';

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export function kindFor(file: File): MediaKind {
  if (file.type.startsWith('image/')) return 'Photo';
  if (file.type.startsWith('audio/')) return 'Audio';
  return 'Document';
}

@Component({
  selector: 'qs-person-media',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatProgressBarModule, TranslatePipe],
  template: `
    <div class="qs-media__header">
      <h2>{{ 'media.title' | translate }}</h2>
      <button matButton="tonal" (click)="fileInput.click()" [disabled]="uploading()"><mat-icon>upload</mat-icon>{{ 'media.add' | translate }}</button>
      <input #fileInput type="file" accept="image/*,application/pdf,audio/*" multiple hidden (change)="onPicked($event)">
    </div>
    <div class="qs-dropzone" [class.qs-dropzone--over]="dragOver()"
         (dragover)="onDragOver($event)" (dragleave)="dragOver.set(false)" (drop)="onDrop($event)">
      <mat-icon aria-hidden="true">cloud_upload</mat-icon>
      <span class="qs-muted">{{ 'media.dropHint' | translate }} <button matButton type="button" (click)="fileInput.click()">{{ 'media.add' | translate }}</button></span>
    </div>
    @if (uploading()) { <mat-progress-bar mode="indeterminate" /> }
    @if (!store.media().length && !uploading()) { <p class="qs-muted">{{ 'media.empty' | translate }}</p> }
    <div class="qs-media__grid">
      @for (item of store.media(); track item.id) {
        <figure class="qs-media__item" [attr.data-media-id]="item.id">
          @if (item.kind === 'Photo') {
            <button type="button" class="qs-media__thumb" (click)="open(item)" [attr.aria-label]="('media.open' | translate) + ': ' + (item.caption || '')">
              <img [src]="item.url" [alt]="item.caption || ''" loading="lazy">
            </button>
          } @else {
            <a class="qs-media__thumb qs-media__doc" [href]="item.url" target="_blank" rel="noopener">
              <mat-icon aria-hidden="true">{{ item.kind === 'Audio' ? 'audio_file' : 'description' }}</mat-icon>
            </a>
          }
          <figcaption class="qs-media__caption">
            <span class="qs-media__text">{{ item.caption || '' }}</span>
            @if (item.isAvatar) { <span class="qs-media__badge">{{ 'media.avatarBadge' | translate }}</span> }
            <button matIconButton [matMenuTriggerFor]="menu" [attr.aria-label]="'admin.actions' | translate"><mat-icon>more_vert</mat-icon></button>
            <mat-menu #menu="matMenu">
              @if (item.kind === 'Photo' && !item.isAvatar) { <button mat-menu-item (click)="setAvatar(item)"><mat-icon>account_circle</mat-icon>{{ 'media.setAvatar' | translate }}</button> }
              <button mat-menu-item (click)="remove(item)"><mat-icon>delete</mat-icon>{{ 'delete' | translate }}</button>
            </mat-menu>
          </figcaption>
        </figure>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .qs-media__header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
    .qs-media__header h2 { font-size: 1.15rem; }
    .qs-dropzone { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 16px; border: 2px dashed var(--mat-sys-outline-variant); border-radius: var(--mat-sys-corner-medium); margin-bottom: 12px; }
    .qs-dropzone--over { border-color: var(--mat-sys-primary); background: var(--mat-sys-primary-container); }
    .qs-media__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
    .qs-media__item { margin: 0; border: 1px solid var(--mat-sys-outline-variant); border-radius: var(--mat-sys-corner-medium); overflow: hidden; background: var(--mat-sys-surface-container-lowest); }
    .qs-media__thumb { display: block; width: 100%; aspect-ratio: 1; padding: 0; border: 0; background: var(--mat-sys-surface-container); cursor: pointer; }
    .qs-media__thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .qs-media__doc { display: grid; place-items: center; color: var(--mat-sys-primary); }
    .qs-media__doc mat-icon { font-size: 40px; width: 40px; height: 40px; }
    .qs-media__caption { display: flex; align-items: center; gap: 4px; padding: 4px 4px 4px 8px; font-size: .85rem; }
    .qs-media__text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .qs-media__badge { font-size: .7rem; padding: 2px 6px; border-radius: 999px; background: var(--mat-sys-primary-container); color: var(--mat-sys-on-primary-container); }
  `]
})
export class PersonMediaComponent {
  readonly store = inject(PersonStore);
  private readonly api = inject(MediaApi);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly uploading = signal(false);
  readonly dragOver = signal(false);

  onPicked(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    void this.upload(files);
  }
  onDragOver(e: DragEvent) { e.preventDefault(); this.dragOver.set(true); }
  onDrop(e: DragEvent) { e.preventDefault(); this.dragOver.set(false); void this.upload(Array.from(e.dataTransfer?.files ?? [])); }

  async upload(files: File[]) {
    const personId = this.store.person()?.id;
    if (!personId || !files.length) return;
    const accepted = files.filter(f => {
      if (f.size > MAX_UPLOAD_BYTES) { this.toast.error(this.i18n.t('media.tooLarge').replace('__NAME__', f.name)); return false; }
      return true;
    });
    if (!accepted.length) return;
    this.uploading.set(true);
    let done = 0;
    for (const file of accepted) {
      try {
        const item = await firstValueFrom(this.api.mediaUpload({ personId, body: { file, kind: kindFor(file) } }));
        this.store.addMedia(item);
        done++;
      } catch (err) {
        this.toast.errorFrom(err, `${this.i18n.t('err.save')}: ${file.name}`);
        break;
      }
    }
    this.uploading.set(false);
    if (done) this.toast.success(this.i18n.t('media.uploaded.toast').replace('__N__', String(done)));
  }

  setAvatar(item: MediaDto) {
    const personId = this.store.person()?.id;
    if (!personId || !item.id) return;
    const mediaId = item.id;
    this.api.mediaSetAvatar({ personId, mediaId }).subscribe({
      next: () => { this.store.setAvatar(mediaId); this.toast.success(this.i18n.t('media.avatarSet.toast')); },
      error: e => this.toast.errorFrom(e, this.i18n.t('err.save'))
    });
  }

  async remove(item: MediaDto) {
    const personId = this.store.person()?.id;
    if (!personId || !item.id) return;
    const ok = await this.confirm.confirm({ title: this.i18n.t('media.deleteTitle'), message: this.i18n.t('media.deleteConfirm'), confirmLabel: this.i18n.t('delete'), destructive: true });
    if (ok !== true) return;
    const mediaId = item.id;
    const wasAvatar = item.isAvatar === true;
    this.api.mediaDelete({ personId, mediaId }).subscribe({
      next: () => {
        this.store.removeMedia(mediaId);
        if (wasAvatar) this.store.reloadMedia();
        this.toast.success(this.i18n.t('media.deleted.toast'));
      },
      error: e => this.toast.errorFrom(e, this.i18n.t('err.delete'))
    });
  }

  open(item: MediaDto) { this.dialog.open(MediaLightboxComponent, { data: item, maxWidth: '95vw', autoFocus: 'dialog' }); }
}
