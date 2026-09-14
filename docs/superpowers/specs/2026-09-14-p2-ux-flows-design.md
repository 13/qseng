# P2 UX flows — design

Date: 2026-09-14 · Status: approved · Branch: `feat/p2-ux-flows` (from `main` at 7b72ad6, P1 merged)

Goal: the four flows chosen from the roadmap's P2 candidates — undo for deletes (with a
backend trash), adding a relative without leaving the current screen, a first-run
onboarding stepper, and a command palette with a keyboard shortcut sheet.

Decisions taken during brainstorming:

| Topic | Decision |
|---|---|
| Branching | P1 merged into `main` with `--no-ff`; P2 on `feat/p2-ux-flows` |
| Undo model | Backend soft delete + restore endpoints + daily purge (30 days) |
| Onboarding | Linear 3-step Material stepper in a dialog; contextual empty states; no persistent checklist |
| Palette scope | Persons of the current (or last opened) tree + all trees + actions; no new search endpoint |
| Confirm dialogs | Kept only for Person delete (cascades) and Tree delete; relationship/event/media deletes are one click + Undo |

## 1. Scope and order

Four sub-features, implemented in this order because later ones reuse earlier ones:

| # | Feature | Backend | Frontend |
|---|---|---|---|
| A | Soft delete + undo toast | `DeletedAt` on Person, Relationship, TimelineEvent, Media; restore endpoints; purge service | `ToastService.undoable`, delete call sites, store reloads |
| B | Add relative inline | — | `RelationshipDialogComponent` "New person" mode, rollback via soft delete |
| C | Onboarding | — | `OnboardingDialogComponent` (stepper), empty states on trees / tree view / family section |
| D | Command palette + shortcut sheet | — | `ShortcutService`, `CommandPaletteComponent`, `ShortcutSheetComponent` |

Out of scope: Tree soft delete (stays hard delete with confirm), a Trash view (P3 candidate),
import wizard, graph minimap.

## 2. Backend: soft delete, restore, purge

### Entities

`Person`, `Relationship`, `TimelineEvent`, `Media` gain

```csharp
public DateTime? DeletedAt { get; set; }
public Guid? DeletionBatchId { get; set; }
```

`DeletionBatchId` groups rows stamped by one delete so a later restore only revives what that
delete removed (a relationship deleted separately last week stays deleted when the person is
restored today).

### Query filters

`QsengDbContext.OnModelCreating` applies `HasQueryFilter(e => e.DeletedAt == null)` to the four
entity types (one shared helper so the four registrations cannot drift). Every existing read —
lists, `GetById`, relations, timeline, media, export, import matching — ignores trash without
changes. Handlers that must see trash (restore, purge) call `IgnoreQueryFilters()`.

Indexes: `DeletedAt` on each of the four tables (purge query).

### Delete handlers (behaviour change)

| Handler | Before | After |
|---|---|---|
| `DeletePersonHandler` | remove row + files | stamp the person and, in the same `SaveChanges`, every non-deleted relationship where it is `From` or `To`, its timeline events and its media with the same `DeletedAt` and a new `DeletionBatchId`; files stay on disk |
| `DeleteRelationshipHandler`, `DeleteTimelineEventHandler`, `DeleteMediaHandler` | remove row (+ file for media) | stamp the row; media file stays |

Ownership and 404 semantics unchanged. `User_DeleteData` and `User_DeleteAccount` hard-delete
including trash: they delete the user's trees; the database FK cascade removes live and trashed
rows alike (media files are not removed — pre-existing gap, P3).

### Restore endpoints (new)

| Method | Route | operationId | Returns |
|---|---|---|---|
| POST | `/api/v1/persons/{id}/restore` | `Persons_Restore` | `PersonDto` |
| POST | `/api/v1/trees/{treeId}/relationships/{id}/restore` | `Relationships_Restore` | `RelationshipDto` |
| POST | `/api/v1/persons/{personId}/timeline/{id}/restore` | `Timeline_Restore` | `TimelineEventDto` |
| POST | `/api/v1/persons/{personId}/media/{mediaId}/restore` | `Media_Restore` | `MediaDto` |

