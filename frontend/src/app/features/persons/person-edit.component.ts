import { Component, OnInit, signal, inject, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiClient, Person, SEX_OPTIONS, Sex } from '../../core/api/api-client.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { PartialDateInputComponent, PartialDateValue } from '../../shared/ui/partial-date-input.component';

@Component({
  selector: 'qs-person-edit',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe, PartialDateInputComponent],
  template: `
    <header class="page-header">
      <a class="back-link" [routerLink]="isNew ? ['/trees', treeId] : ['/persons', personId]">
        ← {{ isNew ? ('tree.back' | translate) : ('back' | translate) }}
      </a>
      <h1>{{ (isNew ? 'pe.new' : 'pe.edit') | translate }}</h1>
      @if (!isNew) {
        <div class="header-actions">
          <button class="btn sm danger" (click)="deletePerson()">{{ 'delete' | translate }}</button>
        </div>
      }
    </header>

    <div class="pe-form">

      <!-- Avatar -->
      <div class="pe-card" style="display:flex;align-items:center;gap:1.25rem">
        <label class="avatar-upload-zone" [title]="'pe.avatarHint' | translate">
          @if (avatarUrl()) {
            <img class="avatar-photo xl" [src]="avatarUrl()" alt="avatar">
          } @else {
            <div class="avatar lg" [class]="sexCls(form.sex ?? 'Male')">
              {{ initials() }}
            </div>
          }
          <div class="avatar-upload-overlay">{{ 'pe.avatarHint' | translate }}</div>
          <input type="file" accept="image/*" (change)="onAvatarSelected($event)"
                 [disabled]="avatarUploading()" style="display:none">
        </label>
        <div>
          <div style="font-size:.88rem;font-weight:600;color:var(--c-text)">
            {{ form.firstName }} {{ form.lastName }}
          </div>
          <div style="font-size:.78rem;color:var(--c-text-3);margin-top:.2rem">
            {{ 'pe.avatar' | translate }}
          </div>
          @if (avatarUploading()) {
            <div class="muted" style="font-size:.78rem;margin-top:.3rem">{{ 'media.uploading' | translate }}</div>
          }
          @if (isNew && avatarUrl()) {
            <div style="font-size:.78rem;color:var(--c-text-3);margin-top:.2rem">{{ 'pe.avatarPending' | translate }}</div>
          }
        </div>
      </div>

      <!-- Basic info -->
      <div class="pe-card">
        <p class="pe-card__title">{{ 'pe.basics' | translate }}</p>
        <div class="pe-grid2">
          <label class="field-lbl">
            {{ 'pe.firstName' | translate }} <span class="required-star">*</span>
            <input type="text" [(ngModel)]="form.firstName" name="fn"
                   [placeholder]="'pe.firstName' | translate" autofocus>
          </label>
          <label class="field-lbl">
            {{ 'pe.lastName' | translate }} <span class="required-star">*</span>
            <input type="text" [(ngModel)]="form.lastName" name="ln"
                   [placeholder]="'pe.lastName' | translate">
          </label>
        </div>

        <div class="field-lbl" style="margin-top:1.1rem">
          {{ 'sex.label' | translate }}
          <div class="sex-picker">
            @for (s of sexOptions; track s) {
              <button type="button" class="sex-btn"
                      [class]="'sex-' + s.toLowerCase()"
                      [class.active]="form.sex === s"
                      (click)="form.sex = s">
                {{ sexIcon(s) }} {{ i18n.sexLabel(s) }}
              </button>
            }
          </div>
        </div>
      </div>

      <!-- Birth -->
      <div class="pe-card">
        <p class="pe-card__title">{{ 'pe.birth' | translate }}</p>
        <qs-partial-date-input prefix="birth" [value]="birth" (valueChange)="birth = $event" />
        <label class="field-lbl" style="margin-top:.65rem">
          {{ 'pe.birthPlace' | translate }}
          <input type="text" [(ngModel)]="form.birthPlace" name="bp">
        </label>
      </div>

      <!-- Death -->
      <div class="pe-card">
        <p class="pe-card__title">
          {{ 'pe.death' | translate }}
          <span class="pe-optional">({{ 'pe.optional' | translate }})</span>
        </p>
        <qs-partial-date-input prefix="death" [value]="death" (valueChange)="death = $event" />
        <label class="field-lbl" style="margin-top:.65rem">
          {{ 'pe.deathPlace' | translate }}
          <input type="text" [(ngModel)]="form.deathPlace" name="dp">
        </label>
        <label class="field-lbl" style="margin-top:.5rem">
          {{ 'pe.causeOfDeath' | translate }}
          <input type="text" [(ngModel)]="form.causeOfDeath" name="cod">
        </label>
      </div>

      <!-- Notes -->
      <div class="pe-card">
        <p class="pe-card__title">{{ 'pe.notes' | translate }}</p>
        <label class="field-lbl">
          <textarea [(ngModel)]="form.notes" name="notes" rows="4"
                    placeholder="…"></textarea>
        </label>
      </div>

      @if (error()) { <p class="error-msg">{{ error() }}</p> }

      <div class="pe-actions">
        <button class="btn primary" (click)="save()"
                [disabled]="saving() || !form.firstName?.trim() || !form.lastName?.trim()">
          {{ saving() ? ('saving' | translate) : ((isNew ? 'pe.save' : 'pe.update') | translate) }}
        </button>
        <a class="btn ghost" [routerLink]="isNew ? ['/trees', treeId] : ['/persons', personId]">
          {{ 'cancel' | translate }}
        </a>
      </div>
    </div>
  `
})
export class PersonEditComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiClient);
  private cdr = inject(ChangeDetectorRef);
  readonly i18n = inject(I18nService);

  personId = '';
  treeId = '';
  isNew = false;
  saving = signal(false);
  error = signal('');
  avatarUrl = signal<string | null>(null);
  avatarUploading = signal(false);
  sexOptions = SEX_OPTIONS;

  private pendingAvatarFile: File | null = null;

  form: Partial<Person> = { firstName: '', lastName: '', sex: 'Male' };
  birth: PartialDateValue = {};
  death: PartialDateValue = {};

  ngOnInit() {
    this.personId = this.route.snapshot.paramMap.get('id') ?? '';
    this.treeId   = this.route.snapshot.paramMap.get('treeId') ?? '';
    this.isNew    = !this.personId || this.route.snapshot.url.some(s => s.path === 'new');

    if (!this.isNew) {
      this.api.getPerson(this.personId).subscribe({
        next: p => {
          this.form.firstName    = p.firstName;
          this.form.lastName     = p.lastName;
          this.form.sex          = p.sex;
          this.form.notes        = p.notes;
          this.form.birthPlace   = p.birthPlace;
          this.form.deathPlace   = p.deathPlace;
          this.form.causeOfDeath = p.causeOfDeath;
          this.treeId            = p.treeId;
          this.birth = { year: p.birth?.year, month: p.birth?.month, day: p.birth?.day, approx: p.birth?.approx };
          this.death = { year: p.death?.year, month: p.death?.month, day: p.death?.day, approx: p.death?.approx };
          this.cdr.markForCheck();
        },
        error: () => this.error.set(this.i18n.t('err.load'))
      });
      this.api.getPersonMedia(this.personId).subscribe(media => {
        const photo = media.find(m => m.kind === 'Photo');
        if (photo) this.avatarUrl.set(photo.url);
      });
    }
  }

  save() {
    if (!this.form.firstName?.trim() || !this.form.lastName?.trim()) {
      this.error.set(this.i18n.t('pe.required'));
      return;
    }
    this.saving.set(true);
    this.error.set('');

    const birthVal = this.birth.year
      ? { year: this.birth.year, month: this.birth.month, day: this.birth.day, approx: this.birth.approx || undefined }
      : undefined;
    const deathVal = this.death.year
      ? { year: this.death.year, month: this.death.month, day: this.death.day, approx: this.death.approx || undefined }
      : undefined;
    const body = { ...this.form, birth: birthVal, death: deathVal };

    const req = this.isNew
      ? this.api.createPerson(this.treeId, body)
      : this.api.updatePerson(this.personId, body);

    req.subscribe({
      next: (p: Person) => {
        const navigateToDetail = () => this.router.navigate(['/persons', p.id]);
        if (this.isNew && this.pendingAvatarFile) {
          this.api.uploadMedia(p.id, this.pendingAvatarFile, undefined, 'Photo').subscribe({
            next: navigateToDetail, error: navigateToDetail
          });
        } else {
          navigateToDetail();
        }
      },
      error: (e: { error?: { error?: string; errors?: { errorMessage: string }[] } }) => {
        const resp = e.error;
        this.error.set(resp?.error ?? resp?.errors?.[0]?.errorMessage ?? this.i18n.t('err.save'));
        this.saving.set(false);
      }
    });
  }

  onAvatarSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (this.isNew) {
      this.pendingAvatarFile = file;
      this.avatarUrl.set(URL.createObjectURL(file));
      return;
    }
    this.avatarUploading.set(true);
    this.api.uploadMedia(this.personId, file, undefined, 'Photo').subscribe({
      next: item => { this.avatarUrl.set(item.url); this.avatarUploading.set(false); },
      error: () => this.avatarUploading.set(false)
    });
  }

  deletePerson() {
    const name = `${this.form.firstName} ${this.form.lastName}`;
    if (!confirm(this.i18n.t('pe.deleteConfirm').replace('__NAME__', name))) return;
    this.api.deletePerson(this.personId).subscribe({
      next: () => this.router.navigate(['/trees', this.treeId]),
      error: () => this.error.set(this.i18n.t('err.delete'))
    });
  }

  initials(): string {
    return ((this.form.firstName?.[0] ?? '') + (this.form.lastName?.[0] ?? '')).toUpperCase() || '?';
  }

  sexCls(s: Sex): string { return s.toLowerCase(); }
  sexIcon(s: Sex): string {
    return s === 'Male' ? '♂' : '♀';
  }
}
