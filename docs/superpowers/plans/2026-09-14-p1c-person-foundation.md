# P1c-A Person Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the person-page foundation on Material: `MediaKind` in the contract, a `PartialDate` form control, a route-scoped `PersonStore`, the rebuilt person detail page with its family section and the shared relationship dialog.

**Architecture:** Backend `MediaDto.Kind` becomes the `MediaKind` enum so the generated client gets a string union. `PartialDateInputComponent` is rewritten as a `ControlValueAccessor` inside a `mat-form-field` (single text field parsing `DD.MM.YYYY` / `MM.YYYY` / `YYYY` with `~` for approximate, plus an approximate checkbox). `PersonStore` (provided on the person routes) loads person, tree, relations, timeline and media once and exposes signals plus local mutation helpers. `PersonDetailComponent` renders the left identity card and a `mat-tab-group`; `PersonFamilyComponent` renders grouped chips and opens `RelationshipDialogComponent`, which owns its API call (P1b contract) and is reused by the tree view in P1d. Timeline, media, person edit and import follow in plan P1c-B.

**Tech Stack:** ASP.NET Core 10, Angular 21.2 zoneless, Angular Material 21.2.14, Reactive Forms, Vitest, generated client (`PersonsApi`, `RelationshipsApi`, `TimelineApi`, `MediaApi`, `TreesApi`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-14-p1-material-rewrite-design.md` §4 Person detail, Partial date input; §6 State (`PersonStore`).
- Branch `feat/material-rewrite`. Do not touch `features/trees/tree-view/**`, `features/trees/tree-search.component.ts`, `core/api/api-client.service.ts`; `features/timeline/**`, `features/persons/person-media.component.ts`, `features/persons/person-edit.component.ts` and `features/import/**` stay legacy until P1c-B (they must keep compiling; `PersonDetailComponent` keeps embedding the legacy `qs-timeline` and `qs-person-media` until P1c-B replaces them).
- P1b contracts: components report HTTP failures with `ToastService.errorFrom(err, fallback)`; dialogs inject the API, stay open on error (`setServerErrors` onto their form, unmatched messages in an inline `error` signal), close with the created entity; parents reload. Page headings are `<h1 tabindex="-1">`. Shared layout classes live in `styles/_base.scss` (`.qs-page-header`, `.qs-form-error`, `.qs-dialog-form`, `.qs-empty*`). Use `takeUntilDestroyed()` on subscriptions in components that can be left mid-request (store loads).
- No `ngModel`, no emoji, no native `confirm()`, no `autofocus`; strings via `translate`/`t()` with keys in BOTH dictionaries (sorted) followed by `npm run gen:i18n --prefix frontend`.
- Generated shapes: `PersonsApi.personsGetById({ id })`, `personsGetRelations({ id })`, `personsGetByTree({ treeId, search? })`, `personsDelete({ id })`; `RelationshipsApi.relationshipsCreate({ treeId, body: RelationshipRequest })`, `relationshipsDelete({ treeId, id })`; `TimelineApi.timelineGet({ personId })`; `MediaApi.mediaGetMedia({ personId })`; `TreesApi.treesGetAll()`. `PartialDate { year?, month?, day?, approx?, isUnknown?, sortableDate? }` (all optional/nullable). `PersonRelationDto { relationshipId, type, direction: 'from'|'to' (typed string), relatedPersonId, relatedFirstName, relatedLastName, relatedMaidenName, startYear, notes }`.
- Relationship semantics (from `tree-graph.model.ts`): UI types `Parent | Child | Spouse | Adoptive`; `toApiRelationship(uiType, roleHolderId, counterpartId)` maps `Child` to a `Parent` edge from counterpart to role holder. In the person page the picked person is the role holder relative to the current person (picking "Parent" = the picked person is the parent).
- `cd` is broken in the sandbox shell; use `--prefix`, `-C`, absolute paths. `ng test` always with `--watch=false` inside `timeout 180`; stale workers: `ps -eo pid,args | grep "suppress-warn[i]ng" | awk '{print $1}' | xargs -r kill -9`. Never `pkill -f` a pattern in your own command line.
- Test baseline at start: read it from the ledger (`.superpowers/sdd/progress.md`) after P1b's final fix; the plan states deltas per task instead of absolutes.
- Commit messages end with the attribution lines from the session's system reminder.

## File structure produced by this plan

```
backend/src/Qseng.Application/Media/MediaDto.cs           Kind: MediaKind
backend/src/Qseng.Application/Media/GetPersonMedia/GetPersonMediaQuery.cs, UploadMedia/UploadMediaCommand.cs  no ToString()
contracts/openapi.json                                    re-exported
frontend/src/app/shared/ui/partial-date-input.component.ts   CVA rewrite + spec
frontend/src/app/shared/pipes/partial-date.pipe.ts        import from generated
frontend/src/app/shared/ui/partial-date.ts                parse/format helpers + spec
frontend/src/app/features/persons/person.store.ts         route-scoped store + spec
frontend/src/app/features/persons/person-detail.component.ts  rewrite + spec
frontend/src/app/features/persons/person-family.component.ts  grouped chips + spec
frontend/src/app/features/persons/relationship-dialog.component.ts  shared dialog + spec
frontend/src/app/app.routes.ts                            providers: [PersonStore] on person routes
frontend/public/assets/i18n/{en,de}.json, core/i18n/translation-keys.ts
```

---

### Task 1: `MediaKind` in the contract

**Files:**
- Modify: `backend/src/Qseng.Application/Media/MediaDto.cs`
- Modify: `backend/src/Qseng.Application/Media/GetPersonMedia/GetPersonMediaQuery.cs:32`, `backend/src/Qseng.Application/Media/UploadMedia/UploadMediaCommand.cs:48`
- Modify: `backend/tests/Qseng.Application.Tests/Media/AvatarTests.cs` (only if it asserts on `Kind` as a string)
- Modify: `contracts/openapi.json` (regenerated)

**Interfaces:**
- Produces: generated `MediaKind = 'Photo' | 'Document' | 'Audio'` and `MediaDto.kind?: MediaKind`.

- [ ] **Step 1: Change the DTO**

`backend/src/Qseng.Application/Media/MediaDto.cs`:
```csharp
using Qseng.Domain.Enums;

namespace Qseng.Application.Media;

public record MediaDto(
    Guid Id, Guid PersonId, string Url, string? Caption, MediaKind Kind, DateTime CreatedAt,
    bool IsAvatar = false);
```
In `GetPersonMediaQuery.cs` line 32 and `UploadMediaCommand.cs` line 48 replace `m.Kind.ToString()` / `media.Kind.ToString()` with `m.Kind` / `media.Kind`.

- [ ] **Step 2: Build and test**

Run: `dotnet test /home/ben/repo/qseng/backend/Qseng.slnx -nologo -v q 2>&1 | grep -E "Passed!|Failed!|error CS"`
Expected: Domain 13, Application 49, Api 8 passed. If `AvatarTests` compares `Kind` to `"Photo"`, change the assertion to `MediaKind.Photo`.

- [ ] **Step 3: Re-export and regenerate**

Run: `/home/ben/repo/qseng/backend/export-openapi.sh && python3 -c "import json;s=json.load(open('/home/ben/repo/qseng/contracts/openapi.json'));print(s['components']['schemas']['MediaKind'], s['components']['schemas']['MediaDto']['properties']['kind'])"`
Expected: `{'enum': ['Photo', 'Document', 'Audio'], 'type': 'string'} {'$ref': '#/components/schemas/MediaKind'}`.
Run: `npm run gen:api --prefix /home/ben/repo/qseng/frontend && cat /home/ben/repo/qseng/frontend/src/app/core/api/generated/models/media-kind.ts | grep export`
Expected: `export type MediaKind = 'Photo' | 'Document' | 'Audio';`

- [ ] **Step 4: Frontend still compiles**

Run: `npx --prefix /home/ben/repo/qseng/frontend ng build --configuration production 2>&1 | grep -E "complete|error"` → completion line. (Legacy `person-media.component.ts` uses the hand-written `ApiClient`, so it is unaffected.)

- [ ] **Step 5: Commit**

```bash
git add backend contracts
git commit -m "feat(api): MediaDto.Kind is the MediaKind enum so the client gets a string union"
```

---

### Task 2: PartialDate helpers and the form control

**Files:**
- Create: `frontend/src/app/shared/ui/partial-date.ts` + `partial-date.spec.ts`
- Modify: `frontend/src/app/shared/ui/partial-date-input.component.ts` (rewrite) + create `partial-date-input.component.spec.ts`
- Modify: `frontend/src/app/shared/pipes/partial-date.pipe.ts` (import `PartialDate` from generated; use `formatPartialDate`)
- Modify: legacy call sites that still use `[value]`/`(valueChange)` — `features/persons/person-edit.component.ts`, `features/persons/person-relations.component.ts`, `features/timeline/timeline.component.ts`, `features/timeline/timeline-event-card.component.ts` — keep compiling by switching them to the control's `value`/`valueChange` compatibility inputs (see Step 4); they are rewritten in P1c-B.

**Interfaces:**
- `parsePartialDate(text: string): PartialDate | null` (null when empty; `undefined`-free object otherwise), `formatPartialDate(d: PartialDate | null | undefined): string` (`''` when no year; `~` prefix when approx), `isEmptyPartialDate(d)`.
- `PartialDateInputComponent` selector `qs-partial-date-input`, `ControlValueAccessor` for `PartialDate | null`, inputs `label` (string), `hint` (default `'date.hint'` text), `required` (boolean); compatibility inputs `value` / output `valueChange` for legacy call sites (removed in P1c-B).

- [ ] **Step 1: Helpers spec (failing)**

`frontend/src/app/shared/ui/partial-date.spec.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { formatPartialDate, isEmptyPartialDate, parsePartialDate } from './partial-date';

describe('parsePartialDate', () => {
  it('parses year, month.year and day.month.year with optional ~', () => {
    expect(parsePartialDate('1923')).toEqual({ year: 1923 });
    expect(parsePartialDate('06.1923')).toEqual({ year: 1923, month: 6 });
    expect(parsePartialDate('12.06.1923')).toEqual({ year: 1923, month: 6, day: 12 });
    expect(parsePartialDate('~ 1923')).toEqual({ year: 1923, approx: true });
  });
  it('returns null for empty and undefined for invalid input', () => {
    expect(parsePartialDate('')).toBeNull();
    expect(parsePartialDate('   ')).toBeNull();
    expect(parsePartialDate('31.02.1923')).toBeUndefined();
    expect(parsePartialDate('abc')).toBeUndefined();
    expect(parsePartialDate('13.1923')).toBeUndefined();
  });
});

describe('formatPartialDate', () => {
  it('formats to the canonical DD.MM.YYYY form', () => {
    expect(formatPartialDate({ year: 1923 })).toBe('1923');
    expect(formatPartialDate({ year: 1923, month: 6 })).toBe('06.1923');
    expect(formatPartialDate({ year: 1923, month: 6, day: 2, approx: true })).toBe('~02.06.1923');
    expect(formatPartialDate(null)).toBe('');
    expect(formatPartialDate({ month: 6 })).toBe('');
  });
  it('isEmptyPartialDate', () => {
    expect(isEmptyPartialDate(null)).toBe(true);
    expect(isEmptyPartialDate({ year: null })).toBe(true);
    expect(isEmptyPartialDate({ year: 1900 })).toBe(false);
  });
});
```

- [ ] **Step 2: Helpers**

`frontend/src/app/shared/ui/partial-date.ts`:
```ts
import { PartialDate } from '../../core/api/generated';

const MAX_YEAR = 2099;

function daysIn(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Accepts "YYYY", "MM.YYYY", "DD.MM.YYYY", each optionally prefixed with "~".
 * Empty → null. Anything else → undefined (invalid).
 */
export function parsePartialDate(text: string): PartialDate | null | undefined {
  const raw = text.trim();
  if (!raw) return null;
  const approx = raw.startsWith('~');
  const parts = (approx ? raw.slice(1) : raw).trim().split('.').map(p => p.trim());
  const nums = parts.map(p => (/^\d+$/.test(p) ? Number(p) : NaN));
  if (nums.some(Number.isNaN)) return undefined;
  const withApprox = (d: PartialDate): PartialDate => (approx ? { ...d, approx: true } : d);

  if (nums.length === 1) {
    const [year] = nums;
    return year >= 1 && year <= MAX_YEAR ? withApprox({ year }) : undefined;
  }
  if (nums.length === 2) {
    const [month, year] = nums;
    return month >= 1 && month <= 12 && year >= 1 && year <= MAX_YEAR ? withApprox({ year, month }) : undefined;
  }
  if (nums.length === 3) {
    const [day, month, year] = nums;
    const ok = month >= 1 && month <= 12 && year >= 1 && year <= MAX_YEAR && day >= 1 && day <= daysIn(year, month);
    return ok ? withApprox({ year, month, day }) : undefined;
  }
  return undefined;
}

export function isEmptyPartialDate(d: PartialDate | null | undefined): boolean {
  return d == null || d.year == null;
}

/** "~02.06.1923", "06.1923", "1923" or "" when the year is unknown. */
export function formatPartialDate(d: PartialDate | null | undefined): string {
  if (isEmptyPartialDate(d)) return '';
  const { year, month, day, approx } = d as PartialDate;
  const p = approx ? '~' : '';
  const mm = month != null ? String(month).padStart(2, '0') : null;
  const dd = day != null ? String(day).padStart(2, '0') : null;
  if (mm && dd) return `${p}${dd}.${mm}.${year}`;
  if (mm) return `${p}${mm}.${year}`;
  return `${p}${year}`;
}
```
Run the helpers spec: expected `Tests  4 passed (4)`.

- [ ] **Step 3: Control spec (failing)**

`frontend/src/app/shared/ui/partial-date-input.component.spec.ts`:
```ts
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { PartialDate } from '../../core/api/generated';
import { PartialDateInputComponent } from './partial-date-input.component';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  imports: [ReactiveFormsModule, PartialDateInputComponent],
  template: `<qs-partial-date-input label="Birth" [formControl]="ctrl" />`
})
class HostComponent { ctrl = new FormControl<PartialDate | null>(null); }

