import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _dark = signal(ThemeService.initialDark());
  readonly dark = this._dark.asReadonly();

  constructor() {
    this.apply(this._dark());
  }

  /** Stored choice wins; otherwise follow the OS preference. */
  private static initialDark(): boolean {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }

  toggle() {
    const isDark = !this._dark();
    this._dark.set(isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    this.apply(isDark);
  }

  private apply(dark: boolean) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }
}