Each: load with `IgnoreQueryFilters()`; 404 when missing or `DeletedAt == null`; 403 when the
owning tree is not the caller's; clear `DeletedAt`/`DeletionBatchId`; `Persons_Restore` also
clears every row carrying the same `DeletionBatchId`. Restoring a relationship or event whose
person is still deleted returns 409 (`Result.Conflict`, "Restore the person first."). All follow
the ProblemDetails contract and are annotated for Swashbuckle like the existing actions
(`ProducesResponseType` 200/403/404/409). Restoring a relationship also re-runs the duplicate
and cycle checks (409). Person restore revives only relationships whose other endpoint is live.

### Purge

`TrashPurgeService : BackgroundService` in `Qseng.Infrastructure` (registered in
`DependencyInjection` with `AddHostedService`): on start and then every 24 h, in a scope, loads
rows with `DeletedAt < now - Trash:RetentionDays` (default 30, bound from configuration via
`TrashOptions`), deletes media files through `IFileStorage`, then hard-deletes with
`IgnoreQueryFilters()` in dependency order (media, events, relationships, persons). Uses
`TimeProvider` (registered as `TimeProvider.System`) so tests can inject a fake clock. Logs one
summary line per run. The purge core is a public `TrashPurger.PurgeAsync(DateTime cutoff, ct)`
so the handler test does not need the hosted loop.

### Migrations

One migration per provider (`AddSoftDelete`), generated with the documented commands in
`QsengDbContextFactory`, committed under `Migrations/Sqlite` and `Migrations/Postgres`.
`DbSeeder` continues to migrate on boot.

### Contract

`backend/export-openapi.sh` re-run; `contracts/openapi.json` updated; `npm run gen` regenerates
the client (`personsRestore`, `relationshipsRestore`, `timelineRestore`, `mediaRestore`).

## 3. Frontend: undo toast

`ToastService.undoable(message: string, onUndo: () => Promise<void> | void, ms = 6000)`:
opens a `MatSnackBar` with the action label `'undo'` (new i18n key) and `politeness: 'polite'`;
`onAction()` runs `onUndo`, swallowing errors through `errorFrom(err, i18n.t('err.restore'))`.
A new `undoable` call dismisses the previous one (MatSnackBar does that natively). Escape does
not undo. The action button is focusable through the snackbar container.

Delete call sites:

| Site | Confirm? | After delete | Undo |
|---|---|---|---|
| Person (detail kebab, tree context menu) | yes (cascade) | navigate to the tree / `TreeStore.reload()`; toast "X deleted" + Undo | `personsRestore` → reload store, tree view re-selects the person |
| Relationship (family chip ×, selection panel) | no | `PersonStore.load(id)` / `TreeStore.reload()`; toast + Undo | `relationshipsRestore` → reload |
| Timeline event | no | list refetch; toast + Undo | `timelineRestore` → refetch |
| Media | no | list refetch (avatar state included); toast + Undo | `mediaRestore` → refetch |

Relationship deletes lose their confirm dialog; the existing `ConfirmDialogService` stays for
person, tree and account actions.

Release note: undoing the deletion of the avatar photo restores the file, not the avatar flag.

## 4. Add relative inline

`RelationshipDialogComponent` (existing, opened with `{ treeId, persons, anchor?, presetType? }`)
gets a `mat-button-toggle-group` "Existing person | New person" at the top, default "Existing"
(remembered per session in `sessionStorage['qs.relMode']`). The toggle is hidden when there is
no anchor (free mode keeps the two pickers).

"New person" fields (typed reactive form): first name (required), last name (required;
prefilled with the anchor's last name when `presetType` is `Child` or `Parent`, empty for
`Spouse`), sex (`mat-button-toggle-group` Male / Female, required — the API has no Unknown), birth (`PartialDateInputComponent`),
birth place. Type select and the Adoptive option stay as today.