function setup(initial: PartialDate | null = null) {
  TestBed.configureTestingModule({ providers: [{ provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k } }] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.ctrl.setValue(initial);
  fixture.detectChanges();
  const input = fixture.nativeElement.querySelector('input[type=text]') as HTMLInputElement;
  const approx = fixture.nativeElement.querySelector('input[type=checkbox]') as HTMLInputElement;
  return { fixture, host: fixture.componentInstance, input, approx };
}

function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('blur'));
}

describe('PartialDateInputComponent', () => {
  it('renders the formatted value from the form control', () => {
    const { input, approx } = setup({ year: 1923, month: 6, day: 12, approx: true });
    expect(input.value).toBe('~12.06.1923');
    expect(approx.checked).toBe(true);
  });

  it('writes a parsed PartialDate back to the control and normalises the text', () => {
    const { host, input, fixture } = setup();
    type(input, '6.1923');
    fixture.detectChanges();
    expect(host.ctrl.value).toEqual({ year: 1923, month: 6 });
    expect(input.value).toBe('06.1923');
  });

  it('flags invalid text as a form error and clears to null', () => {
    const { host, input, fixture } = setup({ year: 1900 });
    type(input, '99.99.1900');
    fixture.detectChanges();
    expect(host.ctrl.errors).toEqual({ partialDate: true });
    type(input, '');
    fixture.detectChanges();
    expect(host.ctrl.value).toBeNull();
    expect(host.ctrl.errors).toBeNull();
  });

  it('toggling approximate updates the control', () => {
    const { host, approx, fixture } = setup({ year: 1900 });
    approx.click();
    fixture.detectChanges();
    expect(host.ctrl.value).toEqual({ year: 1900, approx: true });
  });
});
```

- [ ] **Step 4: Control implementation**

`frontend/src/app/shared/ui/partial-date-input.component.ts`:
```ts
import { Component, EventEmitter, Input, Output, forwardRef, inject, signal } from '@angular/core';
import { AbstractControl, ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { PartialDate } from '../../core/api/generated';
import { I18nService } from '../../core/i18n/i18n.service';
import { formatPartialDate, isEmptyPartialDate, parsePartialDate } from './partial-date';

/** Legacy alias kept until P1c-B removes the last `[value]`/`(valueChange)` call sites. */
export type PartialDateValue = PartialDate;

/**
 * Text entry for genealogy dates: "1923", "06.1923", "12.06.1923", "~" for approximate.
 * Registers as a form control holding `PartialDate | null`; invalid text sets `{ partialDate: true }`.
 */
@Component({
  selector: 'qs-partial-date-input',
  imports: [MatFormFieldModule, MatInputModule, MatCheckboxModule],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PartialDateInputComponent), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => PartialDateInputComponent), multi: true }
  ],
  template: `
    <div class="qs-pdate">
      <mat-form-field class="qs-pdate__field">
        <mat-label>{{ label }}</mat-label>
        <input matInput type="text" [value]="text()" [disabled]="disabled()" [required]="required"
               inputmode="numeric" autocomplete="off" spellcheck="false"
               (input)="onInput($event)" (blur)="commit()" (keydown.enter)="commit()">
        <mat-hint>{{ hint || i18n.t('date.hint') }}</mat-hint>
        @if (invalid()) { <mat-error>{{ i18n.t('date.invalid') }}</mat-error> }
      </mat-form-field>
      <mat-checkbox class="qs-pdate__approx" [checked]="approx()" [disabled]="disabled() || isEmpty()"
                    (change)="setApprox($event.checked)">{{ i18n.t('pe.approx') }}</mat-checkbox>
    </div>
  `,
  styles: [`
    .qs-pdate { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
    .qs-pdate__field { flex: 1 1 180px; }
    .qs-pdate__approx { flex: 0 0 auto; }
  `]
})
export class PartialDateInputComponent implements ControlValueAccessor, Validator {
  readonly i18n = inject(I18nService);

