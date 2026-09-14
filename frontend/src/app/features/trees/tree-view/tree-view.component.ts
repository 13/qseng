import {
  Component, DestroyRef, ElementRef, Injector,
  afterNextRender, computed, effect, inject, input, signal, untracked, viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, firstValueFrom } from 'rxjs';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatBottomSheet, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { PersonDto, PersonsApi } from '../../../core/api/generated';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { BreadcrumbService } from '../../../core/ui/breadcrumb.service';
import { ConfirmDialogService } from '../../../core/ui/confirm-dialog.service';
import { ToastService } from '../../../core/ui/toast.service';
import { LayoutService } from '../../../core/ui/layout.service';
import { fullName } from '../../../core/models/person-helpers';
import { RelationshipDialogComponent, RelationshipDialogData, RelationshipDialogResult } from '../../persons/relationship-dialog.component';
import { TreeStore } from './tree.store';
import { TreeGraphService } from './tree-graph.service';
import { UiRelType } from './tree-graph.model';
import { TreePeopleListComponent } from './tree-people-list.component';
import { TreeSelectionPanelComponent } from './tree-selection-panel.component';

interface CtxState { id: string; x: number; y: number; }

/** Opened in a MatBottomSheet on handset; dismisses itself on pick/open. */
@Component({
  selector: 'qs-tree-people-sheet',
  imports: [TreePeopleListComponent],
  template: `<qs-tree-people-list (picked)="ref.dismiss({ id: $event, open: false })" (open)="ref.dismiss({ id: $event, open: true })" />`,
  // Fills the qs-sheet panel's flex height so the virtual-scroll viewport inside gets a real height.
  styles: [`:host { display: flex; flex-direction: column; flex: 1; min-height: 0; }`]
})
class TreePeopleSheetComponent {
  readonly ref = inject(MatBottomSheetRef<TreePeopleSheetComponent, { id: string; open: boolean }>);
}

/** Opened in a MatBottomSheet on handset once a node is selected. */
@Component({
  selector: 'qs-tree-selection-sheet',
  imports: [TreeSelectionPanelComponent],
  template: `
    @if (store.selectedPerson(); as p) {
      <qs-tree-selection-panel [person]="p"
        (closed)="ref.dismiss({ action: 'closed' })"
        (navigate)="ref.dismiss({ action: 'navigate', id: $event })"
        (addRelation)="ref.dismiss({ action: 'addRelation', person: $event })" />
    }
  `,
  // Shorter than the people list — clear content height instead of stretching to the full panel.
  styles: [`:host { display: flex; flex-direction: column; max-height: 85dvh; min-height: 0; }`]
})
class TreeSelectionSheetComponent {
  readonly store = inject(TreeStore);
  readonly ref = inject(MatBottomSheetRef<TreeSelectionSheetComponent, { action: 'closed' } | { action: 'navigate'; id: string } | { action: 'addRelation'; person: PersonDto }>);
}

