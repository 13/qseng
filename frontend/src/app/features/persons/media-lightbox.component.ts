import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MediaDto } from '../../core/api/generated';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'qs-media-lightbox',
  imports: [MatDialogModule, MatButtonModule, TranslatePipe],
  template: `
    <mat-dialog-content class="qs-lightbox">
      <img [src]="item.url" [alt]="item.caption || ''">
      @if (item.caption) { <p class="qs-lightbox__caption">{{ item.caption }}</p> }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <a matButton [href]="item.url" target="_blank" rel="noopener">{{ 'media.open' | translate }}</a>
      <button matButton="filled" mat-dialog-close>{{ 'cancel' | translate }}</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .qs-lightbox { display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .qs-lightbox img { max-width: min(90vw, 1000px); max-height: 75vh; object-fit: contain; border-radius: var(--mat-sys-corner-small); }
    .qs-lightbox__caption { margin: 0; color: var(--mat-sys-on-surface-variant); }
  `]
})
export class MediaLightboxComponent { readonly item = inject<MediaDto>(MAT_DIALOG_DATA); }
