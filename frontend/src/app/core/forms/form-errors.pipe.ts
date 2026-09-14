import { Pipe, PipeTransform, inject } from '@angular/core';
import { ValidationErrors } from '@angular/forms';
import { I18nService } from '../i18n/i18n.service';

/** `control.errors | formErrors` -> first human message, '' when valid. */
@Pipe({ name: 'formErrors', standalone: true, pure: false })
export class FormErrorsPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(errors: ValidationErrors | null | undefined): string {
    if (!errors) return '';
    if (typeof errors['server'] === 'string') return errors['server'];
    if (errors['required']) return this.i18n.t('form.required');
    if (errors['email']) return this.i18n.t('form.email');
    if (errors['minlength']) return this.i18n.t('form.minlength').replace('{n}', String(errors['minlength'].requiredLength));
    if (errors['maxlength']) return this.i18n.t('form.maxlength').replace('{n}', String(errors['maxlength'].requiredLength));
    if (errors['min'] || errors['max']) return this.i18n.t('form.range');
    return this.i18n.t('form.invalid');
  }
}
