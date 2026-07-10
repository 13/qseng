import { Pipe, PipeTransform, inject } from '@angular/core';
import { PartialDate } from '../../core/api/api-client.service';
import { I18nService } from '../../core/i18n/i18n.service';

@Pipe({ name: 'partialDate', standalone: true, pure: false })
export class PartialDatePipe implements PipeTransform {
  private i18n = inject(I18nService);

  transform(value?: PartialDate | null): string {
    if (!value || value.year == null) return this.i18n.t('date.unknown');
    const prefix = value.approx ? '~' : '';
    if (value.day != null && value.month != null)
      return `${prefix}${String(value.day).padStart(2,'0')}.${String(value.month).padStart(2,'0')}.${value.year}`;
    if (value.month != null)
      return `${prefix}${String(value.month).padStart(2,'0')}.${value.year}`;
    return `${prefix}${value.year}`;
  }
}
