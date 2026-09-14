import { Component, Input, forwardRef, inject, signal } from '@angular/core';
import { ControlValueAccessor, FormControl, NG_VALIDATORS, NG_VALUE_ACCESSOR, ReactiveFormsModule, ValidationErrors, Validator } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { PartialDate } from '../../core/api/generated';
import { I18nService } from '../../core/i18n/i18n.service';
import { formatPartialDate, isEmptyPartialDate, parsePartialDate } from './partial-date';

/**
 * Text entry for genealogy dates: "1923", "06.1923", "12.06.1923", "~" for approximate.
 * Registers as a form control holding `PartialDate | null`; invalid text sets `{ partialDate: true }`.
 */
@Component({
  selector: 'qs-partial-date-input',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatCheckboxModule],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PartialDateInputComponent), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => PartialDateInputComponent), multi: true }
  ],
  template: `
    <div class="qs-pdate">
      <mat-form-field class="qs-pdate__field">
        <mat-label>{{ label }}</mat-label>
        <input matInput type="text" [formControl]="textCtrl" [required]="required"
               inputmode="numeric" autocomplete="off" spellcheck="false"
               (blur)="commit()" (keydown.enter)="commit()">
        <mat-hint>{{ hint || i18n.t('date.hint') }}</mat-hint>
        @if (textCtrl.invalid) { <mat-error>{{ i18n.t('date.invalid') }}</mat-error> }
      </mat-form-field>
      <mat-checkbox class="qs-pdate__approx" [checked]="approx()" [disabled]="disabled() || isEmpty()"
                    (change)="setApprox($event.checked)">{{ i18n.t('pe.approx') }}</mat-checkbox>
    </div>
  `,
  styles: [`
    .qs-pdate { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
    .qs-pdate__field { flex: 1 1 180px; }
    .qs-pdate__approx { flex: 0 0 auto; }
  `]
})
export class PartialDateInputComponent implements ControlValueAccessor, Validator {
  readonly i18n = inject(I18nService);

  @Input() label = '';
  @Input() hint = '';
  @Input() required = false;

  readonly textCtrl = new FormControl('', { nonNullable: true, validators: [c => (parsePartialDate(c.value) === undefined ? { partialDate: true } : null)] });
  readonly approx = signal(false);
  readonly disabled = signal(false);
  readonly isEmpty = signal(true);

  private current: PartialDate | null = null;
  private onChange: (v: PartialDate | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private onValidatorChange: () => void = () => undefined;

  writeValue(v: PartialDate | null): void {
    this.current = this.normalize(v);
    this.textCtrl.setValue(formatPartialDate(this.current), { emitEvent: false });
    this.approx.set(!!this.current?.approx);
    this.isEmpty.set(this.current === null);
  }
  registerOnChange(fn: (v: PartialDate | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
    if (isDisabled) this.textCtrl.disable({ emitEvent: false });
    else this.textCtrl.enable({ emitEvent: false });
  }
  registerOnValidatorChange(fn: () => void): void { this.onValidatorChange = fn; }

  validate(): ValidationErrors | null {
    const errors: ValidationErrors = {};
    if (this.textCtrl.invalid) errors['partialDate'] = true;
    if (this.required && this.isEmpty()) errors['required'] = true;
    return Object.keys(errors).length ? errors : null;
  }

  commit() {
    const parsed = parsePartialDate(this.textCtrl.value);
    this.onTouched();
    if (parsed === undefined) {
      this.onValidatorChange();
      this.onChange(this.current);
      return;
    }
    this.current = this.normalize(parsed);
    this.textCtrl.setValue(formatPartialDate(this.current), { emitEvent: false });
    this.approx.set(!!this.current?.approx);
    this.isEmpty.set(this.current === null);
    this.onValidatorChange();
    this.emit();
  }

  setApprox(checked: boolean) {
    if (!this.current) return;
    if (checked) {
      this.current = { ...this.current, approx: true };
    } else {
      const next = { ...this.current };
      delete next.approx;
      this.current = next;
    }
    this.approx.set(checked);
    this.textCtrl.setValue(formatPartialDate(this.current), { emitEvent: false });
    this.emit();
  }

  /** Keeps only the fields the control edits; drops server-only fields like `isUnknown`/`sortableDate`. */
  private normalize(v: PartialDate | null | undefined): PartialDate | null {
    if (isEmptyPartialDate(v)) return null;
    const { year, month, day, approx } = v as PartialDate;
    const out: PartialDate = { year };
    if (month != null) out.month = month;
    if (day != null) out.day = day;
    if (approx) out.approx = true;
    return out;
  }

  private emit() {
    this.onChange(this.current);
  }
}
