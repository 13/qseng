import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from './i18n.service';

describe('I18nService', () => {
  const dictionaries: Record<string, Record<string, string>> = {
    en: { 'save': 'Save', 'rel.parent': 'Parent', 'only.en': 'English only' },
    de: { 'save': 'Speichern', 'rel.parent': 'Elternteil' }
  };

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const lang = /([a-z]{2})\.json$/.exec(url)![1];
      return new Response(JSON.stringify(dictionaries[lang]), { status: 200 });
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('loads both dictionaries once at startup', async () => {
    const i18n = TestBed.inject(I18nService);
    await i18n.load();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(i18n.t('save')).toBe('Save');
  });

  it('switches language at runtime and persists the choice', async () => {
    const i18n = TestBed.inject(I18nService);
    await i18n.load();
    i18n.setLang('de');
    expect(i18n.t('save')).toBe('Speichern');
    expect(localStorage.getItem('lang')).toBe('de');
  });

  it('falls back to English, then to the key itself', async () => {
    const i18n = TestBed.inject(I18nService);
    await i18n.load();
    i18n.setLang('de');
    expect(i18n.dynamic('only.en')).toBe('English only');
    expect(i18n.dynamic('missing.key')).toBe('missing.key');
  });

  it('formats relationship labels through the typed helper', async () => {
    const i18n = TestBed.inject(I18nService);
    await i18n.load();
    expect(i18n.relLabel('Parent')).toBe('Parent');
  });

  it('survives a failed dictionary fetch and falls back to the key', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 404 })));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => { /* silence expected warning */ });
    const i18n = TestBed.inject(I18nService);
    await expect(i18n.load()).resolves.toBeUndefined();
    expect(i18n.t('save')).toBe('save');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