  @Input() label = '';
  @Input() hint = '';
  @Input() required = false;

  /** Legacy two-way API (P1c-B removes it). */
  @Input() set value(v: PartialDate | null | undefined) { this.writeValue(v ?? null); }
  @Output() valueChange = new EventEmitter<PartialDate | null>();

  readonly text = signal('');
  readonly approx = signal(false);
  readonly invalid = signal(false);
  readonly disabled = signal(false);
  readonly isEmpty = signal(true);

  private current: PartialDate | null = null;
  private onChange: (v: PartialDate | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private onValidatorChange: () => void = () => undefined;

  writeValue(v: PartialDate | null): void {
    this.current = isEmptyPartialDate(v) ? null : v;
    this.text.set(formatPartialDate(this.current));
    this.approx.set(!!this.current?.approx);
    this.isEmpty.set(this.current === null);
    this.invalid.set(false);
  }
  registerOnChange(fn: (v: PartialDate | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled.set(isDisabled); }
  registerOnValidatorChange(fn: () => void): void { this.onValidatorChange = fn; }
  validate(_control: AbstractControl): ValidationErrors | null { return this.invalid() ? { partialDate: true } : null; }

  onInput(e: Event) { this.text.set((e.target as HTMLInputElement).value); }

  commit() {
    const parsed = parsePartialDate(this.text());
    this.onTouched();
    if (parsed === undefined) {
      this.invalid.set(true);
      this.onValidatorChange();
      this.onChange(this.current);
      return;
    }
    this.invalid.set(false);
    this.current = parsed;
    this.text.set(formatPartialDate(parsed));
    this.approx.set(!!parsed?.approx);
    this.isEmpty.set(parsed === null);
    this.onValidatorChange();
    this.emit();
  }

  setApprox(checked: boolean) {
    if (!this.current) return;
    this.current = checked ? { ...this.current, approx: true } : (({ approx: _a, ...rest }) => rest)(this.current);
    this.approx.set(checked);
    this.text.set(formatPartialDate(this.current));
    this.emit();
  }

  private emit() {
    this.onChange(this.current);
    this.valueChange.emit(this.current);
  }
}
```
Add the key `"date.invalid": "Use DD.MM.YYYY, MM.YYYY or YYYY (prefix ~ for approximate)."` / `"date.invalid": "Format TT.MM.JJJJ, MM.JJJJ oder JJJJ (mit ~ für ungefähr)."` to both dictionaries and run `gen:i18n`.

`frontend/src/app/shared/pipes/partial-date.pipe.ts`:
```ts
import { Pipe, PipeTransform, inject } from '@angular/core';
import { PartialDate } from '../../core/api/generated';
import { I18nService } from '../../core/i18n/i18n.service';
import { formatPartialDate } from '../ui/partial-date';

@Pipe({ name: 'partialDate', standalone: true, pure: false })
export class PartialDatePipe implements PipeTransform {
  private i18n = inject(I18nService);
  transform(value?: PartialDate | null): string {
    return formatPartialDate(value) || this.i18n.t('date.unknown');
  }
}
```

Legacy call sites: the four legacy components bind `[value]="x" (valueChange)="x = $event"` where `x: PartialDateValue = {}`. They keep compiling because `value` accepts `PartialDate | null | undefined` and `valueChange` emits `PartialDate | null`; change their handlers to `(valueChange)="x = $event ?? {}"` and remove the `prefix="…"` attribute (no longer an input). List every edited line in the report.

- [ ] **Step 5: Run specs, suite, build**

Run the two new specs: helpers 4/4, control 4/4. Full suite: baseline + 8 tests, + 2 files. Production build clean.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/shared frontend/src/app/features/persons/person-edit.component.ts frontend/src/app/features/persons/person-relations.component.ts frontend/src/app/features/timeline frontend/public/assets/i18n frontend/src/app/core/i18n/translation-keys.ts
git commit -m "feat(ui): PartialDate form control (ControlValueAccessor) on Material with parse/format helpers"
```

---

### Task 3: PersonStore

**Files:**
- Create: `frontend/src/app/features/persons/person.store.ts` + `person.store.spec.ts`
- Modify: `frontend/src/app/app.routes.ts` (add `providers: [PersonStore]` to `persons/:id` and `persons/:id/edit`; `trees/:treeId/persons/new` too)

**Interfaces:**
```ts
@Injectable()
export class PersonStore {
  readonly person: Signal<PersonDto | null>; readonly tree: Signal<TreeDto | null>;
  readonly relations: Signal<PersonRelationDto[]>; readonly timeline: Signal<TimelineEventDto[]>;
  readonly media: Signal<MediaDto[]>; readonly treePersons: Signal<PersonDto[]>;
  readonly loading: Signal<boolean>; readonly error: Signal<string>;
  readonly avatarUrl: Signal<string | null>;            // isAvatar media ?? first Photo ?? person.avatarUrl
  readonly fullName: Signal<string>;
  load(personId: string): void;                          // loads person, then tree/relations/timeline/media/treePersons in parallel
  reloadRelations(): void; reloadTimeline(): void; reloadMedia(): void;
  setPerson(p: PersonDto): void;                         // after edit
  upsertEvent(e: TimelineEventDto): void; removeEvent(id: string): void;
  addMedia(m: MediaDto): void; removeMedia(id: string): void; setAvatar(id: string): void;
}
```

- [ ] **Step 1: Spec (failing)**

`frontend/src/app/features/persons/person.store.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it, vi } from 'vitest';
import { PersonStore } from './person.store';
import { MediaApi, PersonsApi, TimelineApi, TreesApi } from '../../core/api/generated';
import { I18nService } from '../../core/i18n/i18n.service';

const person = { id: 'p1', treeId: 't1', firstName: 'Konrad', lastName: 'Smith', sex: 'Male' as const, avatarUrl: null };

function setup(fail = false) {
  const persons = {
    personsGetById: vi.fn(() => fail ? throwError(() => new HttpErrorResponse({ status: 404, error: { status: 404, title: 'Not Found', detail: 'gone' } })) : of(person)),
    personsGetRelations: vi.fn(() => of([{ relationshipId: 'r1', type: 'Spouse', direction: 'from', relatedPersonId: 'p2', relatedFirstName: 'Maria', relatedLastName: 'Smith', startYear: 1872 }])),
    personsGetByTree: vi.fn(() => of([person, { id: 'p2', treeId: 't1', firstName: 'Maria', lastName: 'Smith', sex: 'Female' }]))
  };
  const trees = { treesGetAll: vi.fn(() => of([{ id: 't1', name: 'Familie' }])) };
  const timeline = { timelineGet: vi.fn(() => of([{ id: 'e1', type: 'Marriage', title: 'x', start: { year: 1872 } }])) };
  const media = { mediaGetMedia: vi.fn(() => of([{ id: 'm1', personId: 'p1', url: '/u/1.jpg', kind: 'Photo', isAvatar: false }, { id: 'm2', personId: 'p1', url: '/u/2.jpg', kind: 'Photo', isAvatar: true }])) };
  TestBed.configureTestingModule({
    providers: [PersonStore,
      { provide: PersonsApi, useValue: persons }, { provide: TreesApi, useValue: trees },
      { provide: TimelineApi, useValue: timeline }, { provide: MediaApi, useValue: media },
      { provide: I18nService, useValue: { t: (k: string) => k } }]
  });
  return { store: TestBed.inject(PersonStore), persons, trees, timeline, media };
}

describe('PersonStore', () => {
  it('loads the person and its dependants', () => {
    const { store, persons, trees } = setup();
    store.load('p1');
    expect(store.person()?.firstName).toBe('Konrad');
    expect(store.tree()?.name).toBe('Familie');
    expect(store.relations().length).toBe(1);
    expect(store.timeline().length).toBe(1);
    expect(store.media().length).toBe(2);
    expect(store.treePersons().length).toBe(2);
    expect(store.avatarUrl()).toBe('/u/2.jpg');
    expect(store.fullName()).toBe('Konrad Smith');
    expect(store.loading()).toBe(false);
    expect(persons.personsGetByTree).toHaveBeenCalledWith({ treeId: 't1' });
    expect(trees.treesGetAll).toHaveBeenCalledTimes(1);
  });

  it('exposes a load error and stops loading', () => {
    const { store } = setup(true);
    store.load('p1');
    expect(store.person()).toBeNull();
    expect(store.error()).toBe('gone');
    expect(store.loading()).toBe(false);
  });

  it('applies local mutations', () => {
    const { store } = setup();
    store.load('p1');
    store.upsertEvent({ id: 'e2', type: 'Custom', title: 'new' });
    expect(store.timeline().length).toBe(2);
    store.removeEvent('e1');
    expect(store.timeline().map(e => e.id)).toEqual(['e2']);
    store.setAvatar('m1');
    expect(store.avatarUrl()).toBe('/u/1.jpg');
    store.removeMedia('m1');
    expect(store.media().length).toBe(1);
    store.setPerson({ ...person, firstName: 'Kurt' });
    expect(store.fullName()).toBe('Kurt Smith');
  });
});
```

- [ ] **Step 2: Store**

`frontend/src/app/features/persons/person.store.ts`:
```ts
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MediaApi, MediaDto, PersonDto, PersonRelationDto, PersonsApi, TimelineApi, TimelineEventDto, TreeDto, TreesApi } from '../../core/api/generated';
import { I18nService } from '../../core/i18n/i18n.service';
import { problemMessage } from '../../core/api/problem-details';
import { fullName } from '../../core/models/person-helpers';

/** One source of truth for the person routes; provided per route so it dies with the page. */
@Injectable()
export class PersonStore {
  private readonly personsApi = inject(PersonsApi);
  private readonly treesApi = inject(TreesApi);
  private readonly timelineApi = inject(TimelineApi);
  private readonly mediaApi = inject(MediaApi);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _person = signal<PersonDto | null>(null);
  private readonly _tree = signal<TreeDto | null>(null);
  private readonly _relations = signal<PersonRelationDto[]>([]);
  private readonly _timeline = signal<TimelineEventDto[]>([]);
  private readonly _media = signal<MediaDto[]>([]);
  private readonly _treePersons = signal<PersonDto[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal('');

  readonly person = this._person.asReadonly();
  readonly tree = this._tree.asReadonly();
  readonly relations = this._relations.asReadonly();
  readonly timeline = this._timeline.asReadonly();
  readonly media = this._media.asReadonly();
  readonly treePersons = this._treePersons.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly fullName = computed(() => { const p = this._person(); return p ? fullName({ firstName: p.firstName ?? '', lastName: p.lastName ?? '' }) : ''; });
  readonly avatarUrl = computed(() => {
    const m = this._media();
    return (m.find(x => x.isAvatar) ?? m.find(x => x.kind === 'Photo'))?.url ?? this._person()?.avatarUrl ?? null;
  });

  load(personId: string) {
    this._loading.set(true);
    this._error.set('');
    this.personsApi.personsGetById({ id: personId }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: p => {
        this._person.set(p);
        const treeId = p.treeId ?? '';
        forkJoin({
          trees: this.treesApi.treesGetAll().pipe(catchError(() => of([] as TreeDto[]))),
          relations: this.personsApi.personsGetRelations({ id: personId }).pipe(catchError(() => of([] as PersonRelationDto[]))),
          timeline: this.timelineApi.timelineGet({ personId }).pipe(catchError(() => of([] as TimelineEventDto[]))),
          media: this.mediaApi.mediaGetMedia({ personId }).pipe(catchError(() => of([] as MediaDto[]))),
          persons: this.personsApi.personsGetByTree({ treeId }).pipe(catchError(() => of([] as PersonDto[])))
        }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(r => {
          this._tree.set(r.trees.find(t => t.id === treeId) ?? null);
          this._relations.set(r.relations);
          this._timeline.set(r.timeline);
          this._media.set(r.media);
          this._treePersons.set(r.persons);
          this._loading.set(false);
        });
      },
      error: e => { this._error.set(problemMessage(e, this.i18n.t('err.load'))); this._loading.set(false); }
    });
  }

  reloadRelations() { const id = this._person()?.id; if (id) this.personsApi.personsGetRelations({ id }).subscribe(r => this._relations.set(r)); }
  reloadTimeline() { const personId = this._person()?.id; if (personId) this.timelineApi.timelineGet({ personId }).subscribe(t => this._timeline.set(t)); }
  reloadMedia() { const personId = this._person()?.id; if (personId) this.mediaApi.mediaGetMedia({ personId }).subscribe(m => this._media.set(m)); }

  setPerson(p: PersonDto) { this._person.set(p); }
  upsertEvent(e: TimelineEventDto) { this._timeline.update(list => list.some(x => x.id === e.id) ? list.map(x => (x.id === e.id ? e : x)) : [...list, e]); }
  removeEvent(id: string) { this._timeline.update(list => list.filter(e => e.id !== id)); }
  addMedia(m: MediaDto) { this._media.update(list => [...list, m]); }
  removeMedia(id: string) { this._media.update(list => list.filter(m => m.id !== id)); }
  setAvatar(id: string) { this._media.update(list => list.map(m => ({ ...m, isAvatar: m.id === id }))); }
}
```

Routes: in `frontend/src/app/app.routes.ts` add `providers: [PersonStore]` (import from `./features/persons/person.store`) to the three person routes (`trees/:treeId/persons/new`, `persons/:id`, `persons/:id/edit`).

- [ ] **Step 3: Run spec, suite, build; commit**

Spec 3/3; suite baseline + 11 tests / + 3 files. Build clean.
```bash
git add frontend/src/app/features/persons/person.store.ts frontend/src/app/features/persons/person.store.spec.ts frontend/src/app/app.routes.ts
git commit -m "feat(persons): route-scoped PersonStore over the generated client"
```

---

### Task 4: Relationship dialog (shared with the tree view)

**Files:**
- Create: `frontend/src/app/features/persons/relationship-dialog.component.ts` + spec
- Modify: i18n JSON (+ keys), regenerate

**Interfaces:**
- `RelationshipDialogData { treeId: string; persons: PersonDto[]; anchor?: PersonDto; presetType?: UiRelType }`. When `anchor` is given the dialog asks for the *other* person and the type describes the picked person's role relative to the anchor (`Parent` = picked person is the anchor's parent). Without an anchor (tree view use) the dialog shows two pickers, "from" (role holder) and "to".
- Closes with the created `RelationshipDto` or `undefined`. Owns `relationshipsCreate`.
- Reuses `UI_REL_TYPES`, `UiRelType`, `toApiRelationship` from `features/trees/tree-view/tree-graph.model.ts` (pure module, allowed to import).

- [ ] **Step 1: i18n**

Add (`en` / `de`):
```json
"rel.dialog.title": "Add relationship",
"rel.dialog.person": "Person",
"rel.dialog.from": "Person (role holder)",
"rel.dialog.to": "Related to",
"rel.dialog.type": "Relationship",
"rel.dialog.date": "Date (marriage / adoption)",
"rel.dialog.place": "Place",
"rel.dialog.roleHint": "The type describes the picked person's role: choosing Parent means they are the parent.",
"rel.dialog.submit": "Add",
"rel.added.toast": "Relationship added.",
"rel.removed.toast": "Relationship removed."
```
```json
"rel.dialog.title": "Beziehung hinzufügen",
"rel.dialog.person": "Person",
"rel.dialog.from": "Person (Rolleninhaber)",
"rel.dialog.to": "In Beziehung zu",
"rel.dialog.type": "Beziehung",
"rel.dialog.date": "Datum (Hochzeit / Adoption)",
"rel.dialog.place": "Ort",
"rel.dialog.roleHint": "Der Typ beschreibt die Rolle der gewählten Person: Elternteil heißt, sie ist das Elternteil.",
"rel.dialog.submit": "Hinzufügen",
"rel.added.toast": "Beziehung hinzugefügt.",
"rel.removed.toast": "Beziehung entfernt."
```

- [ ] **Step 2: Spec (failing)**

`frontend/src/app/features/persons/relationship-dialog.component.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { RelationshipDialogComponent } from './relationship-dialog.component';
import { RelationshipsApi } from '../../core/api/generated';
import { ToastService } from '../../core/ui/toast.service';
import { I18nService } from '../../core/i18n/i18n.service';

const anchor = { id: 'me', treeId: 't1', firstName: 'Konrad', lastName: 'Smith', sex: 'Male' as const };
const other = { id: 'p2', treeId: 't1', firstName: 'Maria', lastName: 'Escobar', sex: 'Female' as const, birth: { year: 1850 } };

function setup(fail = false, data: object = { treeId: 't1', persons: [anchor, other], anchor }) {
  const api = { relationshipsCreate: vi.fn(() => fail
    ? throwError(() => new HttpErrorResponse({ status: 409, error: { status: 409, title: 'Conflict', detail: 'Already related' } }))
    : of({ id: 'r1', treeId: 't1', type: 'Parent', fromPersonId: 'p2', toPersonId: 'me' })) };
  const ref = { close: vi.fn() };
  const toast = { errorFrom: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() };
  TestBed.configureTestingModule({ providers: [provideNoopAnimations(),
    { provide: MAT_DIALOG_DATA, useValue: data }, { provide: MatDialogRef, useValue: ref },
    { provide: RelationshipsApi, useValue: api }, { provide: ToastService, useValue: toast },
    { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k, relLabel: (t: string) => t } }] });
  const fixture = TestBed.createComponent(RelationshipDialogComponent);
  fixture.detectChanges();
  return { cmp: fixture.componentInstance, api, ref, toast, fixture };
}

describe('RelationshipDialogComponent', () => {
  it('filters candidates by name and never offers the anchor itself', () => {
    const { cmp } = setup();
    cmp.form.controls.person.setValue('esc');
    expect(cmp.candidates().map(p => p.id)).toEqual(['p2']);
    cmp.form.controls.person.setValue('kon');
    expect(cmp.candidates()).toEqual([]);
  });

  it('creates a Parent edge from the picked person to the anchor and closes with the DTO', () => {
    const { cmp, api, ref } = setup();
    cmp.form.controls.type.setValue('Parent');
    cmp.pick(other);
    cmp.save();
    expect(api.relationshipsCreate).toHaveBeenCalledWith({ treeId: 't1', body: expect.objectContaining({ type: 'Parent', fromPersonId: 'p2', toPersonId: 'me' }) });
    expect(ref.close).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }));
  });

  it('sends date and place for a spouse and maps Child to a reversed Parent edge', () => {
    const { cmp, api } = setup();
    cmp.form.controls.type.setValue('Spouse');
    cmp.pick(other);
    cmp.form.controls.startDate.setValue({ year: 1872, month: 5 });
    cmp.form.controls.place.setValue('Bregenz');
    cmp.save();
    expect(api.relationshipsCreate).toHaveBeenLastCalledWith({ treeId: 't1', body: { type: 'Spouse', fromPersonId: 'p2', toPersonId: 'me', startYear: 1872, startMonth: 5, startDay: null, notes: 'Bregenz' } });
    cmp.form.controls.type.setValue('Child');
    cmp.save();
    expect(api.relationshipsCreate).toHaveBeenLastCalledWith({ treeId: 't1', body: expect.objectContaining({ type: 'Parent', fromPersonId: 'me', toPersonId: 'p2' }) });
  });

  it('stays open and shows the problem detail on failure; requires a picked person', () => {
    const { cmp, api, ref, toast } = setup(true);
    cmp.save();
    expect(api.relationshipsCreate).not.toHaveBeenCalled();
    cmp.pick(other);
    cmp.save();
    expect(ref.close).not.toHaveBeenCalled();
    expect(toast.errorFrom).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Component**

`frontend/src/app/features/persons/relationship-dialog.component.ts`:
```ts
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { PartialDate, PersonDto, RelationshipDto, RelationshipRequest, RelationshipsApi } from '../../core/api/generated';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ToastService } from '../../core/ui/toast.service';
import { FormErrorsPipe } from '../../core/forms/form-errors.pipe';
import { setServerErrors } from '../../core/forms/server-errors';
import { isValidationProblem } from '../../core/api/problem-details';
import { fullName, lifespan } from '../../core/models/person-helpers';
import { PartialDateInputComponent } from '../../shared/ui/partial-date-input.component';
import { UI_REL_TYPES, UiRelType, toApiRelationship } from '../trees/tree-view/tree-graph.model';

