import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { Router } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { PersonDto, PersonsApi, TreeDto, TreesApi } from '../../core/api/generated';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { LangPreferenceService } from '../../core/i18n/lang-preference.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ThemeService } from '../../core/theme/theme.service';
import { PaletteService } from '../../core/ui/palette.service';
import { fullName, lifespan } from '../../core/models/person-helpers';
import { personSearchText } from '../trees/tree-view/tree-graph.model';
import { PaletteAction, PaletteContext, paletteActions } from './palette-actions';

export interface CommandPaletteData {
  treeId: string | null;
}

interface PersonRow { kind: 'person'; id: string; index: number; icon: string; label: string; hint: string; personId: string; }
interface TreeRow { kind: 'tree'; id: string; index: number; icon: string; label: string; hint: string; treeId: string; }
interface ActionRow { kind: 'action'; id: string; index: number; icon: string; label: string; hint: string; action: PaletteAction; }
type PaletteRow = PersonRow | TreeRow | ActionRow;
interface PaletteGroup { key: string; label: string; rows: PaletteRow[]; }

@Component({
  selector: 'qs-command-palette',
  imports: [ReactiveFormsModule, MatIconModule, TranslatePipe],
  template: `
    <div class="qs-palette" role="dialog" [attr.aria-label]="'nav.search' | translate">
      <mat-icon aria-hidden="true">search</mat-icon>
      <input #q class="qs-palette__input" cdkFocusInitial role="combobox" aria-autocomplete="list" [attr.aria-expanded]="rows().length > 0"
             aria-controls="qs-palette-list" [attr.aria-activedescendant]="rows().length ? 'qs-pal-' + active() : null"
             [placeholder]="'palette.placeholder' | translate" [formControl]="query" (keydown.arrowdown)="move(1, $event)" (keydown.arrowup)="move(-1, $event)" (keydown.enter)="runActive($event)" (keydown.escape)="ref.close()">
      <div class="cdk-visually-hidden" aria-live="polite">{{ liveText() }}</div>
      <ul id="qs-palette-list" role="listbox" class="qs-palette__list">
        @for (g of groups(); track g.key) {
          <li role="presentation" class="qs-palette__group">{{ g.label }}</li>
          @for (r of g.rows; track r.id) {
            <!-- Options stay unfocusable by design: this is the aria-activedescendant combobox
                 pattern, so keyboard users act on them via the input's own keydown handlers
                 (ArrowUp/Down + Enter) above; click is a supplementary mouse affordance. -->
            <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
            <li role="option" [id]="'qs-pal-' + r.index" [attr.aria-selected]="r.index === active()" class="qs-palette__row" [class.qs-palette__row--active]="r.index === active()"
                (mousemove)="active.set(r.index)" (click)="run(r)">
              <mat-icon aria-hidden="true">{{ r.icon }}</mat-icon><span class="qs-palette__label">{{ r.label }}</span>@if (r.hint) { <span class="qs-muted">{{ r.hint }}</span> }
            </li>
          }
        }
        @if (!rows().length) { <li role="option" aria-selected="false" class="qs-palette__row qs-muted">{{ 'palette.noResults' | translate }}</li> }
      </ul>
    </div>
  `,
  styles: [`
    .qs-palette { width: 100%; box-sizing: border-box; display: flex; flex-direction: column; padding: 8px 16px; gap: 8px; }
    .qs-palette__input { flex: 1; width: 100%; border: 0; outline: none; background: transparent; font: inherit; color: var(--mat-sys-on-surface); padding: 12px 0; }
    .qs-palette__list { list-style: none; margin: 0; padding: 0 0 8px; max-height: 60vh; overflow: auto; }
    .qs-palette__group { padding: 8px 4px 4px; font-size: .8rem; font-weight: 500; color: var(--mat-sys-on-surface-variant); }
    .qs-palette__row { display: flex; align-items: center; gap: 10px; padding: 10px 8px; border-radius: var(--mat-sys-corner-small); cursor: pointer; min-width: 0; }
    .qs-palette__row--active { background: var(--mat-sys-secondary-container); }
    .qs-palette__label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `]
})
export class CommandPaletteComponent {
  private readonly data = inject<CommandPaletteData>(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<CommandPaletteComponent, void>);

  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly theme = inject(ThemeService);
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);
  private readonly personsApi = inject(PersonsApi);
  private readonly treesApi = inject(TreesApi);
  private readonly langPref = inject(LangPreferenceService);
  private readonly paletteService = inject(PaletteService);

  readonly query = new FormControl('', { nonNullable: true });
  private readonly term = toSignal(this.query.valueChanges.pipe(debounceTime(80)), { initialValue: '' });

  private readonly trees = signal<TreeDto[]>([]);
  private readonly persons = signal<PersonDto[]>([]);
  private readonly treeName = computed(() => this.trees().find(t => t.id === this.data.treeId)?.name ?? '');
  readonly active = signal(0);

  private readonly ctx = computed<PaletteContext>(() => ({
    treeId: this.data.treeId,
    isAdmin: this.auth.isAdmin(),
    lang: this.i18n.lang(),
    theme: this.theme.mode()
  }));

  private readonly allActions: PaletteAction[] = paletteActions({
    router: this.router,
    theme: this.theme,
    i18n: this.i18n,
    auth: this.auth,
    dialog: this.dialog,
    setLang: l => this.langPref.set(l),
    personsApi: this.personsApi,
    paletteService: this.paletteService
  });

  private readonly people = computed<PersonDto[]>(() => {
    const tokens = this.term().trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    return this.persons().filter(p => {
      const text = personSearchText(p);
      return tokens.every(t => text.includes(t));
    }).slice(0, 8);
  });

  private readonly matchingTrees = computed<TreeDto[]>(() => {
    const term = this.term().trim().toLowerCase();
    if (!term) return [];
    return this.trees().filter(t => (t.name ?? '').toLowerCase().includes(term)).slice(0, 5);
  });

  private readonly matchingActions = computed<PaletteAction[]>(() => {
    const term = this.term().trim().toLowerCase();
    const ctx = this.ctx();
    return this.allActions.filter(a => a.available(ctx) && this.i18n.t(a.labelKey).toLowerCase().includes(term));
  });

  readonly groups = computed<PaletteGroup[]>(() => {
    let i = 0;
    const groups: PaletteGroup[] = [];

    const personRows: PersonRow[] = this.people().map(p => ({
      kind: 'person', id: 'p-' + (p.id ?? ''), index: i++, icon: p.sex === 'Female' ? 'woman' : p.sex === 'Male' ? 'man' : 'person',
      label: fullName({ firstName: p.firstName ?? '', lastName: p.lastName ?? '' }), hint: lifespan({ firstName: p.firstName ?? '', lastName: p.lastName ?? '', birth: p.birth, death: p.death }), personId: p.id ?? ''
    }));
    if (personRows.length) groups.push({ key: 'people', label: this.i18n.t('palette.group.people').replace('__TREE__', this.treeName()), rows: personRows });

    const treeRows: TreeRow[] = this.matchingTrees().map(t => ({
      kind: 'tree', id: 't-' + (t.id ?? ''), index: i++, icon: 'forest', label: t.name ?? '', hint: '', treeId: t.id ?? ''
    }));
    if (treeRows.length) groups.push({ key: 'trees', label: this.i18n.t('palette.group.trees'), rows: treeRows });

    const actionRows: ActionRow[] = this.matchingActions().map(a => ({
      kind: 'action', id: 'a-' + a.id, index: i++, icon: a.icon, label: this.i18n.t(a.labelKey), hint: '', action: a
    }));
    if (actionRows.length) groups.push({ key: 'actions', label: this.i18n.t('palette.group.actions'), rows: actionRows });

    return groups;
  });

  readonly rows = computed<PaletteRow[]>(() => this.groups().flatMap(g => g.rows));

  readonly liveText = computed(() => {
    const n = this.rows().length;
    return n ? this.i18n.t('palette.results').replace('__N__', String(n)) : this.i18n.t('palette.noResults');
  });

  constructor() {
    this.treesApi.treesGetAll().subscribe({ next: ts => this.trees.set(ts), error: () => this.trees.set([]) });
    const treeId = this.data.treeId;
    if (treeId) {
      this.personsApi.personsGetByTree({ treeId }).subscribe({ next: ps => this.persons.set(ps), error: () => this.persons.set([]) });
    }
    effect(() => { this.term(); this.active.set(0); });
  }

  move(delta: number, ev: Event) {
    ev.preventDefault();
    const n = this.rows().length;
    if (!n) return;
    this.active.set((this.active() + delta + n) % n);
  }

  runActive(ev: Event) {
    ev.preventDefault();
    const row = this.rows()[this.active()];
    if (row) this.run(row);
  }

  run(row: PaletteRow) {
    if (row.kind === 'person') void this.router.navigate(['/persons', row.personId]);
    else if (row.kind === 'tree') void this.router.navigate(['/trees', row.treeId]);
    else row.action.run(this.ctx());
    this.ref.close();
  }
}
