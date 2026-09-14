import { ChangeDetectionStrategy, Component, Input, OnInit, signal, inject, output } from '@angular/core';
import { ApiClient, MediaItem } from '../../core/api/api-client.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'qs-person-media',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
        <p class="error-msg small" role="alert">{{ uploadErr() }}</p>
      }

      @if (media().length === 0 && !loading()) {
        <div class="media-empty">{{ 'media.empty' | translate }}</div>
      }

      <div class="media-grid">
        @for (item of media(); track item.id) {
          <div class="media-item" [class.media-avatar]="item.isAvatar">
            @if (isImage(item)) {
              <img [src]="item.url" [alt]="item.caption || ''" loading="lazy">
            } @else {
              <div class="media-doc-icon" aria-hidden="true">{{ docIcon(item) }}</div>
            }
            <div class="media-overlay">
              @if (item.caption) {
                <span class="media-caption">{{ item.caption }}</span>
              }
              <div class="media-overlay__actions">
                @if (isImage(item) && !item.isAvatar) {
                  <button class="media-action-btn" (click)="setAsAvatar(item)"
                          [disabled]="settingAvatar()"
                          [title]="'media.setAvatar' | translate"
                          [attr.aria-label]="'media.setAvatar' | translate">★</button>
                }
                <button class="media-action-btn danger" (click)="deleteItem(item)"
                        [title]="'delete' | translate"
                        [attr.aria-label]="'delete' | translate">✕</button>
              </div>
            </div>
            @if (item.isAvatar) {
              <span class="media-avatar-badge">{{ 'media.avatarBadge' | translate }}</span>
            }
          </div>
        }
        @if (uploading()) {
          <div class="media-item media-uploading">
            <div class="media-spinner" role="status" [attr.aria-label]="'media.uploading' | translate"></div>
          </div>
        }
      </div>
    </section>
  `
})
export class PersonMediaComponent implements OnInit {
  @Input({ required: true }) personId!: string;
  readonly avatarChanged = output<string>();

  private readonly api = inject(ApiClient);
  readonly i18n = inject(I18nService);

  readonly media = signal<MediaItem[]>([]);
  readonly loading = signal(true);
  readonly uploading = signal(false);
  readonly settingAvatar = signal(false);
  readonly uploadErr = signal('');

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
          // The server marks the first photo as the avatar.
          if (item.isAvatar) this.avatarChanged.emit(item.url);
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
    this.settingAvatar.set(true);
    this.uploadErr.set('');
    this.api.setAvatar(this.personId, item.id).subscribe({
      next: () => {
        this.media.update(list => list.map(m => ({ ...m, isAvatar: m.id === item.id })));
        this.avatarChanged.emit(item.url);
        this.settingAvatar.set(false);
      },
      error: e => {
        this.uploadErr.set(e.error?.error ?? this.i18n.t('err.save'));
        this.settingAvatar.set(false);
      }
    });
  }

  deleteItem(item: MediaItem) {
    if (!confirm(this.i18n.t('media.deleteConfirm'))) return;
    this.api.deleteMedia(this.personId, item.id).subscribe({
      next: () => {
        this.media.update(m => m.filter(x => x.id !== item.id));
        if (!item.isAvatar) return;

        // The server promotes the next photo; mirror that locally.
        const next = this.media().find(m => m.kind === 'Photo');
        if (next) this.media.update(list => list.map(m => ({ ...m, isAvatar: m.id === next.id })));
        this.avatarChanged.emit(next?.url ?? '');
      },
      error: e => this.uploadErr.set(e.error?.error ?? this.i18n.t('err.delete'))
    });
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