export interface RelationshipDialogData {
  treeId: string;
  persons: PersonDto[];
  /** When set, the dialog asks only for the other person (person page). */
  anchor?: PersonDto;
  presetType?: UiRelType;
}

function matches(p: PersonDto, term: string): boolean {
  const t = term.toLowerCase();
  return `${p.firstName ?? ''} ${p.lastName ?? ''} ${p.maidenName ?? ''}`.toLowerCase().includes(t);
}

@Component({
  selector: 'qs-relationship-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatAutocompleteModule,
            MatButtonModule, TranslatePipe, FormErrorsPipe, PartialDateInputComponent],
  template: `
    <h2 mat-dialog-title>{{ 'rel.dialog.title' | translate }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content class="qs-dialog-form">
        <mat-form-field>
          <mat-label>{{ 'rel.dialog.type' | translate }}</mat-label>
          <mat-select formControlName="type">
            @for (t of types; track t) { <mat-option [value]="t">{{ i18n.dynamic('rel.' + t.toLowerCase()) }}</mat-option> }
          </mat-select>
          <mat-hint>{{ 'rel.dialog.roleHint' | translate }}</mat-hint>
        </mat-form-field>

        @if (!data.anchor) {
          <mat-form-field>
            <mat-label>{{ 'rel.dialog.from' | translate }}</mat-label>
            <input matInput formControlName="from" [matAutocomplete]="fromAuto" autocomplete="off">
            <mat-autocomplete #fromAuto="matAutocomplete" (optionSelected)="pickFrom($event)" [displayWith]="display">
              @for (p of fromCandidates(); track p.id) { <mat-option [value]="p">{{ label(p) }}</mat-option> }
            </mat-autocomplete>
          </mat-form-field>
        }

        <mat-form-field>
          <mat-label>{{ (data.anchor ? 'rel.dialog.person' : 'rel.dialog.to') | translate }}</mat-label>
          <input matInput formControlName="person" [matAutocomplete]="auto" autocomplete="off">
          <mat-autocomplete #auto="matAutocomplete" (optionSelected)="pickFromEvent($event)" [displayWith]="display">
            @for (p of candidates(); track p.id) { <mat-option [value]="p">{{ label(p) }}</mat-option> }
          </mat-autocomplete>
          <mat-error>{{ form.controls.person.errors | formErrors }}</mat-error>
        </mat-form-field>

        @if (form.controls.type.value === 'Spouse' || form.controls.type.value === 'Adoptive') {
          <qs-partial-date-input formControlName="startDate" [label]="'rel.dialog.date' | translate" />
          <mat-form-field>
            <mat-label>{{ 'rel.dialog.place' | translate }}</mat-label>
            <input matInput formControlName="place" maxlength="200">
          </mat-form-field>
        }

        @if (error()) { <p class="qs-form-error" role="alert">{{ error() }}</p> }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" (click)="ref.close()">{{ 'cancel' | translate }}</button>
        <button matButton="filled" type="submit" [disabled]="saving()">{{ 'rel.dialog.submit' | translate }}</button>
      </mat-dialog-actions>
    </form>
  `
})
export class RelationshipDialogComponent {
  readonly data = inject<RelationshipDialogData>(MAT_DIALOG_DATA);
  readonly ref = inject<MatDialogRef<RelationshipDialogComponent, RelationshipDto | undefined>>(MatDialogRef);
  readonly i18n = inject(I18nService);
  private readonly api = inject(RelationshipsApi);
  private readonly toast = inject(ToastService);