Save (new mode): `if (form.invalid) { markAllAsTouched(); return; }` → `personsCreate` →
`relationshipsCreate(toApiRelationship(type, from, to))`. If the second call fails: the dialog
stays open, shows the error via `setServerErrors`/`qs-form-error`, and calls `personsDelete`
on the just-created person (soft delete, so nothing is lost if that also fails; a failure there
is logged, not toasted twice). On success the dialog closes with
`{ relationship: RelationshipDto, created?: PersonDto }`.

Callers (person family section, tree view context menu / selection panel / header, and the
onboarding stepper for parents) reload their store; the tree view selects `created.id` and
toasts "Anna Smith added as child" (`rel.added.<type>` keys with `__NAME__`) with an "Open"
action that navigates to the person.

## 5. Onboarding

### Trees page empty state

When `Trees_GetAll` returns `[]`: hero empty state (`qs-empty` + illustration icon `forest`),
title "Start your family tree", primary button "Start" (opens the stepper), secondary
"Import from text" (creates a tree named from the import step — reuses the existing tree-form
dialog then routes to import). The existing "New tree" header action remains.

### `OnboardingDialogComponent` (lazy, `features/onboarding/`)

`MatStepper` linear, `mat-dialog` 560 px / full-screen on handset (`LayoutService.handset`):

1. **Tree** — name (required), description. "Next" calls `treesCreate`; on success the step
   becomes `completed` and `editable = false` (no going back, the tree exists). Errors stay in
   the step (`setServerErrors`).
2. **You** — first, last, sex, birth (PartialDate). "Next" calls `personsCreate` (`treeId` from
   step 1); same completion rule.
3. **Your parents** — two optional mini-forms (mother, father: first, last, sex preset
   Female/Male but editable, birth). "Finish" creates each filled form's person then a
   `Parent` relationship to "you" (`toApiRelationship('Parent', parentId, youId)`); "Skip"
   finishes without parents. Partial failure: the dialog stays on step 3 with the error and the
   already-created rows remain (they are real data, not rolled back).

Finish closes with `{ treeId, personId }`; the trees page navigates to
`/trees/:treeId?select=<personId>`; `TreeViewComponent` gains a `select` route input that seeds
`store.select` once (same pattern as `q`). Toast "Your tree is ready".

### Other empty states

- Tree view with 0 persons: `qs-empty` with "Add yourself" (routes to `persons/new`) and "Import".
- Person family section: each empty group (Parents, Spouses, Children) shows an inline text
  button "Add parent / spouse / child" that opens the relationship dialog with `presetType` and
  the "New person" mode preselected.

## 6. Command palette and shortcut sheet

### `ShortcutService` (`core/ui/shortcut.service.ts`)

`document.addEventListener('keydown')` in the constructor (zoneless; handlers run outside
Angular and call `ApplicationRef.tick()` only through signals/`NgZone`-free APIs, i.e. they
open overlays or navigate). Ignores events whose target is an input, textarea,
contenteditable, or inside an open CDK overlay unless the shortcut is `Escape`/`Ctrl+K`.
API: `register(combo: 'mod+k' | '?' | ..., handler, { allowInInputs?: boolean }) → () => void`.
`mod` = Ctrl on Linux/Windows, Cmd on macOS (`navigator.platform`). The tree canvas keeps its
own key handling (it is focused).

### `CommandPaletteComponent` (lazy, `features/palette/`)

Opened by `mod+k` and a toolbar icon button (`search`, aria-label "Search and commands").
`MatDialog` panel, top-anchored (`position: { top: '10vh' }`), width 640 / 95 vw.
One `input` (`role="combobox"`, `aria-expanded`, `aria-controls` → `role="listbox"` results,
`aria-activedescendant` for the highlighted row). Result groups in this order:

