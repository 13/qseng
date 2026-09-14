import { Injectable, computed, signal } from '@angular/core';
import { RelationshipType, Sex, TimelineEventType } from '../api/api-client.service';
import { TranslationKey } from './translation-keys';

export type Lang = 'en' | 'de';
export const LANGS: readonly Lang[] = ['en', 'de'];

type Dictionary = Record<string, string>;

/**
 * Runtime-switchable translations. Both dictionaries are fetched once at
 * bootstrap (see app.config.ts) so switching is instant and offline-safe.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly dictionaries = signal<Record<Lang, Dictionary>>({ en: {}, de: {} });
  private readonly _lang = signal<Lang>(I18nService.initialLang());
  readonly lang = this._lang.asReadonly();

  private static initialLang(): Lang {
    const stored = localStorage.getItem('lang');
    return stored === 'de' || stored === 'en' ? stored : 'en';
  }

  async load(): Promise<void> {
    const loaded = await Promise.all(LANGS.map(async lang => {
      try {
        const r = await fetch(`assets/i18n/${lang}.json`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return [lang, (await r.json()) as Dictionary] as const;
      } catch (err) {
        console.warn(`i18n: could not load ${lang} dictionary`, err);
        return [lang, {} as Dictionary] as const;
      }
    }));
    this.dictionaries.set(Object.fromEntries(loaded) as Record<Lang, Dictionary>);
  }

  /** Type-checked lookup for literal keys. */
  t(key: TranslationKey): string {
    return this.dynamic(key);
  }

  /** For keys assembled at runtime (e.g. `'rel.' + type`). Falls back en -> key. */
  dynamic(key: string): string {
    const d = this.dictionaries();
    return d[this._lang()][key] ?? d.en[key] ?? key;
  }

  setLang(lang: Lang) {
    this._lang.set(lang);
    localStorage.setItem('lang', lang);
  }

  readonly sexLabels = computed(() => ({
    Male: this.t('sex.male'), Female: this.t('sex.female')
  }));

  readonly eventTypeLabels = computed(() => ({
    Birth: this.t('event.birth'), Death: this.t('event.death'), Marriage: this.t('event.marriage'),
    Move: this.t('event.move'), Occupation: this.t('event.occupation'),
    Education: this.t('event.education'), Custom: this.t('event.custom')
  }));

  readonly relTypeLabels = computed(() => ({
    Parent: this.t('rel.parent'), Spouse: this.t('rel.spouse'), Adoptive: this.t('rel.adoptive')
  }));

  sexLabel(s: Sex): string { return this.dynamic('sex.' + s.toLowerCase()); }
  eventLabel(type: TimelineEventType): string { return this.dynamic('event.' + type.toLowerCase()); }
  relLabel(type: RelationshipType): string { return this.dynamic('rel.' + type.toLowerCase()); }
}