  readonly types = UI_REL_TYPES;
  readonly saving = signal(false);
  readonly error = signal('');
  private readonly picked = signal<PersonDto | null>(null);
  private readonly pickedFrom = signal<PersonDto | null>(null);

  readonly form = inject(FormBuilder).nonNullable.group({
    type: [this.data.presetType ?? ('Parent' as UiRelType)],
    from: [''],
    person: ['', Validators.required],
    startDate: [null as PartialDate | null],
    place: ['']
  });

  private readonly personTerm = toSignal(this.form.controls.person.valueChanges, { initialValue: '' });
  private readonly fromTerm = toSignal(this.form.controls.from.valueChanges, { initialValue: '' });

  readonly candidates = computed(() => this.filter(this.personTerm(), this.data.anchor?.id ?? this.pickedFrom()?.id));
  readonly fromCandidates = computed(() => this.filter(this.fromTerm(), this.picked()?.id));

  private filter(term: unknown, excludeId: string | undefined): PersonDto[] {
    if (typeof term !== 'string' || term.trim().length < 1) return [];
    return this.data.persons.filter(p => p.id !== excludeId && matches(p, term.trim())).slice(0, 8);
  }

  readonly display = (p: PersonDto | string | null) => (typeof p === 'string' ? p : p ? fullName({ firstName: p.firstName ?? '', lastName: p.lastName ?? '' }) : '');
  label(p: PersonDto) { const l = lifespan({ firstName: '', lastName: '', birth: p.birth, death: p.death }); return `${this.display(p)}${l ? ` (${l})` : ''}`; }

