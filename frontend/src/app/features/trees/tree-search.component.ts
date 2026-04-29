import { Component, OnInit, signal, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { debounceTime, distinctUntilChanged, Subject, switchMap, of } from 'rxjs';
import { ApiClient, Person, Sex } from '../../core/api/api-client.service';
import { PartialDatePipe } from '../../shared/pipes/partial-date.pipe';

function initials(p: Person): string {
  return ((p.firstName?.[0] ?? '') + (p.lastName?.[0] ?? '')).toUpperCase();
}
function sexCls(sex: Sex): string { return sex.toLowerCase(); }

@Component({
  selector: 'qs-tree-search',
  standalone: true,
  imports: [RouterLink, FormsModule, NgClass, PartialDatePipe],
  template: `
    <header class="page-header">
      <a class="back-link" [routerLink]="['/trees', treeId]">← Tree</a>
      <h1>Search</h1>
    </header>

    <div class="search-page">
      <div class="search-input-wrap">
        <span class="search-icon">🔍</span>
        <input [(ngModel)]="query" (ngModelChange)="search$.next($event)"
               placeholder="Search by name…" autofocus>
      </div>

      @if (loading()) {
        <p class="muted" style="text-align:center;padding:1rem">Searching…</p>
      } @else if (query.length >= 2 && results().length === 0) {
        <div class="empty-state">
          <span class="empty-icon">🔎</span>
          <p>No results for "<strong>{{ query }}</strong>".</p>
        </div>
      } @else {
        <ul class="search-results">
          @for (p of results(); track p.id) {
            <a class="search-result-item" [routerLink]="['/persons', p.id]">
              <div class="avatar md" [ngClass]="sexCls(p.sex)">{{ initials(p) }}</div>
              <div class="result-info">
                <h4>{{ p.lastName }}, {{ p.firstName }}
                  @if (p.maidenName) { <span style="font-weight:400;color:var(--c-text-3)"> (geb. {{ p.maidenName }})</span> }
                </h4>
                <p>
                  @if (p.birth) { * {{ p.birth | partialDate }} }
                  @if (p.birth && p.death) { · }
                  @if (p.death) { † {{ p.death | partialDate }} }
                  @if (!p.birth && !p.death) { No dates recorded }
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

  treeId  = '';
  query   = '';
  results = signal<Person[]>([]);
  loading = signal(false);
  search$ = new Subject<string>();

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
        return this.api.getPersonsByTree(this.treeId, term);
      })
    ).subscribe({
      next: res => { this.results.set(res); this.loading.set(false); },
      error: () => { this.results.set([]); this.loading.set(false); }
    });
  }
}