@Component({
  selector: 'qs-tree-view',
  providers: [TreeGraphService],
  imports: [RouterLink, MatSidenavModule, MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule, MatProgressBarModule,
            TranslatePipe, TreePeopleListComponent, TreeSelectionPanelComponent],
  template: `
    <div class="qs-tv">
      <header class="qs-tv__header">
        @if (!layout.handset()) {
          <button matIconButton (click)="sidenavOpen.set(!sidenavOpen())" [attr.aria-expanded]="sidenavOpen()" [attr.aria-label]="'tree.showPeople' | translate"><mat-icon>{{ sidenavOpen() ? 'left_panel_close' : 'left_panel_open' }}</mat-icon></button>
        }
        <h1 tabindex="-1" class="qs-display qs-tv__title">{{ store.tree()?.name ?? '…' }}</h1>
        <span class="qs-tv__spacer"></span>
        <a matButton [routerLink]="['/trees', treeId(), 'import']" [attr.aria-label]="'tree.import' | translate"><mat-icon>upload_file</mat-icon><span class="qs-tv__label">{{ 'tree.import' | translate }}</span></a>
        <button matButton="outlined" (click)="addRelationFree()" [attr.aria-label]="'tree.addRel' | translate"><mat-icon>group_add</mat-icon><span class="qs-tv__label">{{ 'tree.addRel' | translate }}</span></button>
        <a matButton="filled" [routerLink]="['/trees', treeId(), 'persons', 'new']" [attr.aria-label]="'tree.addPerson' | translate"><mat-icon>person_add</mat-icon><span class="qs-tv__label">{{ 'tree.addPerson' | translate }}</span></a>
      </header>

      <mat-sidenav-container class="qs-tv__body" [hasBackdrop]="layout.tablet()">
        @if (!layout.handset()) {
          <mat-sidenav [mode]="layout.tablet() ? 'over' : 'side'" [opened]="sidenavOpen()" (closedStart)="sidenavOpen.set(false)" class="qs-tv__people">
            <qs-tree-people-list (open)="open($event)" (picked)="onSelected($event)" />
          </mat-sidenav>
        }
        <mat-sidenav-content class="qs-tv__content">
          <div class="qs-tv__canvas-wrap">
            <div #cyHost class="qs-tv__canvas" tabindex="0" role="application" [attr.aria-label]="'tree.graphLabel' | translate" [attr.data-compact]="graph.compact()" (keydown)="onKey($event)"></div>

            @if (store.error()) {
              <div class="qs-tv__overlay qs-empty" role="alert">
                <mat-icon class="qs-empty__icon" aria-hidden="true">error</mat-icon>
                <p>{{ store.error() }}</p>
                <button matButton="outlined" (click)="store.reload()">{{ 'retry' | translate }}</button>
              </div>
            } @else if (store.loading() || graph.loading()) {
              <div class="qs-tv__overlay" role="status" [attr.aria-label]="'loading' | translate">
                <div class="qs-tv__skeleton">
                  @for (row of skeletonRows; track row) { <div class="qs-tv__skeleton-row"></div> }
                </div>
              </div>
            } @else if (!store.persons().length) {
              <div class="qs-tv__overlay qs-empty">
                <mat-icon class="qs-empty__icon" aria-hidden="true">park</mat-icon>
                <p>{{ 'tree.emptyTitle' | translate }}</p>
                <div class="qs-empty__actions">
                  <a matButton="filled" [routerLink]="['/trees', treeId(), 'persons', 'new']"><mat-icon>person_add</mat-icon>{{ 'tree.addPerson' | translate }}</a>
                  <a matButton [routerLink]="['/trees', treeId(), 'import']"><mat-icon>upload_file</mat-icon>{{ 'tree.import' | translate }}</a>
                </div>
              </div>
            }

            <div class="qs-tv__fabs">
              <button matMiniFab (click)="graph.fit()" [matTooltip]="'tree.fit' | translate" [attr.aria-label]="'tree.fit' | translate"><mat-icon>fit_screen</mat-icon></button>
              <button matMiniFab (click)="graph.zoomIn()" [matTooltip]="'tree.zoomIn' | translate" [attr.aria-label]="'tree.zoomIn' | translate"><mat-icon>add</mat-icon></button>
              <button matMiniFab (click)="graph.zoomOut()" [matTooltip]="'tree.zoomOut' | translate" [attr.aria-label]="'tree.zoomOut' | translate"><mat-icon>remove</mat-icon></button>
              <button matMiniFab (click)="graph.toggleLayout()" [matTooltip]="'tree.layoutToggle' | translate" [attr.aria-label]="'tree.layoutToggle' | translate">
                <mat-icon>{{ graph.layoutMode() === 'tree' ? 'account_tree' : 'auto_awesome_motion' }}</mat-icon>
              </button>
              @if (graph.hasCustomLayout()) {
                <button matMiniFab (click)="graph.resetLayout()" [matTooltip]="'tree.resetLayout' | translate" [attr.aria-label]="'tree.resetLayout' | translate"><mat-icon>restart_alt</mat-icon></button>
              }
              <button matMiniFab (click)="exportPng()" [matTooltip]="'tree.export' | translate" [attr.aria-label]="'tree.export' | translate"><mat-icon>download</mat-icon></button>
            </div>

            <div class="qs-tv__ctx" aria-hidden="true" [style.left.px]="ctx()?.x ?? 0" [style.top.px]="ctx()?.y ?? 0" [matMenuTriggerFor]="ctxMenu" (menuClosed)="focusCanvas()"></div>
            <mat-menu #ctxMenu="matMenu">
              @if (ctxPerson(); as p) {
                <button mat-menu-item (click)="open(p.id!)"><mat-icon>open_in_new</mat-icon>{{ 'tree.openProfile' | translate }}</button>
                <a mat-menu-item [routerLink]="['/persons', p.id, 'edit']"><mat-icon>edit</mat-icon>{{ 'tree.edit' | translate }}</a>
                <button mat-menu-item (click)="addRelationFor(p, 'Parent')"><mat-icon>arrow_upward</mat-icon>{{ 'tree.ctx.addParent' | translate }}</button>
                <button mat-menu-item (click)="addRelationFor(p, 'Child')"><mat-icon>arrow_downward</mat-icon>{{ 'tree.ctx.addChild' | translate }}</button>
                <button mat-menu-item (click)="addRelationFor(p, 'Spouse')"><mat-icon>favorite</mat-icon>{{ 'tree.ctx.addSpouse' | translate }}</button>
                <button mat-menu-item (click)="onSelected(p.id!)"><mat-icon>center_focus_strong</mat-icon>{{ 'tree.ctx.focus' | translate }}</button>
                <button mat-menu-item (click)="deletePerson(p)"><mat-icon>delete</mat-icon>{{ 'tree.ctx.remove' | translate }}</button>
              }
            </mat-menu>

            @if (layout.handset()) { <button matFab class="qs-tv__fab" (click)="openPeopleSheet()" [attr.aria-label]="'tree.showPeople' | translate"><mat-icon>group</mat-icon></button> }
          </div>
          @if (!layout.handset() && store.selectedPerson(); as p) {
            <aside class="qs-tv__panel"><qs-tree-selection-panel [person]="p" (closed)="onSelected(null)" (navigate)="onSelected($event)" (addRelation)="addRelationFor($event)" /></aside>
          }
        </mat-sidenav-content>
      </mat-sidenav-container>
    </div>
  `,
  styles: [`
    .qs-tv { height: calc(100dvh - var(--qs-toolbar-h)); display: flex; flex-direction: column; }
    .qs-tv__header { display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .qs-tv__title { margin: 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .qs-tv__spacer { flex: 1; }
    .qs-tv__body { flex: 1; min-height: 0; }
    .qs-tv__people { width: 300px; }
    .qs-tv__content { display: flex; }
    .qs-tv__canvas-wrap { position: relative; flex: 1; min-width: 0; overflow: hidden; }
    .qs-tv__canvas { width: 100%; height: 100%; outline: none; }
    .qs-tv__canvas:focus-visible { box-shadow: inset 0 0 0 2px var(--mat-sys-primary); }
    .qs-tv__overlay { position: absolute; inset: 0; z-index: 5; display: flex; align-items: center; justify-content: center; background: var(--mat-sys-surface); }
    .qs-tv__skeleton { display: grid; grid-template-columns: repeat(3, 140px); gap: 16px; }
    .qs-tv__skeleton-row { width: 140px; height: 64px; border-radius: var(--mat-sys-corner-medium); background: var(--mat-sys-surface-container-highest); opacity: .5; }
    .qs-tv__fabs { position: absolute; top: 16px; right: 16px; z-index: 10; display: flex; flex-direction: column; gap: 8px; }
    .qs-tv__ctx { position: absolute; width: 0; height: 0; }
    .qs-tv__fab { position: absolute; right: 16px; bottom: 16px; z-index: 10; }
    .qs-tv__panel { width: 320px; border-left: 1px solid var(--mat-sys-outline-variant); overflow: auto; }
    @media (max-width: 599.98px) { .qs-tv__label { display: none; } }
  `]
})
export class TreeViewComponent {
  private readonly cyHost = viewChild<ElementRef<HTMLElement>>('cyHost');
  private readonly ctxTrigger = viewChild(MatMenuTrigger);

