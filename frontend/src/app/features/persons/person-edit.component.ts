import { Component, OnDestroy, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MediaApi, PartialDate, PersonDto, PersonRequest, PersonsApi, Sex } from '../../core/api/generated';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import { ToastService } from '../../core/ui/toast.service';
import { BreadcrumbService } from '../../core/ui/breadcrumb.service';
import { FormErrorsPipe } from '../../core/forms/form-errors.pipe';
import { setServerErrors } from '../../core/forms/server-errors';
import { isValidationProblem } from '../../core/api/problem-details';
import { initials, sexClass } from '../../core/models/person-helpers';
import { PartialDateInputComponent } from '../../shared/ui/partial-date-input.component';
import { PersonStore } from './person.store';
import { HasUnsavedChanges } from './unsaved-changes.guard';

const SEXES: Sex[] = ['Male', 'Female'];

@Component({
  selector: 'qs-person-edit',
  imports: [ReactiveFormsModule, RouterLink, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatButtonToggleModule,
            MatIconModule, MatMenuModule, MatProgressBarModule, TranslatePipe, FormErrorsPipe, PartialDateInputComponent],
  template: `
    <header class="qs-page-header">
      <h1 tabindex="-1">{{ (isNew() ? 'pe.new' : 'pe.edit') | translate }}</h1>
      @if (!isNew()) {
        <button matIconButton [matMenuTriggerFor]="menu" [attr.aria-label]="'actions' | translate"><mat-icon>more_vert</mat-icon></button>
        <mat-menu #menu="matMenu"><button mat-menu-item (click)="remove()"><mat-icon>delete</mat-icon>{{ 'delete' | translate }}</button></mat-menu>
      }
    </header>
    @if (!isNew() && store.error()) {
      <div class="qs-empty" role="alert"><mat-icon aria-hidden="true">error</mat-icon><p>{{ store.error() }}</p>
        <button matButton="outlined" (click)="store.load(id()!)">{{ 'retry' | translate }}</button></div>
    } @else if (isNew() || store.person()) {
      <form [formGroup]="form" (ngSubmit)="save()" novalidate class="qs-pe">
        <mat-card appearance="outlined" class="qs-pe__card qs-pe__avatar">
          <div class="qs-pe__avatar-wrap">
            <button type="button" class="qs-pe__avatar-btn" (click)="avatarInput.click()" [disabled]="avatarUploading()" [attr.aria-label]="'pe.avatarHint' | translate">
              @if (avatarPreview(); as url) { <img [src]="url" [alt]="''"> }
              @else { <span [class]="'qs-avatar qs-avatar--88 qs-avatar__initials qs-sex-' + sexClass(form.controls.sex.value)">{{ initialsNow() }}</span> }
            </button>
            <mat-icon class="qs-pe__avatar-icon" aria-hidden="true">photo_camera</mat-icon>
          </div>
          <input #avatarInput type="file" accept="image/*" hidden (change)="onAvatarInput($event)">
          <div>
            <div class="qs-pe__avatar-title">{{ 'pe.avatar' | translate }}</div>
            <div class="qs-muted">{{ (avatarUploading() ? 'media.uploading' : (isNew() && pendingAvatar ? 'pe.avatarPending' : 'pe.avatarHint')) | translate }}</div>
          </div>
        </mat-card>

        <mat-card appearance="outlined" class="qs-pe__card">
          <mat-card-header><mat-card-title>{{ 'pe.basics' | translate }}</mat-card-title></mat-card-header>
          <mat-card-content class="qs-pe__grid">
            <mat-form-field><mat-label>{{ 'pe.firstName' | translate }}</mat-label><input matInput formControlName="firstName" maxlength="100"><mat-error>{{ form.controls.firstName.errors | formErrors }}</mat-error></mat-form-field>
            <mat-form-field><mat-label>{{ 'pe.lastName' | translate }}</mat-label><input matInput formControlName="lastName" maxlength="100"><mat-error>{{ form.controls.lastName.errors | formErrors }}</mat-error></mat-form-field>
            <mat-form-field><mat-label>{{ 'pe.maidenName' | translate }} ({{ 'optional' | translate }})</mat-label><input matInput formControlName="maidenName" maxlength="100"></mat-form-field>
            <div class="qs-pe__sex">
              <span class="qs-muted">{{ 'sex.label' | translate }}</span>
              <mat-button-toggle-group formControlName="sex" hideSingleSelectionIndicator>
                @for (s of sexes; track s) { <mat-button-toggle [value]="s">{{ i18n.sexLabel(s) }}</mat-button-toggle> }
              </mat-button-toggle-group>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined" class="qs-pe__card">
          <mat-card-header><mat-card-title>{{ 'pe.life' | translate }}</mat-card-title></mat-card-header>
          <mat-card-content class="qs-pe__grid">
            <qs-partial-date-input formControlName="birth" [label]="'pe.birth' | translate" />
            <mat-form-field><mat-label>{{ 'pe.birthPlace' | translate }}</mat-label><input matInput formControlName="birthPlace" maxlength="200"></mat-form-field>
            <qs-partial-date-input formControlName="death" [label]="'pe.death' | translate" />
            <mat-form-field><mat-label>{{ 'pe.deathPlace' | translate }}</mat-label><input matInput formControlName="deathPlace" maxlength="200"></mat-form-field>
            <mat-form-field class="qs-pe__wide"><mat-label>{{ 'pe.causeOfDeath' | translate }}</mat-label><input matInput formControlName="causeOfDeath" maxlength="200"></mat-form-field>
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined" class="qs-pe__card">
          <mat-card-header><mat-card-title>{{ 'pe.notes' | translate }}</mat-card-title></mat-card-header>
          <mat-card-content>
            <mat-form-field class="qs-pe__wide"><mat-label>{{ 'pe.notes' | translate }}</mat-label><textarea matInput formControlName="notes" rows="5" maxlength="4000"></textarea></mat-form-field>
          </mat-card-content>
        </mat-card>

        @if (error()) { <p class="qs-form-error" role="alert">{{ error() }}</p> }
        <div class="qs-pe__actions">
          <a matButton [routerLink]="cancelLink()">{{ 'cancel' | translate }}</a>
          <button matButton="filled" type="submit" [disabled]="saving()">{{ (saving() ? 'saving' : (isNew() ? 'pe.save' : 'pe.update')) | translate }}</button>
        </div>
      </form>
    } @else {
      <mat-progress-bar mode="indeterminate" />
    }
  `,
  styles: [`
    :host { display: block; }
    .qs-pe { display: flex; flex-direction: column; gap: 16px; max-width: 860px; padding-bottom: 72px; }
    .qs-pe__avatar { display: flex; flex-direction: row; align-items: center; gap: 16px; }
    .qs-pe__avatar-wrap { position: relative; width: 88px; height: 88px; flex: 0 0 auto; }
    .qs-pe__avatar-btn { width: 88px; height: 88px; border-radius: 50%; border: 0; padding: 0; overflow: hidden; cursor: pointer; background: var(--mat-sys-surface-container); }
    .qs-pe__avatar-btn img { width: 100%; height: 100%; object-fit: cover; }
    .qs-pe__avatar-icon { position: absolute; right: 0; bottom: 0; background: var(--mat-sys-primary); color: var(--mat-sys-on-primary); border-radius: 50%; padding: 3px; font-size: 18px; width: 18px; height: 18px; pointer-events: none; }
    .qs-pe__avatar-title { font-weight: 500; }
    .qs-pe__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 4px 16px; align-items: start; }
    .qs-pe__wide { grid-column: 1 / -1; width: 100%; }
    .qs-pe__sex { display: flex; flex-direction: column; gap: 4px; }
    .qs-pe__actions { display: flex; justify-content: flex-end; gap: 8px; }
    @media (max-width: 599.98px) {
      .qs-pe__actions { position: sticky; bottom: 0; padding: 12px 0; background: var(--mat-sys-surface); border-top: 1px solid var(--mat-sys-outline-variant); }
    }
  `]
})
export class PersonEditComponent implements OnInit, OnDestroy, HasUnsavedChanges {
  readonly id = input<string>();
  readonly treeId = input<string>();
  readonly store = inject(PersonStore);
  readonly i18n = inject(I18nService);
  private readonly persons = inject(PersonsApi);
  private readonly media = inject(MediaApi);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  private readonly crumbs = inject(BreadcrumbService);

