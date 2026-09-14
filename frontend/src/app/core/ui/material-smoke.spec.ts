import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { describe, expect, it } from 'vitest';

@Component({
  imports: [MatButtonModule, MatIconModule],
  template: `<button matButton="filled"><mat-icon>park</mat-icon>Trees</button>`
})
class HostComponent {}

describe('Material setup', () => {
  it('renders a filled button with an icon', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('button.mat-mdc-button-base')).not.toBeNull();
    expect(el.querySelector('mat-icon')?.textContent?.trim()).toBe('park');
  });
});
