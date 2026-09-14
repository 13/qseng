import { Pipe, PipeTransform, inject } from '@angular/core';
import { PartialDate } from '../../core/api/generated';
import { I18nService } from '../../core/i18n/i18n.service';
import { formatPartialDate } from '../ui/partial-date';

@Pipe({ name: 'partialDate', standalone: true, pure: false })
export class PartialDatePipe implements PipeTransform {
  private i18n = inject(I18nService);
  transform(value?: PartialDate | null): string {
    return formatPartialDate(value) || this.i18n.t('date.unknown');
  }
}