  readonly sexes = SEXES;
  readonly sexClass = sexClass;
  readonly isNew = computed(() => !this.id());
  readonly saving = signal(false);
  readonly error = signal('');
  readonly avatarUploading = signal(false);
  readonly localAvatar = signal<string | null>(null);
  pendingAvatar: File | null = null;
  private saved = false;
  private patchedId: string | null = null;
  private lastObjectUrl: string | null = null;

  readonly form = inject(FormBuilder).nonNullable.group({
    firstName: ['', Validators.required], lastName: ['', Validators.required], maidenName: [''],
    sex: ['Male' as Sex], birth: [null as PartialDate | null], birthPlace: [''], death: [null as PartialDate | null],
    deathPlace: [''], causeOfDeath: [''], notes: ['']
  });
  /** Snapshot of `form.getRawValue()` at the last clean point (load or save); `setValue`/`patchValue` don't mark controls dirty, so dirtiness is tracked by comparison instead. */
  private baseline = this.snapshotRaw();

  readonly avatarPreview = computed(() => this.localAvatar() ?? this.store.avatarUrl());
  readonly initialsNow = () => initials({ firstName: this.form.controls.firstName.value, lastName: this.form.controls.lastName.value }) || '?';
  readonly cancelLink = computed(() => (this.isNew() ? ['/trees', this.treeId() ?? ''] : ['/persons', this.id() ?? '']));

