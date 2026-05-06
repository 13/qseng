import { Component, OnInit, signal, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { debounceTime, distinctUntilChanged, Subject, switchMap, of } from 'rxjs';
import { ApiClient, Person, Sex } from '../../core/api/api-client.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { PartialDatePipe } from '../../shared/pipes/partial-date.pipe';

function initials(p: Person): string {
  return ((p.firstName?.[0] ?? '') + (p.lastName?.[0] ?? '')).toUpperCase();
}
function sexCls(sex: Sex): string { return sex.toLowerCase(); }

@Component({
  selector: 'qs-tree-search',
  standalone: true,
  imports: [RouterLink, FormsModule, NgClass, PartialDatePipe, TranslatePipe],
  template: `
    <header class="page-header">
      <a class="back-link" [routerLink]="['/trees', treeId]">{{ 'search.back' | translate }}</a>
      <h1>{{ 'search.title' | translate }}</h1>
    </header>

    <div class="search-page">
      <div class="search-input-wrap">
        <span class="search-icon">🔍</span>
        <input [(ngModel)]="query" (ngModelChange)="search$.next($event)"
               [placeholder]="'search.placeholder' | translate" autofocus>
      </div>

      @if (searchErr()) {
        <div class="error-msg" role="alert" style="margin:.5rem 0">{{ searchErr() }}</div>
      } @else if (loading()) {
        <p class="muted" style="text-align:center;padding:1rem">{{ 'search.searching' | translate }}</p>
      } @else if (query.length >= 2 && results().length === 0) {
        <div class="empty-state">
          <span class="empty-icon">🔎</span>
          <p>{{ ('search.noResults' | translate).replace('__Q__', query) }}</p>
        </div>
      } @else {
        <ul class="search-results">
          @for (p of results(); track p.id) {
            <a class="search-result-item" [routerLink]="['/persons', p.id]">
              <div class="avatar md" [ngClass]="sexCls(p.sex)">{{ initials(p) }}</div>
              <div class="result-info">
                <h4>{{ p.lastName }}, {{ p.firstName }}
                  @if (p.maidenName) {
                    <span style="font-weight:400;color:var(--c-text-3)"> (geb. {{ p.maidenName }})</span>
                  }
                </h4>
                <p>
                  @if (p.birth) { * {{ p.birth | partialDate }} }
                  @if (p.birth && p.death) { · }
                  @if (p.death) { † {{ p.death | partialDate }} }
                  @if (!p.birth && !p.death) { {{ 'search.noDates' | translate }} }
                </p>
              </div>
            </a>
          }
        </ul>
      }
    </div>
  `,
  styles: [`:host { display: block; }`]
})
export class TreeSearchComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api   = inject(ApiClient);
  private i18n  = inject(I18nService);

  treeId   = '';
  query    = '';
  results  = signal<Person[]>([]);
  loading  = signal(false);
  searchErr = signal('');
  search$  = new Subject<string>();

  readonly initials = initials;
  readonly sexCls   = sexCls;

  ngOnInit() {
    this.treeId = this.route.snapshot.paramMap.get('treeId')!;

    this.search$.pipe(
      debounceTime(220),
      distinctUntilChanged(),
      switchMap(term => {
        if (term.length < 2) { this.results.set([]); this.loading.set(false); return of([]); }
        this.loading.set(true);
        this.searchErr.set('');
        return this.api.getPersonsByTree(this.treeId, term);
      })
    ).subscribe({
      next: res => { this.results.set(res); this.loading.set(false); },
      error: e => {
        this.searchErr.set(e.error?.error ?? this.i18n.t('err.save'));
        this.results.set([]);
        this.loading.set(false);
      }
    });
  }
}
