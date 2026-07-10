import { Component, Input, OnInit, signal, inject, output } from '@angular/core';
import { ApiClient, MediaItem } from '../../core/api/api-client.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'qs-person-media',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <section class="media-section">
      <div class="media-header">
        <h3>{{ 'media.title' | translate }}</h3>
        <label class="btn sm" [class.disabled]="uploading()">
          @if (uploading()) { {{ 'media.uploading' | translate }} } @else { {{ 'media.add' | translate }} }
          <input #fileInput type="file" accept="image/*,.pdf,.mp3,.wav,.ogg"
                 multiple (change)="onFilesSelected($event)"
                 [disabled]="uploading()" style="display:none">
        </label>
      </div>

      @if (uploadErr()) {
        <p class="error-msg small">{{ uploadErr() }}</p>
      }

      @if (media().length === 0 && !loading()) {
        <div class="media-empty">{{ 'media.empty' | translate }}</div>
      }

      <div class="media-grid">
        @for (item of media(); track item.id) {
          <div class="media-item" [class.media-avatar]="isFirstPhoto(item)">
            @if (isImage(item)) {
              <img [src]="item.url" [alt]="item.caption || ''" loading="lazy">
            } @else {
              <div class="media-doc-icon">{{ docIcon(item) }}</div>
            }
            <div class="media-overlay">
              @if (item.caption) {
                <span class="media-caption">{{ item.caption }}</span>
              }
              <div class="media-overlay__actions">
                @if (isImage(item) && !isFirstPhoto(item)) {
                  <button class="media-action-btn" (click)="setAsAvatar(item)"
                          [title]="'media.setAvatar' | translate"
                          [attr.aria-label]="'media.setAvatar' | translate">★</button>
                }
                <button class="media-action-btn danger" (click)="deleteItem(item)" [title]="'delete' | translate">✕</button>
              </div>
            </div>
            @if (isFirstPhoto(item)) {
              <span class="media-avatar-badge">Avatar</span>
            }
          </div>
        }
        @if (uploading()) {
          <div class="media-item media-uploading">
            <div class="media-spinner"></div>
          </div>
        }
      </div>
    </section>
  `
})
export class PersonMediaComponent implements OnInit {
  @Input({ required: true }) personId!: string;
  readonly avatarChanged = output<string>();

  private api  = inject(ApiClient);
  readonly i18n = inject(I18nService);

  media     = signal<MediaItem[]>([]);
  loading   = signal(true);
  uploading = signal(false);
  uploadErr = signal('');

  ngOnInit() {
    this.api.getPersonMedia(this.personId).subscribe({
      next: m => { this.media.set(m); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;
    input.value = '';

    this.uploading.set(true);
    this.uploadErr.set('');

    const uploadNext = (index: number) => {
      if (index >= files.length) { this.uploading.set(false); return; }
      const file = files[index];
      const kind = file.type.startsWith('image/') ? 'Photo'
                 : file.type === 'application/pdf' ? 'Document'
                 : file.type.startsWith('audio/') ? 'Audio' : 'Document';

      this.api.uploadMedia(this.personId, file, undefined, kind).subscribe({
        next: item => {
          this.media.update(m => [...m, item]);
          if (kind === 'Photo' && this.media().filter(x => x.kind === 'Photo').length === 1) {
            this.avatarChanged.emit(item.url);
          }
          uploadNext(index + 1);
        },
        error: e => {
          this.uploadErr.set(e.error?.error ?? `${this.i18n.t('err.save')}: ${file.name}`);
          this.uploading.set(false);
        }
      });
    };
    uploadNext(0);
  }

  setAsAvatar(item: MediaItem) {
    const list = this.media();
    const photos = list.filter(m => m.kind === 'Photo');
    const others = photos.filter(m => m.id !== item.id);
    const newOrder = [item, ...others, ...list.filter(m => m.kind !== 'Photo')];
    this.media.set(newOrder);
    this.avatarChanged.emit(item.url);
  }

  deleteItem(item: MediaItem) {
    if (!confirm(this.i18n.t('media.deleteConfirm'))) return;
    this.api.deleteMedia(this.personId, item.id).subscribe({
      next: () => {
        const wasAvatar = this.isFirstPhoto(item);
        this.media.update(m => m.filter(x => x.id !== item.id));
        if (wasAvatar) {
          const next = this.media().find(m => m.kind === 'Photo');
          this.avatarChanged.emit(next?.url ?? '');
        }
      },
      error: e => alert(e.error?.error ?? this.i18n.t('err.delete'))
    });
  }

  isFirstPhoto(item: MediaItem): boolean {
    return this.media().find(m => m.kind === 'Photo')?.id === item.id;
  }

  isImage(item: MediaItem) {
    return item.kind === 'Photo' || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(item.url);
  }

  docIcon(item: MediaItem) {
    if (item.kind === 'Audio') return '🎵';
    if (/\.pdf$/i.test(item.url)) return '📄';
    return '📎';
  }
}
