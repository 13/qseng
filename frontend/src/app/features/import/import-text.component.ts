import { Component, signal, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiClient, ImportReport } from '../../core/api/api-client.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'qs-import-text',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe],
  template: `
    <header class="page-header">
      <a class="back-link" [routerLink]="['/trees', treeId]">{{ 'import.back' | translate }}</a>
      <h1>{{ 'import.title' | translate }}</h1>
    </header>

    <div class="import-layout">
      <div class="import-guide">
        <h3>{{ 'import.guide' | translate }}</h3>
        <pre>Max Mustermann * 12.06.1880 in Wien
  + 03.04.1950 in Salzburg

Maria Huber, geb. Schmidt * 1883 + 1960

Max Mustermann oo Maria Huber, 1905</pre>
        <ul>
          <li><code>*</code> born, <code>+</code> died</li>
          <li><code>geb.</code> maiden name</li>
          <li><code>oo</code> marriage</li>
          <li>Date formats: <code>DD.MM.YYYY</code>, <code>MM.YYYY</code>, <code>YYYY</code></li>
          <li>Prefix <code>~</code> for approximate dates</li>
          <li><code>in &lt;place&gt;</code> for location</li>
        </ul>
      </div>

      <div class="import-form-area">
        <label style="font-size:.85rem;font-weight:600;color:var(--c-text-2)">
          {{ 'import.paste' | translate }}
          <textarea [(ngModel)]="text" name="text" rows="14"
                    placeholder="Max Mustermann * 12.06.1880 in Wien…"
                    style="margin-top:.35rem;font-family:monospace;font-size:.82rem;line-height:1.6"></textarea>
        </label>

        <div class="form-actions">
          <button (click)="preview()" [disabled]="loading() || !text.trim()">
            {{ loading() && !report() ? ('import.analyzing' | translate) : ('import.preview' | translate) }}
          </button>
          @if (report()?.isDryRun) {
            <button class="primary" (click)="commit()" [disabled]="loading()">
              {{ loading() ? ('import.importing' | translate) : ('import.commit' | translate) }}
            </button>
          }
        </div>

        @if (importErr()) {
          <p class="error-msg" style="margin-top:.5rem">{{ importErr() }}</p>
        }

        @if (report(); as r) {
          <div class="import-report" [class.preview]="r.isDryRun" [class.committed]="!r.isDryRun">
            <h3>{{ r.isDryRun ? ('import.previewTitle' | translate) : ('import.doneTitle' | translate) }}</h3>
            <p class="report-stats">
              <strong>{{ r.personsCreated }}</strong> {{ 'import.persons' | translate }} ·
              <strong>{{ r.relationshipsCreated }}</strong> {{ 'import.rels' | translate }}
            </p>
            @if (r.warnings.length) {
              <ul class="import-warnings">
                @for (w of r.warnings; track w) { <li>⚠ {{ w }}</li> }
              </ul>
            }
            @if (!r.isDryRun) {
              <p class="success" style="margin:.5rem 0 0;font-size:.875rem">{{ 'import.done' | translate }}</p>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`:host { display: block; }`]
})
export class ImportTextComponent {
  private route = inject(ActivatedRoute);
  private api   = inject(ApiClient);
  private i18n  = inject(I18nService);

  treeId    = this.route.snapshot.paramMap.get('treeId')!;
  text      = '';
  loading   = signal(false);
  report    = signal<ImportReport | null>(null);
  importErr = signal('');

  preview() {
    this.loading.set(true);
    this.importErr.set('');
    this.api.previewImport(this.treeId, this.text).subscribe({
      next: r => { this.report.set(r); this.loading.set(false); },
      error: e => { this.importErr.set(e.error?.error ?? this.i18n.t('import.err')); this.loading.set(false); }
    });
  }

  commit() {
    this.loading.set(true);
    this.importErr.set('');
    this.api.commitImport(this.treeId, this.text).subscribe({
      next: r => { this.report.set(r); this.loading.set(false); },
      error: e => { this.importErr.set(e.error?.error ?? this.i18n.t('import.err')); this.loading.set(false); }
    });
  }
}
