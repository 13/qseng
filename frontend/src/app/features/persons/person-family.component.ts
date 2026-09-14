import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { PersonRelationDto, RelationshipDto, RelationshipsApi } from '../../core/api/generated';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationKey } from '../../core/i18n/translation-keys';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import { ToastService } from '../../core/ui/toast.service';
import { PersonStore } from './person.store';
import { RelationshipDialogComponent, RelationshipDialogData } from './relationship-dialog.component';

interface Group { key: TranslationKey; icon: string; items: PersonRelationDto[]; }

@Component({
  selector: 'qs-person-family',
  imports: [RouterLink, MatChipsModule, MatButtonModule, MatIconModule, TranslatePipe],
  template: `
    <section class="qs-family">
      <div class="qs-family__header">
        <h2>{{ 'fam.title' | translate }}</h2>
        <button matButton (click)="openAdd()"><mat-icon>person_add</mat-icon>{{ 'fam.add' | translate }}</button>
      </div>
      @if (!hasAny()) { <p class="qs-muted">{{ 'fam.noRels' | translate }}</p> }
      @for (g of groups(); track g.key) {
        @if (g.items.length) {
          <div class="qs-family__group">
            <p class="qs-family__label"><mat-icon aria-hidden="true">{{ g.icon }}</mat-icon>{{ g.key | translate }}</p>
            <mat-chip-set>
              @for (r of g.items; track r.relationshipId) {
                <mat-chip class="qs-family__chip">
                  <a class="qs-family__link" [routerLink]="['/persons', r.relatedPersonId]">
                    {{ r.relatedFirstName }} {{ r.relatedLastName }}
                    @if (r.type === 'Spouse' && r.startYear) { <span class="qs-muted">&nbsp;{{ r.startYear }}</span> }
                  </a>
                  <button matChipRemove [tabIndex]="0" [attr.aria-label]="('fam.remove' | translate) + ': ' + r.relatedFirstName + ' ' + r.relatedLastName"
                          (click)="remove(r)"><mat-icon>cancel</mat-icon></button>
                </mat-chip>
              }
            </mat-chip-set>
          </div>
        }
      }
    </section>
  `,
  styles: [`
    .qs-family__header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 16px 0 8px; }
    .qs-family__header h2 { font-size: 1.15rem; }
    .qs-family__group { margin-bottom: 10px; }
    .qs-family__label { display: flex; align-items: center; gap: 4px; margin: 0 0 4px; font-size: .8rem; letter-spacing: .04em; text-transform: uppercase; color: var(--mat-sys-on-surface-variant); }
    .qs-family__label mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .qs-family__link { color: inherit; text-decoration: none; display: block; }
  `]
})
export class PersonFamilyComponent {
  readonly store = inject(PersonStore);
  private readonly api = inject(RelationshipsApi);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly groups = computed<Group[]>(() => {
    const rels = this.store.relations();
    return [
      { key: 'fam.parents', icon: 'family_restroom', items: rels.filter(r => r.type === 'Parent' && r.direction === 'to') },
      { key: 'fam.spouses', icon: 'favorite', items: rels.filter(r => r.type === 'Spouse') },
      { key: 'fam.children', icon: 'child_care', items: rels.filter(r => r.type === 'Parent' && r.direction === 'from') },
      { key: 'fam.adoptiveParents', icon: 'volunteer_activism', items: rels.filter(r => r.type === 'Adoptive' && r.direction === 'to') },
      { key: 'fam.adoptiveChildren', icon: 'child_care', items: rels.filter(r => r.type === 'Adoptive' && r.direction === 'from') }
    ];
  });
  readonly hasAny = computed(() => this.groups().some(g => g.items.length > 0));

  async openAdd() {
    const person = this.store.person();
    const treeId = person?.treeId;
    if (!person || !treeId) return;
    const data: RelationshipDialogData = { treeId, persons: this.store.treePersons(), anchor: person };
    const ref = this.dialog.open<RelationshipDialogComponent, RelationshipDialogData, RelationshipDto | undefined>(RelationshipDialogComponent, { data, width: '520px', maxWidth: '95vw' });
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;
    this.toast.success(this.i18n.t('rel.added.toast'));
    this.store.reloadRelations();
    this.store.reloadTimeline();
  }

  async remove(r: PersonRelationDto) {
    const treeId = this.store.person()?.treeId;
    if (!treeId || !r.relationshipId) return;
    const name = `${r.relatedFirstName ?? ''} ${r.relatedLastName ?? ''}`.trim();
    const ok = await this.confirm.confirm({ title: this.i18n.t('fam.remove'), message: this.i18n.t('fam.removeConfirm').replace('__NAME__', name), confirmLabel: this.i18n.t('remove'), destructive: true });
    if (ok !== true) return;
    this.api.relationshipsDelete({ treeId, id: r.relationshipId }).subscribe({
      next: () => { this.toast.success(this.i18n.t('rel.removed.toast')); this.store.reloadRelations(); this.store.reloadTimeline(); },
      error: e => this.toast.errorFrom(e, this.i18n.t('err.delete'))
    });
  }
}
