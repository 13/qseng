import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from './i18n.service';
import { TranslationKey } from './translation-keys';

@Pipe({ name: 'translate', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  private i18n = inject(I18nService);
  // `string` is accepted for legacy templates; new code should pass TranslationKey.
  transform(key: TranslationKey | string): string { return this.i18n.dynamic(key); }
}
