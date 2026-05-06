import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _dark = signal(localStorage.getItem('theme') === 'dark');
  readonly dark = this._dark.asReadonly();

  constructor() {
    this.apply(this._dark());
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
