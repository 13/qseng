import { Component, signal, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiClient, ImportReport } from '../../core/api/api-client.service';

@Component({
  selector: 'qs-import-text',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <header class="page-header">
      <a class="back-link" [routerLink]="['/trees', treeId]">← Tree</a>
      <h1>Import Genealogy Text</h1>
    </header>

    <div class="import-layout">
      <div class="import-guide">
        <h3>Format guide</h3>
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
          Paste genealogy text
          <textarea [(ngModel)]="text" name="text" rows="14"
                    placeholder="Max Mustermann * 12.06.1880 in Wien…"
                    style="margin-top:.35rem;font-family:monospace;font-size:.82rem;line-height:1.6"></textarea>
        </label>

        <div class="form-actions">
          <button (click)="preview()" [disabled]="loading() || !text.trim()">
            {{ loading() && !report() ? 'Analyzing…' : '🔍 Preview' }}
          </button>
          @if (report()?.isDryRun) {
            <button class="primary" (click)="commit()" [disabled]="loading()">
              {{ loading() ? 'Importing…' : '✓ Commit Import' }}
            </button>
          }
        </div>

        @if (report(); as r) {
          <div class="import-report" [class.preview]="r.isDryRun" [class.committed]="!r.isDryRun">
            <h3>{{ r.isDryRun ? 'Preview' : 'Import complete' }}</h3>
            <p class="report-stats">
              <strong>{{ r.personsCreated }}</strong> persons ·
              <strong>{{ r.relationshipsCreated }}</strong> relationships
            </p>
            @if (r.warnings.length) {
              <ul class="import-warnings">
                @for (w of r.warnings; track w) { <li>⚠ {{ w }}</li> }
              </ul>
            }
            @if (!r.isDryRun) {
              <p class="success" style="margin:.5rem 0 0;font-size:.875rem">✓ All data has been saved.</p>
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

  treeId  = this.route.snapshot.paramMap.get('treeId')!;
  text    = '';
  loading = signal(false);
  report  = signal<ImportReport | null>(null);

  preview() {
    this.loading.set(true);
    this.api.previewImport(this.treeId, this.text).subscribe({
      next: r => { this.report.set(r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  commit() {
    this.loading.set(true);
    this.api.commitImport(this.treeId, this.text).subscribe({
      next: r => { this.report.set(r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }
}
