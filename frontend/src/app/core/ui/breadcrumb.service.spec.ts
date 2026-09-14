import { TestBed } from '@angular/core/testing';
import { NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { BreadcrumbService } from './breadcrumb.service';

describe('BreadcrumbService', () => {
  it('holds crumbs and clears them when navigation starts', () => {
    const events = new Subject<unknown>();
    TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: { events } }] });
    const svc = TestBed.inject(BreadcrumbService);
    svc.set([{ label: 'Trees', link: ['/trees'] }, { label: 'Familie' }]);
    expect(svc.crumbs().map(c => c.label)).toEqual(['Trees', 'Familie']);
    events.next(new NavigationStart(1, '/x'));
    expect(svc.crumbs()).toEqual([]);
  });
});
