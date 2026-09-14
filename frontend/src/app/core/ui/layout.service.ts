import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { map } from 'rxjs';

export const QUERIES = {
  handset: '(max-width: 599.98px)',
  tablet: '(min-width: 600px) and (max-width: 1023.98px)',
  desktop: '(min-width: 1024px)'
} as const;

@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly observer = inject(BreakpointObserver);

  private readonly state = toSignal(
    this.observer.observe(Object.values(QUERIES)).pipe(map(s => s.breakpoints)),
    { initialValue: { [QUERIES.handset]: false, [QUERIES.tablet]: false, [QUERIES.desktop]: true } as Record<string, boolean> }
  );

  readonly handset = computed(() => this.state()[QUERIES.handset] === true);
  readonly tablet = computed(() => this.state()[QUERIES.tablet] === true);
  readonly desktop = computed(() => !this.handset() && !this.tablet());
}
