import { Injectable, inject, signal } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';

export interface Crumb { label: string; link?: unknown[]; }

@Injectable({ providedIn: 'root' })
export class BreadcrumbService {
  private readonly _crumbs = signal<Crumb[]>([]);
  readonly crumbs = this._crumbs.asReadonly();

  constructor() {
    inject(Router).events.pipe(filter(e => e instanceof NavigationStart)).subscribe(() => this._crumbs.set([]));
  }

  set(crumbs: Crumb[]) { this._crumbs.set(crumbs); }
}
