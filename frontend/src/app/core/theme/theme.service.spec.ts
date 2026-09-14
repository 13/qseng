import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute('data-color-scheme'); });

  it('defaults to auto and writes color-scheme "light dark"', () => {
    const theme = TestBed.inject(ThemeService);
    expect(theme.mode()).toBe('auto');
    expect(document.documentElement.getAttribute('data-color-scheme')).toBe('light dark');
  });

  it('setMode persists and applies the scheme', () => {
    const theme = TestBed.inject(ThemeService);
    theme.setMode('dark');
    expect(document.documentElement.getAttribute('data-color-scheme')).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(theme.isDark()).toBe(true);
  });

  it('cycle goes auto -> light -> dark -> auto', () => {
    const theme = TestBed.inject(ThemeService);
    theme.cycle(); expect(theme.mode()).toBe('light');
    theme.cycle(); expect(theme.mode()).toBe('dark');
    theme.cycle(); expect(theme.mode()).toBe('auto');
  });
});