  readonly treeId = input.required<string>();
  readonly q = input<string>();

  readonly store = inject(TreeStore);
  readonly graph = inject(TreeGraphService);
  readonly layout = inject(LayoutService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly sheet = inject(MatBottomSheet);
  private readonly personsApi = inject(PersonsApi);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly i18n = inject(I18nService);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  // Not `takeUntilDestroyed` on the delete request itself: a delete in flight should still
  // land server-side even if the user navigates away mid-request. This flag only stops the
  // now-pointless UI follow-up (toast/reload) from touching a destroyed component.
  private destroyed = false;

  readonly sidenavOpen = signal(true);
  readonly skeletonRows = [0, 1, 2, 3, 4, 5];

  readonly ctx = signal<CtxState | null>(null);
  readonly ctxPerson = computed(() => { const c = this.ctx(); return c ? this.store.personById(c.id) ?? null : null; });

  private readonly filter$ = new Subject<string>();

  constructor() {
    this.destroyRef.onDestroy(() => { this.destroyed = true; });
    effect(() => {
      const persons = this.store.persons(); const rels = this.store.relationships();
      const host = this.cyHost()?.nativeElement;
      if (!host || !persons.length) { this.graph.loading.set(false); return; }
      void this.graph.build(host, persons, rels, {
        onSelect: id => this.onSelected(id), onOpen: id => this.open(id), onContext: (id, x, y) => this.onContext(id, x, y)
      }).then(() => { const sel = this.store.selectedId(); if (sel) this.graph.select(sel); });
    });
    // One-directional: the graph is the source of truth for tap-to-select, but a
    // store-driven selection (sidebar pick, "focus lineage", chip navigation)
    // must not be reverted by this effect re-running on its own write-back.
    let lastGraphSelected = this.graph.selectedId();
    effect(() => {
      const id = this.graph.selectedId();
      if (id !== lastGraphSelected) {
        lastGraphSelected = id;
        untracked(() => { this.spouseCycleAnchor = null; this.store.select(id); });
      }
    });
    this.filter$.pipe(debounceTime(150), takeUntilDestroyed()).subscribe(t => this.graph.searchTerm.set(t));
    effect(() => this.filter$.next(this.store.filter()));

    effect(() => {
      const tree = this.store.tree();
      if (!tree) return;
      this.crumbs.set([{ label: this.i18n.t('trees.title'), link: ['/trees'] }, { label: tree.name ?? '…' }]);
    });

    effect(() => {
      this.store.load(this.treeId());
      untracked(() => { const q = this.q(); if (q) this.store.setFilter(q); });
    });
  }

  focusCanvas(): void {
    this.cyHost()?.nativeElement.focus();
  }

  onSelected(id: string | null): void {
    this.spouseCycleAnchor = null;
    this.store.select(id);
    this.graph.select(id);
    if (id && this.layout.handset()) {
      const ref = this.sheet.open(TreeSelectionSheetComponent, { injector: this.injector, panelClass: ['qs-sheet', 'qs-sheet--auto'] });
      ref.afterDismissed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
        if (!result) return;
        if (result.action === 'closed') this.onSelected(null);
        else if (result.action === 'navigate') this.onSelected(result.id);
        else void this.addRelationFor(result.person);
      });
    }
  }

  open(id: string): void {
    void this.router.navigate(['/persons', id]);
  }

  openPeopleSheet(): void {
    const ref = this.sheet.open(TreePeopleSheetComponent, { injector: this.injector, panelClass: 'qs-sheet' });
    ref.afterDismissed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
      if (!result) return;
      if (result.open) this.open(result.id);
      else this.onSelected(result.id);
    });
  }

  onContext(id: string, x: number, y: number): void {
    this.ctx.set({ id, x, y });
    afterNextRender(() => this.ctxTrigger()?.openMenu(), { injector: this.injector });
  }

  async addRelationFor(person: PersonDto, presetType?: UiRelType): Promise<void> {
    await this.openRelationshipDialog({ treeId: this.treeId(), persons: this.store.persons(), anchor: person, presetType });
  }

  async addRelationFree(): Promise<void> {
    await this.openRelationshipDialog({ treeId: this.treeId(), persons: this.store.persons() });
  }

  private async openRelationshipDialog(data: RelationshipDialogData): Promise<void> {
    const ref = this.dialog.open<RelationshipDialogComponent, RelationshipDialogData, RelationshipDialogResult | undefined>(
      RelationshipDialogComponent, { data, width: '520px', maxWidth: '95vw' }
    );
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;
    this.store.reload();
    if (result.created) {
      const created = result.created;
      const key = 'rel.added.' + result.uiType.toLowerCase();
      const name = fullName({ firstName: created.firstName ?? '', lastName: created.lastName ?? '' });
      this.toast.success(this.i18n.dynamic(key).replace('__NAME__', name), {
        action: this.i18n.t('rel.open'),
        onAction: () => this.open(created.id!)
      });
      if (created.id) this.onSelected(created.id);
    } else {
      this.toast.success(this.i18n.t('rel.added.toast'));
    }
  }

  async deletePerson(person: PersonDto): Promise<void> {
    if (!person.id) return;
    const name = fullName({ firstName: person.firstName ?? '', lastName: person.lastName ?? '' });
    const ok = await this.confirmDialog.confirm({
      title: this.i18n.t('pe.deleteTitle'), message: this.i18n.t('pe.deleteConfirm').replace('__NAME__', name),
      confirmLabel: this.i18n.t('delete'), destructive: true
    });
    if (ok !== true) return;
    // No takeUntilDestroyed: the DELETE should complete server-side even if the component is
    // destroyed mid-request (e.g. the user navigates away). The `destroyed` guard below just
    // skips the now-pointless UI follow-up.
    this.personsApi.personsDelete({ id: person.id }).subscribe({
      next: () => {
        if (this.destroyed) return;
        this.store.reload();
        this.toast.undoable(this.i18n.t('tree.deleted.undo').replace('__NAME__', name), () => firstValueFrom(this.personsApi.personsRestore({ id: person.id! })).then(() => {
          this.store.reload();
          this.onSelected(person.id!);
        }));
      },
      error: e => {
        if (this.destroyed) return;
        this.toast.errorFrom(e, this.i18n.t('err.delete'));
      }
    });
  }

  onKey(e: KeyboardEvent): void {
    switch (e.key) {
      case '+': case '=': this.graph.zoomIn(); break;
      case '-': this.graph.zoomOut(); break;
      case '0': this.graph.fit(); break;
      case 'Escape': this.onSelected(null); break;
      case 'ArrowUp': this.moveSelection('parents'); break;
      case 'ArrowDown': this.moveSelection('children'); break;
      case 'ArrowLeft': this.moveSelection('spouses', -1); break;
      case 'ArrowRight': this.moveSelection('spouses', +1); break;
      case 'Enter': { const id = this.store.selectedId(); if (id) this.open(id); break; }
      default: return;
    }
    e.preventDefault();
  }

  exportPng(): void {
    this.graph.exportPng(`${this.store.tree()?.name || 'family-tree'}.png`);
  }

  // Tracks who the arrow keys are cycling spouses *of*, since after the first
  // press `store.selectedId()` becomes a spouse rather than the original
  // person — and that spouse's own spousesOf list is a different set.
  private spouseCycleAnchor: string | null = null;

  private moveSelection(kind: 'parents' | 'children' | 'spouses', step = 1): void {
    const id = this.store.selectedId();
    if (!id) return;
    if (kind !== 'spouses') { const target = this.store.relativesOf(id)[kind][0]; if (target?.id) this.onSelected(target.id); return; }

    const anchor = this.spouseCycleAnchor && this.store.relativesOf(this.spouseCycleAnchor).spouses.some(p => p.id === id)
      ? this.spouseCycleAnchor
      : id;
    const anchorPerson = this.store.personById(anchor);
    const list = anchorPerson ? [anchorPerson, ...this.store.relativesOf(anchor).spouses] : this.store.relativesOf(anchor).spouses;
    if (!list.length) return;
    const idx = list.findIndex(p => p.id === id);
    const target = idx === -1 ? (step > 0 ? list[0] : list[list.length - 1]) : list[(idx + step + list.length) % list.length];
    if (!target?.id) return;
    this.onSelected(target.id);
    this.spouseCycleAnchor = anchor;
  }
}