| Group | Source | Match | Max |
|---|---|---|---|
| People in *tree name* | `TreeStore` when a `trees/:treeId` route is active, else `PersonsApi.personsGetByTree` for `sessionStorage['qs.lastTree']` (set by `TreeViewComponent`) | `personSearchText` (first, last, maiden, birth place, notes, death place) contains every query token | 8 |
| Trees | `TreesApi.treesGetAll()` cached for the palette's lifetime | name contains query | 5 |
| Actions | static list filtered by label; guarded (`Add person`/`Add relationship`/`Import` only with a current tree; `Users` only for admins) | label contains query | all |

Actions: Add person, Add relationship (opens the dialog in "New person" mode), Import,
New tree, My trees, Settings, Theme light / dark / system, Language DE / EN, Users (admin),
Sign out. Empty query shows Actions only. Arrow keys move, Enter runs, Escape closes; the list
has `aria-live="polite"` count text ("5 results"). No-results row when nothing matches.

### `ShortcutSheetComponent`

`?` (outside inputs) opens a `MatBottomSheet` listing: `mod+K` palette, `?` this sheet,
tree canvas `+ − 0`, arrows, Enter, Escape, `mod+S` save on person edit (new, wired in
`PersonEditComponent` via `ShortcutService` with `allowInInputs: true`), Escape closes
dialogs. Also reachable from the user menu ("Keyboard shortcuts").

## 7. i18n, a11y, budget

- New keys in both dictionaries (sorted, `gen:i18n`): `undo`, `err.restore`, `deleted.<entity>`,
  `rel.mode.existing|new`, `rel.added.parent|child|spouse|adoptive`, `onb.*`, `palette.*`,
  `shortcuts.*`, `nav.search`, `nav.shortcuts`, `tree.emptyAddSelf`, `fam.add.parent|spouse|child`.
- All new dialogs/sheets: `h2 mat-dialog-title`, focus trapped by Material, first field
  focused (`cdkFocusInitial`), Escape closes without side effects. Palette and sheet audited
  with axe at 1400/400 light/dark; screenshots to `docs/superpowers/specs/assets/p2/`.
- Bundle: palette, onboarding and shortcut sheet lazy (`loadComponent`/dynamic import);
  `ShortcutService` and `undoable` are the only eager additions. Budget stays 800 kB warning.

## 8. Testing

Backend (`Qseng.Application.Tests`, in-memory context via `TestDb.Create()`):
- Delete person stamps person + its relationships/events/media with one batch id; other rows untouched.
- Restore person revives exactly that batch; restore relationship of a deleted person → 409.
- Ownership: delete/restore by a non-owner → 403; unknown/already-live → 404.
- `TrashPurger.PurgeAsync(cutoff)` removes only rows older than the cutoff and calls `IFileStorage.DeleteAsync` for their media.
- `Qseng.Api.Tests`: `Persons_Restore` 404 / 200 shape.

Frontend (Vitest):
- `ToastService.undoable`: action triggers `onUndo`; error path calls `errorFrom`.
- Relationship dialog: new-person mode creates then links; link failure → dialog stays open, `personsDelete` called, error shown; existing-mode behaviour unchanged.
- Onboarding: tree → you → parents (both, one, none); step 1 not editable after creation; finish result shape; error keeps the step.
- Palette: grouping and limits; guards (no tree → no "Add person"; non-admin → no "Users"); keyboard (ArrowDown+Enter runs the highlighted item; Escape closes); `aria-activedescendant` updates.
- `ShortcutService`: ignores keydown in inputs unless `allowInInputs`; `mod` mapping; unregister removes the handler.
- Existing specs adjusted where confirm dialogs were removed.

Done criteria: backend and frontend suites green; `npm run gates`, `ng lint`, `ng build` (no
budget warning) green; OpenAPI export committed with the regenerated client; axe 0 violations on
the new surfaces; spec §1–§6 behaviours demonstrated in the browser at both widths.
