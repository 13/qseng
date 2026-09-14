import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { MediaApi, MediaDto, MediaKind } from '../../core/api/generated';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
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
    <div class="qs-section-header">
      <h2>{{ 'media.title' | translate }}</h2>
      <button matButton="tonal" (click)="fileInput.click()" [disabled]="uploading()"><mat-icon>upload</mat-icon>{{ 'media.add' | translate }}</button>
      <input #fileInput type="file" accept="image/*,application/pdf,audio/*" multiple hidden (change)="onPicked($event)">
    </div>
    <div class="qs-dropzone" [class.qs-dropzone--over]="dragOver()"
         (dragenter)="onDragEnter($event)" (dragover)="onDragOver($event)" (dragleave)="onDragLeave($event)" (drop)="onDrop($event)">
      <mat-icon aria-hidden="true">cloud_upload</mat-icon>
      <span class="qs-muted">{{ 'media.dropHint' | translate }} <button matButton type="button" (click)="fileInput.click()">{{ 'media.add' | translate }}</button></span>
    </div>
    @if (uploading()) { <mat-progress-bar mode="indeterminate" /> }
    @if (!store.media().length && !uploading()) {
      <div class="qs-empty"><mat-icon class="qs-empty__icon" aria-hidden="true">photo_library</mat-icon><p class="qs-muted">{{ 'media.empty' | translate }}</p></div>
    }
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
            <button matIconButton [matMenuTriggerFor]="menu" [attr.aria-label]="('media.actions' | translate) + (item.caption ? ': ' + item.caption : '')"><mat-icon>more_vert</mat-icon></button>
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
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly uploading = signal(false);
  readonly dragDepth = signal(0);
  readonly dragOver = computed(() => this.dragDepth() > 0);

  onPicked(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    void this.upload(files);
  }
  onDragEnter(e: DragEvent) { e.preventDefault(); this.dragDepth.update(d => d + 1); }
  onDragOver(e: DragEvent) { e.preventDefault(); }
  onDragLeave(e: DragEvent) { e.preventDefault(); this.dragDepth.update(d => Math.max(0, d - 1)); }
  onDrop(e: DragEvent) {
    e.preventDefault();
    this.dragDepth.set(0);
    const dropped = Array.from(e.dataTransfer?.files ?? []);
    const accepted = dropped.filter(f => this.isAcceptedType(f));
    void this.upload(accepted, dropped.length - accepted.length);
  }

  private isAcceptedType(file: File): boolean {
    return file.type.startsWith('image/') || file.type === 'application/pdf' || file.type.startsWith('audio/');
  }

  async upload(files: File[], initialFailed = 0) {
    const personId = this.store.person()?.id;
    if (!personId) return;
    let failed = initialFailed;
    const oversizedNames: string[] = [];
    const accepted = files.filter(f => {
      if (f.size > MAX_UPLOAD_BYTES) { oversizedNames.push(f.name); failed++; return false; }
      return true;
    });
    if (oversizedNames.length) this.toast.error(this.i18n.t('media.tooLarge').replace('__NAME__', oversizedNames.join(', ')));
    let done = 0;
    if (accepted.length) {
      this.uploading.set(true);
      for (const file of accepted) {
        try {
          const item = await firstValueFrom(this.api.mediaUpload({ personId, body: { file, kind: kindFor(file) } }));
          this.store.addMedia(item);
          done++;
        } catch (err) {
          failed++;
          if (failed === 1) this.toast.errorFrom(err, `${this.i18n.t('err.save')}: ${file.name}`);
          continue;
        }
      }
      this.uploading.set(false);
    }
    if (done) this.toast.success(this.i18n.t('media.uploaded.toast').replace('__N__', String(done)));
    if (failed) this.toast.error(this.i18n.t('media.failed.toast').replace('__N__', String(failed)));
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

  remove(item: MediaDto) {
    const personId = this.store.person()?.id;
    if (!personId || !item.id) return;
    const mediaId = item.id;
    const wasAvatar = item.isAvatar === true;
    this.api.mediaDelete({ personId, mediaId }).subscribe({
      next: () => {
        this.store.removeMedia(mediaId);
        if (wasAvatar) this.store.reloadMedia();
        this.toast.undoable(this.i18n.t('media.deleted.undo'), () => firstValueFrom(this.api.mediaRestore({ personId, mediaId })).then(() => {
          this.store.reloadMedia();
        }));
      },
      error: e => this.toast.errorFrom(e, this.i18n.t('err.delete'))
    });
  }

  open(item: MediaDto) { this.dialog.open(MediaLightboxComponent, { data: item, maxWidth: '95vw', autoFocus: 'dialog', ariaLabel: item.caption || this.i18n.t('media.open') }); }
}