  constructor() {
    effect(() => {
      const p = this.store.person();
      if (p && !this.isNew() && p.id !== this.patchedId) { this.patchedId = p.id ?? null; this.patchFrom(p); }
    });
    effect(() => {
      const tree = this.store.tree();
      this.crumbs.set([
        { label: this.i18n.t('trees.title'), link: ['/trees'] },
        ...(tree ? [{ label: tree.name ?? '', link: ['/trees', tree.id] }] : []),
        ...(this.isNew() ? [] : [{ label: this.store.fullName(), link: ['/persons', this.id()] }]),
        { label: this.i18n.t(this.isNew() ? 'pe.new' : 'pe.edit') }
      ]);
    });
  }

  ngOnInit() { const id = this.id(); if (id) this.store.load(id); }

  ngOnDestroy() { this.revokeLastObjectUrl(); }

  private revokeLastObjectUrl() {
    if (this.lastObjectUrl && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(this.lastObjectUrl);
    this.lastObjectUrl = null;
  }

  hasUnsavedChanges(): boolean { return !this.saved && (this.pendingAvatar !== null || this.snapshotRaw() !== this.baseline); }

  private snapshotRaw(): string { return JSON.stringify(this.form.getRawValue()); }

  private patchFrom(p: PersonDto) {
    this.form.reset({
      firstName: p.firstName ?? '', lastName: p.lastName ?? '', maidenName: p.maidenName ?? '', sex: p.sex ?? 'Male',
      birth: p.birth ?? null, birthPlace: p.birthPlace ?? '', death: p.death ?? null, deathPlace: p.deathPlace ?? '',
      causeOfDeath: p.causeOfDeath ?? '', notes: p.notes ?? ''
    });
    this.baseline = this.snapshotRaw();
  }

  onAvatarInput(e: Event) { const f = (e.target as HTMLInputElement).files?.[0]; if (f) this.onAvatarPicked(f); }

  onAvatarPicked(file: File) {
    if (this.isNew()) {
      this.pendingAvatar = file;
      this.setLocalAvatarObjectUrl(file);
      return;
    }
    const personId = this.id();
    if (!personId) return;
    this.avatarUploading.set(true);
    this.media.mediaUpload({ personId, body: { file, kind: 'Photo' } }).subscribe({
      next: item => {
        if (item.id) {
          this.media.mediaSetAvatar({ personId, mediaId: item.id }).subscribe({
            next: () => { this.localAvatar.set(item.url ?? null); this.avatarUploading.set(false); this.store.reloadMedia(); },
            error: err => { this.toast.errorFrom(err, this.i18n.t('err.save')); this.avatarUploading.set(false); this.store.reloadMedia(); }
          });
        } else {
          this.localAvatar.set(item.url ?? null);
          this.avatarUploading.set(false);
          this.store.reloadMedia();
        }
      },
      error: err => { this.toast.errorFrom(err, this.i18n.t('err.save')); this.avatarUploading.set(false); }
    });
  }

  private setLocalAvatarObjectUrl(file: File) {
    this.revokeLastObjectUrl();
    const url = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null;
    this.lastObjectUrl = url;
    this.localAvatar.set(url);
  }

  save(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return Promise.resolve(); }
    const v = this.form.getRawValue();
    const body: PersonRequest = {
      firstName: v.firstName.trim(), lastName: v.lastName.trim(), maidenName: v.maidenName.trim() || null, sex: v.sex,
      birth: v.birth ?? undefined, death: v.death ?? undefined, birthPlace: v.birthPlace.trim() || null, deathPlace: v.deathPlace.trim() || null,
      causeOfDeath: v.causeOfDeath.trim() || null, notes: v.notes.trim() || null
    };
    this.saving.set(true);
    this.error.set('');
    const id = this.id();
    const request = id ? this.persons.personsUpdate({ id, body }) : this.persons.personsCreate({ treeId: this.treeId() ?? '', body });
    return new Promise<void>(resolve => {
      const finish = (saved: PersonDto) => {
        this.store.setPerson(saved);
        this.saved = true;
        this.pendingAvatar = null;
        this.baseline = this.snapshotRaw();
        this.saving.set(false);
        this.toast.success(this.i18n.t('pe.saved.toast'));
        void this.router.navigate(['/persons', saved.id]);
        resolve();
      };
      request.subscribe({
        next: saved => {
          if (!id && this.pendingAvatar && saved.id) {
            const pending = this.pendingAvatar;
            this.media.mediaUpload({ personId: saved.id, body: { file: pending, kind: 'Photo' } }).subscribe({
              next: () => finish(saved),
              error: err => { this.toast.errorFrom(err, this.i18n.t('err.save')); finish(saved); }
            });
          } else finish(saved);
        },
        error: err => {
          const e = err as { error?: unknown };
          if (isValidationProblem(e.error)) this.error.set(setServerErrors(this.form, e.error).join(' '));
          else this.toast.errorFrom(err, this.i18n.t('err.save'));
          this.saving.set(false);
          resolve();
        }
      });
    });
  }

  async remove() {
    const id = this.id();
    const p = this.store.person();
    if (!id || !p) return;
    const ok = await this.confirm.confirm({ title: this.i18n.t('pe.deleteTitle'), message: this.i18n.t('pe.deleteConfirm').replace('__NAME__', this.store.fullName()), confirmLabel: this.i18n.t('delete'), destructive: true });
    if (ok !== true) return;
    this.persons.personsDelete({ id }).subscribe({
      next: () => { this.saved = true; this.toast.success(this.i18n.t('pe.deleted.toast')); void this.router.navigate(['/trees', p.treeId]); },
      error: e => this.toast.errorFrom(e, this.i18n.t('err.delete'))
    });
  }
}
