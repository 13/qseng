import { Injectable, computed, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'auto';
const ORDER: ThemeMode[] = ['auto', 'light', 'dark'];

/**
 * Material's theme uses light-dark(); flipping `color-scheme` on <html> is all
 * that is needed. 'auto' follows the OS.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _mode = signal<ThemeMode>(ThemeService.stored());
  readonly mode = this._mode.asReadonly();

  private readonly systemDark = signal(window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  readonly isDark = computed(() => this._mode() === 'dark' || (this._mode() === 'auto' && this.systemDark()));

  constructor() {
    this.apply(this._mode());
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', e => {
      this.systemDark.set(e.matches);
      this.apply(this._mode());
    });
  }

  private static stored(): ThemeMode {
    const v = localStorage.getItem('theme');
    return v === 'light' || v === 'dark' ? v : 'auto';
  }

  setMode(mode: ThemeMode) {
    this._mode.set(mode);
    if (mode === 'auto') localStorage.removeItem('theme'); else localStorage.setItem('theme', mode);
    this.apply(mode);
  }

  cycle() {
    this.setMode(ORDER[(ORDER.indexOf(this._mode()) + 1) % ORDER.length]);
  }

  readonly dark = this.isDark;

  private apply(mode: ThemeMode) {
    const scheme = mode === 'auto' ? 'light dark' : mode;
    const html = document.documentElement;
    // The CSS property drives Material's light-dark(); the attribute mirrors it (jsdom drops unknown style props).
    html.style.setProperty('color-scheme', scheme);
    html.setAttribute('data-color-scheme', scheme);
  }
}
