import { Component, EventEmitter, Input, Output, forwardRef, inject, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { PartialDate } from '../../core/api/generated';
import { I18nService } from '../../core/i18n/i18n.service';
import { formatPartialDate, isEmptyPartialDate, parsePartialDate } from './partial-date';

/** Legacy alias kept until P1c-B removes the last `[value]`/`(valueChange)` call sites. */
export type PartialDateValue = PartialDate;

/**
 * Text entry for genealogy dates: "1923", "06.1923", "12.06.1923", "~" for approximate.
 * Registers as a form control holding `PartialDate | null`; invalid text sets `{ partialDate: true }`.
 */
@Component({
  selector: 'qs-partial-date-input',
  imports: [MatFormFieldModule, MatInputModule, MatCheckboxModule],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PartialDateInputComponent), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => PartialDateInputComponent), multi: true }
  ],
  template: `
    <div class="qs-pdate">
      <mat-form-field class="qs-pdate__field">
        <mat-label>{{ label }}</mat-label>
        <input matInput type="text" [value]="text()" [disabled]="disabled()" [required]="required"
               inputmode="numeric" autocomplete="off" spellcheck="false"
               (input)="onInput($event)" (blur)="commit()" (keydown.enter)="commit()">
        <mat-hint>{{ hint || i18n.t('date.hint') }}</mat-hint>
        @if (invalid()) { <mat-error>{{ i18n.t('date.invalid') }}</mat-error> }
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

  /** Legacy two-way API (P1c-B removes it). */
  @Input() set value(v: PartialDate | null | undefined) { this.writeValue(v ?? null); }
  @Output() valueChange = new EventEmitter<PartialDate | null>();

  readonly text = signal('');
  readonly approx = signal(false);
  readonly invalid = signal(false);
  readonly disabled = signal(false);
  readonly isEmpty = signal(true);

  private current: PartialDate | null = null;
  private onChange: (v: PartialDate | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private onValidatorChange: () => void = () => undefined;

  writeValue(v: PartialDate | null): void {
    this.current = isEmptyPartialDate(v) ? null : v;
    this.text.set(formatPartialDate(this.current));
    this.approx.set(!!this.current?.approx);
    this.isEmpty.set(this.current === null);
    this.invalid.set(false);
  }
  registerOnChange(fn: (v: PartialDate | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled.set(isDisabled); }
  registerOnValidatorChange(fn: () => void): void { this.onValidatorChange = fn; }
  validate(): ValidationErrors | null { return this.invalid() ? { partialDate: true } : null; }

  onInput(e: Event) { this.text.set((e.target as HTMLInputElement).value); }

  commit() {
    const parsed = parsePartialDate(this.text());
    this.onTouched();
    if (parsed === undefined) {
      this.invalid.set(true);
      this.onValidatorChange();
      this.onChange(this.current);
      return;
    }
    this.invalid.set(false);
    this.current = parsed;
    this.text.set(formatPartialDate(parsed));
    this.approx.set(!!parsed?.approx);
    this.isEmpty.set(parsed === null);
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
    this.text.set(formatPartialDate(this.current));
    this.emit();
  }

  private emit() {
    this.onChange(this.current);
    this.valueChange.emit(this.current);
  }
}