  pick(p: PersonDto) { this.picked.set(p); this.form.controls.person.setValue(this.display(p)); }
  pickFromEvent(e: MatAutocompleteSelectedEvent) { this.pick(e.option.value as PersonDto); }
  pickFrom(e: MatAutocompleteSelectedEvent) { const p = e.option.value as PersonDto; this.pickedFrom.set(p); this.form.controls.from.setValue(this.display(p)); }

  save() {
    const other = this.picked();
    const roleHolder = this.data.anchor ? other : this.pickedFrom();
    const counterpart = this.data.anchor ?? other;
    if (!other || !roleHolder || !counterpart || !roleHolder.id || !counterpart.id) {
      this.form.controls.person.setErrors({ required: true });
      this.form.controls.person.markAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const edge = toApiRelationship(v.type, roleHolder.id, counterpart.id);
    const withDate = v.type === 'Spouse' || v.type === 'Adoptive';
    const body: RelationshipRequest = {
      ...edge,
      startYear: withDate ? v.startDate?.year ?? null : null,
      startMonth: withDate ? v.startDate?.month ?? null : null,
      startDay: withDate ? v.startDate?.day ?? null : null,
      notes: withDate && v.place.trim() ? v.place.trim() : null
    };
    this.saving.set(true);
    this.error.set('');
    this.api.relationshipsCreate({ treeId: this.data.treeId, body }).subscribe({
      next: rel => this.ref.close(rel),
      error: e => {
        if (isValidationProblem(e.error)) this.error.set(setServerErrors(this.form, e.error).join(' '));
        else this.toast.errorFrom(e, this.i18n.t('tree.relErr'));
        this.saving.set(false);
      }
    });
  }
}
```
Note for the tree-view use (no anchor): `roleHolder` is the "from" pick and `counterpart` the "to" pick, matching the legacy sidebar semantics ("From" is the role holder).

- [ ] **Step 4: Run spec, suite, build; commit**

Spec 4/4. Suite baseline + 15 / + 4 files. Build clean.
```bash
git add frontend/src/app/features/persons/relationship-dialog.component.ts frontend/src/app/features/persons/relationship-dialog.component.spec.ts frontend/public/assets/i18n frontend/src/app/core/i18n/translation-keys.ts
git commit -m "feat(persons): shared relationship dialog with autocomplete pickers, owns its request"
```

---

### Task 5: Person detail page and family section

**Files:**
- Create: `frontend/src/app/features/persons/person-family.component.ts` + spec
- Modify: `frontend/src/app/features/persons/person-detail.component.ts` (rewrite) + create spec
- Delete: `frontend/src/app/features/persons/person-relations.component.ts` (replaced by `person-family`)
- Modify: i18n JSON (+ keys, emoji-free values), regenerate

**Interfaces:**
- `PersonFamilyComponent` (`qs-person-family`): reads `PersonStore` (person, relations, treePersons, tree); renders Parents / Spouses (with year) / Children / Adoptive chip rows; chip click navigates to that person; chip remove → `ConfirmDialogService` → `relationshipsDelete({ treeId, id })` → `store.reloadRelations()` + `store.reloadTimeline()` (marriage events are derived); "Add" opens `RelationshipDialogComponent` with `{ treeId, persons: treePersons, anchor: person }` → on result reload relations + timeline + toast.
- `PersonDetailComponent`: `id` route input (`input.required<string>()` via `withComponentInputBinding`), calls `store.load(id)`; breadcrumbs `Trees › <tree.name> › <full name>`; left `mat-card` identity (avatar or initials tinted by sex, Fraunces name, maiden name, lifespan, birth/death rows with place, cause of death, notes), Edit button, `qs-person-family`; right `mat-tab-group` with Timeline and Media tabs embedding the legacy `qs-timeline` / `qs-person-media` (P1c-B swaps them); handset: single column, tabs below.

- [ ] **Step 1: i18n**

Change values (`en` / `de`): `"pd.back": "Tree"` / `"Stammbaum"`, `"fam.add": "Add"` / `"Hinzufügen"`, `"fam.cancel": "Cancel"` / `"Abbrechen"`, and strip the leading light-bulb emoji from `fam.spouse.hint`, `fam.parent.hint`, `fam.child.hint`, `fam.adoptive.hint`, `tl.marriage.hint` in both languages.
Add (`en` / `de`):
```json
"pd.edit": "Edit person",
"pd.maiden": "née",
"pd.tab.media": "Photos & documents",
"pd.tab.timeline": "Timeline",
"fam.remove": "Remove relationship",
"fam.adoptiveParents": "Adoptive parents"
```
```json
"pd.edit": "Person bearbeiten",
"pd.maiden": "geb.",
"pd.tab.media": "Fotos & Dokumente",
"pd.tab.timeline": "Zeitleiste",
"fam.remove": "Beziehung entfernen",
"fam.adoptiveParents": "Adoptiveltern"
```

- [ ] **Step 2: Family spec (failing)**

`frontend/src/app/features/persons/person-family.component.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { PersonFamilyComponent } from './person-family.component';
import { PersonStore } from './person.store';
import { RelationshipsApi } from '../../core/api/generated';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import { ToastService } from '../../core/ui/toast.service';
import { I18nService } from '../../core/i18n/i18n.service';

const me = { id: 'me', treeId: 't1', firstName: 'Konrad', lastName: 'Smith', sex: 'Male' as const };
const rels = [
  { relationshipId: 'r1', type: 'Parent', direction: 'to', relatedPersonId: 'dad', relatedFirstName: 'Georg', relatedLastName: 'Smith' },
  { relationshipId: 'r2', type: 'Parent', direction: 'from', relatedPersonId: 'kid', relatedFirstName: 'Otto', relatedLastName: 'Smith' },
  { relationshipId: 'r3', type: 'Spouse', direction: 'from', relatedPersonId: 'wife', relatedFirstName: 'Maria', relatedLastName: 'Smith', startYear: 1872 }
];

function setup(confirmResult = true, dialogResult: unknown = undefined) {
  const store = { person: signal(me), relations: signal(rels), treePersons: signal([me]), tree: signal({ id: 't1', name: 'F' }), reloadRelations: vi.fn(), reloadTimeline: vi.fn() };
  const api = { relationshipsDelete: vi.fn(() => of(undefined)) };
  const confirm = { confirm: vi.fn(async () => confirmResult) };
  const toast = { success: vi.fn(), errorFrom: vi.fn(), error: vi.fn(), info: vi.fn() };
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(dialogResult) })) };
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideNoopAnimations(),
    { provide: PersonStore, useValue: store }, { provide: RelationshipsApi, useValue: api },
    { provide: ConfirmDialogService, useValue: confirm }, { provide: ToastService, useValue: toast }, { provide: MatDialog, useValue: dialog },
    { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k } }] });
  const fixture = TestBed.createComponent(PersonFamilyComponent);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance, store, api, confirm, toast, dialog };
}

