import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ImportApi, ImportReport, TreesApi } from '../../core/api/generated';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ToastService } from '../../core/ui/toast.service';
import { BreadcrumbService } from '../../core/ui/breadcrumb.service';

type Step = 'paste' | 'preview' | 'done';

@Component({
  selector: 'qs-import-text',
  imports: [ReactiveFormsModule, RouterLink, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule,
            MatExpansionModule, MatListModule, MatProgressBarModule, TranslatePipe],
  template: `
    <header class="qs-page-header"><h1 tabindex="-1">{{ 'import.title' | translate }}</h1></header>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

    <div class="qs-import">
      @if (step() !== 'done') {
        <mat-card appearance="outlined">
          <mat-card-header><mat-card-title>1 · {{ 'import.step1' | translate }}</mat-card-title></mat-card-header>
          <mat-card-content>
            <mat-expansion-panel class="qs-import__guide">
              <mat-expansion-panel-header><mat-panel-title>{{ 'import.guide' | translate }}</mat-panel-title></mat-expansion-panel-header>
              <pre class="qs-import__pre">Max Mustermann * 12.06.1880 in Wien
  + 03.04.1950 in Salzburg
Maria Huber, geb. Schmidt * 1883 + 1960
Max Mustermann oo Maria Huber, 1905</pre>
              <ul class="qs-import__rules">
                <li><code>*</code> born, <code>+</code> died, <code>geb.</code> maiden name, <code>oo</code> marriage</li>
                <li><code>DD.MM.YYYY</code>, <code>MM.YYYY</code>, <code>YYYY</code>; prefix <code>~</code> for approximate dates</li>
                <li><code>in &lt;place&gt;</code> for a location</li>
              </ul>
            </mat-expansion-panel>
            <mat-form-field class="qs-import__field">
              <mat-label>{{ 'import.paste' | translate }}</mat-label>
              <textarea matInput [formControl]="text" rows="12" class="qs-import__textarea" [readonly]="step() === 'preview'"></textarea>
            </mat-form-field>
            @if (step() === 'paste') {
              <div class="qs-import__actions">
                <button matButton="filled" (click)="preview()" [disabled]="loading() || !text.value.trim()"><mat-icon>preview</mat-icon>{{ 'import.preview' | translate }}</button>
              </div>
            }
          </mat-card-content>
        </mat-card>
      }

      @if (report(); as r) {
        <mat-card appearance="outlined" class="qs-import__report">
          <mat-card-header><mat-card-title>{{ step() === 'done' ? ('import.doneTitle' | translate) : ('2 · ' + ('import.step2' | translate)) }}</mat-card-title></mat-card-header>
          <mat-card-content>
            <p class="qs-import__stats"><strong>{{ r.personsCreated ?? 0 }}</strong> {{ 'import.persons' | translate }} · <strong>{{ r.relationshipsCreated ?? 0 }}</strong> {{ 'import.rels' | translate }}</p>
            @if (r.warnings?.length) {
              <p class="qs-muted">{{ 'import.warnings' | translate }}</p>
              <mat-list>@for (w of r.warnings; track $index) { <mat-list-item><mat-icon matListItemIcon>warning</mat-icon>{{ w }}</mat-list-item> }</mat-list>
            }
            @if (step() === 'done') { <p>{{ 'import.done' | translate }}</p> }
          </mat-card-content>
          <mat-card-actions align="end">
            @if (step() === 'preview') {
              <button matButton (click)="back()">{{ 'import.back' | translate }}</button>
              <button matButton="filled" (click)="commit()" [disabled]="loading()"><mat-icon>check</mat-icon>{{ (loading() ? 'import.importing' : 'import.commit') | translate }}</button>
            } @else {
              <a matButton="filled" [routerLink]="['/trees', treeId()]">{{ 'import.openTree' | translate }}<mat-icon iconPositionEnd>arrow_forward</mat-icon></a>
            }
          </mat-card-actions>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .qs-import { display: flex; flex-direction: column; gap: 16px; max-width: 860px; }
    .qs-import__guide { margin-bottom: 12px; }
    .qs-import__pre { background: var(--mat-sys-surface-container); padding: 8px 12px; border-radius: var(--mat-sys-corner-small); overflow-x: auto; }
    .qs-import__rules { margin: 0; padding-left: 18px; }
    .qs-import__field { width: 100%; }
    .qs-import__textarea { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .9rem; }
    .qs-import__actions { display: flex; justify-content: flex-end; }
    .qs-import__stats { font-size: 1.1rem; }
  `]
})
export class ImportTextComponent implements OnInit {
  readonly treeId = input.required<string>();
  private readonly api = inject(ImportApi);
  private readonly trees = inject(TreesApi);
  private readonly toast = inject(ToastService);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly i18n = inject(I18nService);

  readonly text = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly loading = signal(false);
  readonly report = signal<ImportReport | null>(null);
  readonly step = signal<Step>('paste');

  ngOnInit() {
    this.crumbs.set([{ label: this.i18n.t('trees.title'), link: ['/trees'] }, { label: this.i18n.t('import.title') }]);
    this.trees.treesGetAll().subscribe(list => {
      const tree = list.find(t => t.id === this.treeId());
      if (tree) this.crumbs.set([{ label: this.i18n.t('trees.title'), link: ['/trees'] }, { label: tree.name ?? '', link: ['/trees', tree.id] }, { label: this.i18n.t('import.title') }]);
    });
  }

  preview() {
    const text = this.text.value.trim();
    if (!text) return;
    this.loading.set(true);
    this.api.importPreview({ treeId: this.treeId(), body: { text } }).subscribe({
      next: r => { this.report.set(r); this.step.set('preview'); this.loading.set(false); },
      error: e => { this.toast.errorFrom(e, this.i18n.t('import.err')); this.loading.set(false); }
    });
  }

  back() { this.step.set('paste'); this.report.set(null); }

  commit() {
    const text = this.text.value.trim();
    this.loading.set(true);
    this.api.importCommit({ treeId: this.treeId(), body: { text } }).subscribe({
      next: r => { this.report.set(r); this.step.set('done'); this.loading.set(false); },
      error: e => { this.toast.errorFrom(e, this.i18n.t('import.err')); this.loading.set(false); }
    });
  }
}
