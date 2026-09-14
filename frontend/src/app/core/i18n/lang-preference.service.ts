import { Injectable, inject } from '@angular/core';
import { UserApi } from '../api/generated';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../ui/toast.service';
import { I18nService, Lang } from './i18n.service';

/**
 * Sets the UI language and, for a signed-in user, persists it server-side.
 * Shared by the shell's language menu and the command palette so both call
 * the exact same persistence path.
 */
@Injectable({ providedIn: 'root' })
export class LangPreferenceService {
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);
  private readonly userApi = inject(UserApi);
  private readonly toast = inject(ToastService);

  set(lang: Lang) {
    this.i18n.setLang(lang);
    if (this.auth.isAuthenticated()) {
      this.userApi.userChangeLanguage({ body: { language: lang } }).subscribe({
        error: e => this.toast.errorFrom(e, this.i18n.t('err.save'))
      });
    }
  }
}
