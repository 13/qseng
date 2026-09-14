import { Component, inject, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { I18nService, Lang } from '../../core/i18n/i18n.service';

/** Centered card with brand header and language toggle; login/register project their form into it. */
@Component({
  selector: 'qs-auth-page',
  imports: [MatCardModule, MatIconModule, MatButtonToggleModule],
  template: `
    <div class="qs-auth">
      <mat-card appearance="outlined" class="qs-auth__card">
        <div class="qs-auth__brand">
          <mat-icon aria-hidden="true">park</mat-icon>
          <span class="qs-display qs-auth__wordmark">Qseng</span>
        </div>
        <h1 class="qs-auth__title" tabindex="-1">{{ title() }}</h1>
        @if (tagline()) { <p class="qs-muted qs-auth__tagline">{{ tagline() }}</p> }

        <ng-content />

        <mat-button-toggle-group class="qs-auth__lang" hideSingleSelectionIndicator
                                 [value]="i18n.lang()" (change)="setLang($event.value)"
                                 aria-label="Language">
          <mat-button-toggle value="de">DE</mat-button-toggle>
          <mat-button-toggle value="en">EN</mat-button-toggle>
        </mat-button-toggle-group>
      </mat-card>
    </div>
  `,
  styles: [`
    .qs-auth { min-height: 100dvh; display: grid; place-items: center; padding: 24px var(--qs-gutter); background: var(--mat-sys-surface-container-low); }
    .qs-auth__card { width: 100%; max-width: 420px; padding: 32px 28px 24px; display: flex; flex-direction: column; gap: 12px; }
    .qs-auth__brand { display: flex; align-items: center; justify-content: center; gap: 6px; color: var(--mat-sys-primary); }
    .qs-auth__wordmark { font-size: 1.6rem; color: var(--mat-sys-on-surface); }
    .qs-auth__title { text-align: center; margin-top: 4px; }
    .qs-auth__tagline { text-align: center; margin: -4px 0 8px; }
    .qs-auth__lang { align-self: center; margin-top: 8px; }
    @media (max-width: 599.98px) { .qs-auth__card { padding: 24px 18px 18px; } }
  `]
})
export class AuthPageComponent {
  readonly i18n = inject(I18nService);
  readonly title = input.required<string>();
  readonly tagline = input<string>('');
  setLang(lang: Lang) { this.i18n.setLang(lang); }
}
