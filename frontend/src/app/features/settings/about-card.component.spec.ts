import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { AboutCardComponent } from './about-card.component';
import { VersionService } from '../../core/version/version.service';
import { I18nService } from '../../core/i18n/i18n.service';

function setup() {
  const versions = { web: signal({ version: '1.2.0', commit: 'abc1234def' }), api: signal(null), load: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideNoopAnimations(),
      { provide: VersionService, useValue: versions },
      { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k, lang: signal('en') } }
    ]
  });
  const fixture = TestBed.createComponent(AboutCardComponent);
  fixture.detectChanges();
  return { fixture, versions };
}

describe('AboutCardComponent', () => {
  it('renders the web version truncated to 7 chars and — for a null API version', () => {
    const { fixture } = setup();
    const el = fixture.nativeElement as HTMLElement;
    const values = el.querySelectorAll('.qs-about__value');
    expect(values[0].textContent?.trim()).toBe('1.2.0 (abc1234)');
    expect(values[1].textContent?.trim()).toBe('—');
  });

  it('calls load() once', () => {
    const { versions } = setup();
    expect(versions.load).toHaveBeenCalledTimes(1);
  });

  it('the releases link opens GitHub releases in a new tab safely', () => {
    const { fixture } = setup();
    const el = fixture.nativeElement as HTMLElement;
    const link = el.querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://github.com/13/qseng/releases');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener');
  });
});
