import { Pipe, PipeTransform } from '@angular/core';
import { PartialDate } from '../../core/api/api-client.service';

@Pipe({ name: 'partialDate', standalone: true })
export class PartialDatePipe implements PipeTransform {
  transform(value?: PartialDate | null): string {
    if (!value || value.year == null) return 'unbekannt';
    const prefix = value.approx ? '~' : '';
    if (value.day != null && value.month != null)
      return `${prefix}${String(value.day).padStart(2,'0')}.${String(value.month).padStart(2,'0')}.${value.year}`;
    if (value.month != null)
      return `${prefix}${String(value.month).padStart(2,'0')}.${value.year}`;
    return `${prefix}${value.year}`;
  }
}
