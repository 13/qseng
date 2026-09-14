import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { setServerErrors } from './server-errors';
import { FormErrorsPipe } from './form-errors.pipe';
import { I18nService } from '../i18n/i18n.service';

describe('setServerErrors', () => {
  it('maps nested paths onto controls and returns unmatched messages', () => {
    const form = new FormGroup({
      firstName: new FormControl(''),
      birth: new FormGroup({ year: new FormControl(0) })
    });
    const unmatched = setServerErrors(form, { status: 400, errors: { 'firstName': ['Required.'], 'birth.year': ['Too early.'], 'ghost': ['?'] } });
    expect(form.get('firstName')!.errors).toEqual({ server: 'Required.' });
    expect(form.get(['birth', 'year'])!.errors).toEqual({ server: 'Too early.' });
    expect(unmatched).toEqual(['?']);
  });
});

describe('FormErrorsPipe', () => {
  it('prefers server text, then translates built-in validators', () => {
    TestBed.configureTestingModule({ providers: [{ provide: I18nService, useValue: { t: (k: string) => k } }] });
    const pipe = TestBed.runInInjectionContext(() => new FormErrorsPipe());
    expect(pipe.transform({ server: 'Taken', required: true })).toBe('Taken');
    expect(pipe.transform({ required: true })).toBe('form.required');
    expect(pipe.transform({ minlength: { requiredLength: 8, actualLength: 3 } })).toBe('form.minlength'.replace('{n}', '8'));
    const c = new FormControl('', Validators.required);
    expect(pipe.transform(c.errors)).toBe('form.required');
    expect(pipe.transform(null)).toBe('');
  });
});
