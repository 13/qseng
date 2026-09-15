import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { BuildInfo, VersionService } from '../../core/version/version.service';

/** Settings card showing the running web and API versions (see docs/superpowers/specs/2026-09-15-release-publishing-design.md §3). */
@Component({
  selector: 'qs-about-card',
  imports: [MatCardModule, MatButtonModule, MatIconModule, TranslatePipe],
  template: `
    <mat-card appearance="outlined">
      <mat-card-header><mat-card-title>{{ 'settings.about.title' | translate }}</mat-card-title></mat-card-header>
      <mat-card-content>
        <dl class="qs-dl">
          <dt>{{ 'settings.about.web' | translate }}</dt><dd class="qs-about__value">{{ label(versions.web()) }}</dd>
          <dt>{{ 'settings.about.api' | translate }}</dt><dd class="qs-about__value">{{ label(versions.api()) }}</dd>
        </dl>
        <a matButton="outlined" href="https://github.com/13/qseng/releases" target="_blank" rel="noopener">
          <mat-icon>open_in_new</mat-icon>{{ 'settings.about.releases' | translate }}
        </a>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    :host { display: block; }
    .qs-dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; margin: 0 0 12px; }
    .qs-dl dt { color: var(--mat-sys-on-surface-variant); }
    .qs-dl dd { margin: 0; }
    .qs-about__value { font-family: var(--mat-sys-body-medium-font, monospace); font-variant-numeric: tabular-nums; }
  `]
})
export class AboutCardComponent {
  readonly versions = inject(VersionService);

  constructor() { this.versions.load(); }

  label(info: BuildInfo | null): string {
    return info ? `${info.version} (${info.commit.slice(0, 7)})` : '—';
  }
}