describe('PersonFamilyComponent', () => {
  it('groups relations into parents, spouses (with year) and children', () => {
    const { cmp, fixture } = setup();
    expect(cmp.groups().map(g => [g.key, g.items.length])).toEqual([['fam.parents', 1], ['fam.spouses', 1], ['fam.children', 1], ['fam.adoptiveParents', 0]]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('1872');
  });

  it('removes a relationship after confirmation and reloads relations and timeline', async () => {
    const { cmp, api, store } = setup(true);
    await cmp.remove(rels[2]);
    expect(api.relationshipsDelete).toHaveBeenCalledWith({ treeId: 't1', id: 'r3' });
    expect(store.reloadRelations).toHaveBeenCalled();
    expect(store.reloadTimeline).toHaveBeenCalled();
  });

  it('opens the relationship dialog anchored on the person and reloads on a result', async () => {
    const { cmp, dialog, store, toast } = setup(true, { id: 'r9' });
    await cmp.openAdd();
    expect(dialog.open).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ data: expect.objectContaining({ treeId: 't1', anchor: me }) }));
    expect(store.reloadRelations).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('rel.added.toast');
  });
});
```

- [ ] **Step 3: Family component**

`frontend/src/app/features/persons/person-family.component.ts`:
```ts
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
                <mat-chip [routerLink]="['/persons', r.relatedPersonId]" class="qs-family__chip">
                  {{ r.relatedFirstName }} {{ r.relatedLastName }}
                  @if (r.type === 'Spouse' && r.startYear) { <span class="qs-muted">&nbsp;{{ r.startYear }}</span> }
                  <button matChipRemove [attr.aria-label]="('fam.remove' | translate) + ': ' + r.relatedFirstName + ' ' + r.relatedLastName"
                          (click)="remove(r); $event.stopPropagation()"><mat-icon>cancel</mat-icon></button>
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
    .qs-family__chip { cursor: pointer; }
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
      { key: 'fam.adoptiveParents', icon: 'volunteer_activism', items: rels.filter(r => r.type === 'Adoptive' && r.direction === 'to') }
    ];
  });
  readonly hasAny = computed(() => this.store.relations().length > 0);

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
```

- [ ] **Step 4: Detail spec (failing)**

`frontend/src/app/features/persons/person-detail.component.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { PersonDetailComponent } from './person-detail.component';
import { PersonStore } from './person.store';
import { BreadcrumbService } from '../../core/ui/breadcrumb.service';
import { I18nService } from '../../core/i18n/i18n.service';

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
```
Because the component's template embeds `qs-person-family`, `qs-timeline` (legacy) and `qs-person-media` (legacy), the spec must stub them: add `schemas: [NO_ERRORS_SCHEMA]` is not allowed for standalone imports — instead override the component's `imports` in the spec via `TestBed.overrideComponent(PersonDetailComponent, { remove: { imports: [PersonFamilyComponent, TimelineComponent, PersonMediaComponent] }, add: { imports: [StubFamily, StubTimeline, StubMedia] } })` where the stubs are tiny components with matching selectors and inputs (`personId`, `treeId`). Write those three stubs at the top of the spec.

- [ ] **Step 5: Detail component**

`frontend/src/app/features/persons/person-detail.component.ts`:
```ts
import { Component, OnInit, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { BreadcrumbService } from '../../core/ui/breadcrumb.service';
import { initials, lifespan, sexClass } from '../../core/models/person-helpers';
import { PartialDatePipe } from '../../shared/pipes/partial-date.pipe';
import { PersonStore } from './person.store';
import { PersonFamilyComponent } from './person-family.component';
import { TimelineComponent } from '../timeline/timeline.component';
import { PersonMediaComponent } from './person-media.component';

@Component({
  selector: 'qs-person-detail',
  imports: [RouterLink, MatCardModule, MatButtonModule, MatIconModule, MatTabsModule, MatProgressBarModule, TranslatePipe, PartialDatePipe,
            PersonFamilyComponent, TimelineComponent, PersonMediaComponent],
  template: `
    @if (store.error()) {
      <div class="qs-empty" role="alert"><mat-icon aria-hidden="true">error</mat-icon><p>{{ store.error() }}</p>
        <a matButton="outlined" routerLink="/trees">{{ 'trees.title' | translate }}</a></div>
    } @else if (store.person(); as p) {
      <header class="qs-page-header">
        <h1 tabindex="-1" class="qs-display">{{ store.fullName() }}</h1>
        <a matButton="filled" [routerLink]="['/persons', p.id, 'edit']"><mat-icon>edit</mat-icon>{{ 'pd.edit' | translate }}</a>
      </header>

      <div class="qs-person">
        <aside class="qs-person__aside">
          <mat-card appearance="outlined" class="qs-identity">
            <div class="qs-identity__hero">
              @if (store.avatarUrl(); as url) {
                <img class="qs-identity__photo" [src]="url" [alt]="store.fullName()">
              } @else {
                <div class="qs-identity__initials" [class]="'qs-identity__initials qs-sex-' + sexClass(p.sex)" aria-hidden="true">{{ initials({ firstName: p.firstName ?? '', lastName: p.lastName ?? '' }) }}</div>
              }
              <div>
                <div class="qs-identity__name qs-display">{{ store.fullName() }}</div>
                @if (p.maidenName) { <div class="qs-muted">{{ 'pd.maiden' | translate }} {{ p.maidenName }}</div> }
                @if (span(); as s) { <div class="qs-muted">{{ s }}</div> }
              </div>
            </div>
            <dl class="qs-dl">
              @if (p.birth?.year) { <dt>{{ 'pd.birth' | translate }}</dt><dd>{{ p.birth | partialDate }}@if (p.birthPlace) { <span class="qs-muted"> · {{ p.birthPlace }}</span> }</dd> }
              @if (p.death?.year) { <dt>{{ 'pd.death' | translate }}</dt><dd>{{ p.death | partialDate }}@if (p.deathPlace) { <span class="qs-muted"> · {{ p.deathPlace }}</span> }</dd> }
              @if (p.causeOfDeath) { <dt>{{ 'pd.causeOfDeath' | translate }}</dt><dd>{{ p.causeOfDeath }}</dd> }
              @if (p.notes) { <dt>{{ 'pd.notes' | translate }}</dt><dd class="qs-pre">{{ p.notes }}</dd> }
            </dl>
            <qs-person-family />
          </mat-card>
        </aside>

        <main class="qs-person__main">
          <mat-tab-group>
            <mat-tab [label]="'pd.tab.timeline' | translate">
              <div class="qs-tab-body"><qs-timeline [personId]="p.id ?? ''" [treeId]="p.treeId ?? ''" /></div>
            </mat-tab>
            <mat-tab [label]="'pd.tab.media' | translate">
              <div class="qs-tab-body"><qs-person-media [personId]="p.id ?? ''" (avatarChanged)="store.reloadMedia()" /></div>
            </mat-tab>
          </mat-tab-group>
        </main>
      </div>
    } @else {
      <mat-progress-bar mode="indeterminate" />
    }
  `,
  styles: [`
    :host { display: block; }
    .qs-person { display: grid; grid-template-columns: minmax(280px, 360px) 1fr; gap: 24px; align-items: start; }
    .qs-identity__hero { display: flex; gap: 16px; align-items: center; margin-bottom: 12px; }
    .qs-identity__photo, .qs-identity__initials { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; flex: 0 0 auto; }
    .qs-identity__initials { display: grid; place-items: center; font-weight: 600; font-size: 1.4rem; color: #fff; }
    .qs-sex-male { background: var(--qs-sex-male); } .qs-sex-female { background: var(--qs-sex-female); } .qs-sex-unknown { background: var(--qs-sex-unknown); }
    .qs-identity__name { font-size: 1.35rem; }
    .qs-dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 12px; margin: 0; }
    .qs-dl dt { color: var(--mat-sys-on-surface-variant); font-size: .8rem; text-transform: uppercase; letter-spacing: .04em; }
    .qs-dl dd { margin: 0; }
    .qs-pre { white-space: pre-wrap; }
    .qs-tab-body { padding: 16px 0; }
    @media (max-width: 1023.98px) { .qs-person { grid-template-columns: 1fr; } }
  `]
})
export class PersonDetailComponent implements OnInit {
  readonly id = input.required<string>();
  readonly store = inject(PersonStore);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly i18n = inject(I18nService);

  readonly initials = initials;
  readonly sexClass = sexClass;
  readonly span = computed(() => { const p = this.store.person(); return p ? lifespan({ firstName: '', lastName: '', birth: p.birth, death: p.death }) : ''; });

  constructor() {
    effect(() => {
      const p = this.store.person();
      const tree = this.store.tree();
      if (!p) return;
      this.crumbs.set([
        { label: this.i18n.t('trees.title'), link: ['/trees'] },
        { label: tree?.name ?? '…', link: ['/trees', p.treeId] },
        { label: this.store.fullName() }
      ]);
    });
  }

  ngOnInit() { this.store.load(this.id()); }
}
```
Delete `person-relations.component.ts` (its only consumer was the old detail page). The legacy `tree-view.component.ts` still imports `UI_REL_TYPES` from the model, not from the relations component, so nothing else breaks; verify with `grep -rn "person-relations" frontend/src`.

- [ ] **Step 6: Run specs, suite, build; visual check; commit**

Family 3/3, detail 2/2; suite baseline + 20 / + 6 files; build clean. Start API + dev server, log in as demo, open Konrad Smith from the tree view sidebar (double-click), screenshot at 1400 and 400 (light + dark) into the scratchpad `shots/p1c/`; verify: identity card, family chips, tabs, breadcrumb `My Trees › Familie … › Konrad Smith`, no console errors. Stop servers, remove `.playwright-mcp/` and PNGs from the repo.
```bash
git add frontend/src/app/features/persons frontend/public/assets/i18n frontend/src/app/core/i18n/translation-keys.ts
git commit -m "feat(persons): Material person detail with identity card, family chips and tabs on PersonStore"
```

## Verification before hand-off

- Backend 13/49/8; frontend suite green with the deltas above; lint clean for every file this plan touched; build under the error budget.
- Person detail verified visually in both themes and widths.
- No `ngModel`, `confirm(`, emoji, `autofocus` in files this plan created.

## Next plan (P1c-B)

Timeline (list + event dialog on `TimelineApi`, delete `timeline.service.ts`), media (grid, upload, avatar, lightbox on `MediaApi`, `MediaKind` union), person edit (typed form, dirty guard, avatar upload), import (two-step), then P1d tree view/graph, P1e cleanup.
