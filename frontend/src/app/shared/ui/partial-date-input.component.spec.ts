import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { PartialDate } from '../../core/api/generated';
import { PartialDateInputComponent } from './partial-date-input.component';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  imports: [ReactiveFormsModule, PartialDateInputComponent],
  template: `<qs-partial-date-input label="Birth" [formControl]="ctrl" />`
})
class HostComponent { ctrl = new FormControl<PartialDate | null>(null); }

@Component({
  imports: [ReactiveFormsModule, PartialDateInputComponent],
  template: `<qs-partial-date-input label="Birth" [required]="true" [formControl]="ctrl" />`
})
class RequiredHostComponent { ctrl = new FormControl<PartialDate | null>(null); }

function setup(initial: PartialDate | null = null) {
  TestBed.configureTestingModule({ providers: [{ provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k } }] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.ctrl.setValue(initial);
  fixture.detectChanges();
  const input = fixture.nativeElement.querySelector('input[type=text]') as HTMLInputElement;
  const approx = fixture.nativeElement.querySelector('input[type=checkbox]') as HTMLInputElement;
  return { fixture, host: fixture.componentInstance, input, approx };
}

function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('blur'));
}

describe('PartialDateInputComponent', () => {
  it('renders the formatted value from the form control', () => {
    const { input, approx } = setup({ year: 1923, month: 6, day: 12, approx: true });
    expect(input.value).toBe('~12.06.1923');
    expect(approx.checked).toBe(true);
  });

  it('writes a parsed PartialDate back to the control and normalises the text', () => {
    const { host, input, fixture } = setup();
    type(input, '6.1923');
    fixture.detectChanges();
    expect(host.ctrl.value).toEqual({ year: 1923, month: 6 });
    expect(input.value).toBe('06.1923');
  });

  it('flags invalid text as a form error and clears to null', () => {
    const { host, input, fixture } = setup({ year: 1900 });
    type(input, '99.99.1900');
    fixture.detectChanges();
    expect(host.ctrl.errors).toEqual({ partialDate: true });
    expect(fixture.nativeElement.querySelector('mat-error')).not.toBeNull();
    type(input, '');
    fixture.detectChanges();
    expect(host.ctrl.value).toBeNull();
    expect(host.ctrl.errors).toBeNull();
  });

  it('toggling approximate updates the control', () => {
    const { host, approx, fixture } = setup({ year: 1900 });
    approx.click();
    fixture.detectChanges();
    expect(host.ctrl.value).toEqual({ year: 1900, approx: true });
  });

  it('resetting the outer control clears the text and any error', () => {
    const { host, input, fixture } = setup({ year: 1900 });
    type(input, '99.99.1900');
    fixture.detectChanges();
    expect(host.ctrl.errors).toEqual({ partialDate: true });
    host.ctrl.reset();
    fixture.detectChanges();
    expect(input.value).toBe('');
    expect(host.ctrl.errors).toBeNull();
  });

  it('required control without a value carries a required error', () => {
    TestBed.configureTestingModule({ providers: [{ provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k } }] });
    const fixture = TestBed.createComponent(RequiredHostComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.errors).toEqual({ required: true });
  });
});
