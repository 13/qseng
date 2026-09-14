import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { PersonDetailComponent } from './person-detail.component';
import { PersonFamilyComponent } from './person-family.component';
import { PersonStore } from './person.store';
import { BreadcrumbService } from '../../core/ui/breadcrumb.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TimelineComponent } from '../timeline/timeline.component';
import { PersonMediaComponent } from './person-media.component';

@Component({ selector: 'qs-person-family', template: '' })
class StubFamily {}

@Component({ selector: 'qs-timeline', template: '' })
class StubTimeline {}

@Component({ selector: 'qs-person-media', template: '' })
class StubMedia {}

const person = { id: 'p1', treeId: 't1', firstName: 'Konrad', lastName: 'Smith', maidenName: null, sex: 'Male' as const,
  birth: { year: 1843, month: 11, day: 5 }, birthPlace: 'Bregenz', death: { year: 1909 }, causeOfDeath: null, notes: 'Weber' };

function setup(loaded = true) {
  const store = {
    load: vi.fn(), person: signal(loaded ? person : null), tree: signal({ id: 't1', name: 'Familie' }), relations: signal([]),
    treePersons: signal([]), timeline: signal([]), media: signal([]), loading: signal(false), error: signal(''),
    avatarUrl: signal(null), fullName: signal('Konrad Smith'), reloadRelations: vi.fn(), reloadTimeline: vi.fn(), reloadMedia: vi.fn()
  };
  const crumbs = { set: vi.fn() };
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideNoopAnimations(),
    { provide: BreadcrumbService, useValue: crumbs },
    { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k } }] });
  TestBed.overrideComponent(PersonDetailComponent, { set: { providers: [{ provide: PersonStore, useValue: store }] } });
  TestBed.overrideComponent(PersonDetailComponent, {
    remove: { imports: [PersonFamilyComponent, TimelineComponent, PersonMediaComponent] },
    add: { imports: [StubFamily, StubTimeline, StubMedia] }
  });
  const fixture = TestBed.createComponent(PersonDetailComponent);
  fixture.componentRef.setInput('id', 'p1');
  fixture.detectChanges();
  return { fixture, store, crumbs };
}

describe('PersonDetailComponent', () => {
  it('loads the store for the route id and sets breadcrumbs', () => {
    const { store, crumbs } = setup();
    expect(store.load).toHaveBeenCalledWith('p1');
    expect(crumbs.set).toHaveBeenCalledWith([{ label: 'trees.title', link: ['/trees'] }, { label: 'Familie', link: ['/trees', 't1'] }, { label: 'Konrad Smith' }]);
  });

  it('reloads the store when the route id changes', () => {
    const { fixture, store } = setup();
    fixture.componentRef.setInput('id', 'p2');
    fixture.detectChanges();
    expect(store.load).toHaveBeenCalledWith('p2');
    expect(store.load).toHaveBeenCalledTimes(2);
  });

  it('renders the identity card with lifespan, places and notes', () => {
    const { fixture } = setup();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Konrad Smith');
    expect(text).toContain('1843 – 1909');
    expect(text).toContain('Bregenz');
    expect(text).toContain('Weber');
    expect(text).toContain('05.11.1843');
  });
});
