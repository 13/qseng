import { ApplicationConfig, LOCALE_ID, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withRouterConfig } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatIconRegistry } from '@angular/material/icon';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MAT_SNACK_BAR_DEFAULT_OPTIONS } from '@angular/material/snack-bar';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { errorInterceptor } from './core/error.interceptor';
import { pendingInterceptor } from './core/ui/pending.interceptor';
import { I18nService, Lang } from './core/i18n/i18n.service';

/** Mirrors I18nService.initialLang(): read before the service exists so LOCALE_ID can be
 *  provided synchronously at bootstrap. */
function storedLang(): Lang {
  const stored = localStorage.getItem('lang');
  return stored === 'de' || stored === 'en' ? stored : 'en';
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: LOCALE_ID, useFactory: storedLang },
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }), withRouterConfig({ paramsInheritanceStrategy: 'always' })),
    provideHttpClient(withInterceptors([pendingInterceptor, authInterceptor, errorInterceptor])),
    provideAnimationsAsync(),
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'outline' } },
    { provide: MAT_SNACK_BAR_DEFAULT_OPTIONS, useValue: { duration: 4000 } },
    provideAppInitializer(async () => {
      // Both inject() calls must run synchronously, before the first `await` below — inject()
      // outside an injection context (which a suspended async function no longer has) throws
      // NG0203. Capturing the services up front and using only the captured references after
      // that point keeps this safe regardless of what gets awaited in between.
      const i18n = inject(I18nService);
      inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-rounded');

      // 'en' has built-in fallback data in @angular/core, but 'de' does not — DatePipe throws
      // "Missing locale data" for it otherwise. Registered once, unconditionally, so both an
      // initial German render and a later runtime switch to German (I18nService.lang() can
      // change without a reload) always have it. Dynamic import keeps it out of the initial
      // bundle: it lands as its own lazy chunk regardless of when this awaits.
      const localeDe = await import('@angular/common/locales/de');
      registerLocaleData(localeDe.default);
      await i18n.load();
    })
  ]
};
