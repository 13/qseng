# P1: Frontend rewrite on Angular Material 21 — design

Date: 2026-09-14
Status: approved (brainstorm), awaiting implementation plan
Roadmap: `2026-09-14-improvement-roadmap.md`

## 1. Scope

Big-bang rewrite of `frontend/src/app` on Angular Material 21 (Material 3) with a
warm-heritage visual identity, responsive first-class, typed Reactive Forms, a
generated OpenAPI client and RFC 7807 error handling. Feature parity with the
current app is mandatory; no user-facing capability is dropped.

Backend changes are limited to: OpenAPI spec export, ProblemDetails error
contract, response-type annotations, test updates for the new error shape.

Out of scope (P2/P3): undo, command palette, import wizard beyond a preview
table, minimap, e2e suite, CI, rate limiting.

### Current state (for reference)

- Angular 21.2, standalone components, signals, custom `I18nService` (306 keys DE/EN).
- One 1862-line global `styles.scss`, emoji as icons, seven native `confirm()` calls,
  no toast, `[(ngModel)]` everywhere, hand-written `ApiClient` with 30 methods.
- Tree view: Cytoscape + dagre, nodes 130×62 with 11px labels (unreadable at fit
  zoom on the 42-person demo tree), sidebar with inline add-relationship form.
- Toolbar renders on login page when a token exists.
- Backend: ASP.NET Core 10, MediatR CQRS, FluentValidation, Swashbuckle 8 already
  configured, errors returned as `{ error: string }`.

## 2. Design system

### Color

Material 3 theme via `mat.theme()`; palettes generated with
`ng generate @angular/material:theme-color` from seeds:

| Role | Seed | Used for |
|---|---|---|
| Primary | `#2F5D50` forest green | buttons, links, active states, graph selection |
| Tertiary | `#A6713C` ochre | timeline accents, badges, marriage edges |
| Neutral | `#8A8177` warm stone | surfaces: `#FAF7F2` light, `#1C1A17` dark |
| Error | M3 default | |

Person sex hues (avatars, graph node stripe): male `#5B7A99`, female `#B5636F`,
unknown neutral stone. Color is never the sole carrier: initials and symbol
always present.

### Typography

Self-hosted, no external font CDN:

- `@fontsource-variable/fraunces` — display/headline: person names, tree titles, page headings.
- `@fontsource-variable/inter` — title/body/label.
- Base body 15px. M3 type scale mapped accordingly.

### Shape, density, elevation

- Cards 12px radius, inputs 8px, chips full round.
- Density 0 default; -2 in people list and tables.
- Cards flat with hairline warm border. Elevation only on overlays, menus, bottom sheets.

### Icons

`mat-icon` with self-hosted Material Symbols Rounded (`material-symbols` npm
package). Emoji removed everywhere, including flags in the language switcher
(use "DE" / "EN").

### Dark mode

`mat.theme(theme-type: color-scheme)`. `ThemeService` sets `color-scheme` on
`<html>`: `light | dark | auto` (auto = system). Persisted in `localStorage`.
Cytoscape stylesheet reads CSS custom properties at build time and is rebuilt on
theme change.

### Motion

M3 defaults; `prefers-reduced-motion` honored. No route transition animations.
Skeleton placeholders for loading states, spinners only inside buttons.

### Files

```
frontend/src/styles/
  _theme.scss       mat.theme() + palettes
  _tokens.scss      custom properties (sex hues, graph colors, spacing)
  _typography.scss  font imports, M3 type overrides
  _base.scss        reset, body, focus ring, skip link
  _cytoscape.scss   canvas container only
frontend/src/styles.scss   entry, @use of the above
```

All other styling is component-scoped. The legacy `styles.scss` is deleted.

## 3. App shell, navigation, responsive

### Shell

- `mat-toolbar` 64px desktop / 56px handset: wordmark "Qseng" (Fraunces) with
  small tree glyph, breadcrumb (`Trees › <tree> › <person>`, truncates on narrow),
  spacer, theme toggle, user `mat-menu` (Settings, Users when admin, language
  DE/EN radio, Logout).
- `mat-progress-bar` under the toolbar while router navigates or HTTP requests are
  pending (counter in an interceptor).
- Auth pages (login, register) render without the toolbar. Layout decided by route
  data `{ layout: 'auth' | 'app' }`, not by token presence.
- Skip-to-content link; `h1` receives focus after navigation.

### Breakpoints

CDK `BreakpointObserver` wrapped in `LayoutService` exposing signals:
`handset` (< 600), `tablet` (600–1023), `desktop` (≥ 1024).

### Page container

`max-width: 1200px`, centered, 24px gutter (16px handset). Tree view is full-bleed.

### Tree view layout

| Breakpoint | People list | Detail panel | Add relationship |
|---|---|---|---|
| Desktop | left `mat-sidenav`, side mode, 300px, collapsible | right panel 320px on selection, closable | dialog |
| Tablet | sidenav over mode | overlay panel | dialog |
| Handset | `MatBottomSheet` from FAB | bottom sheet on node tap, "Open profile" action | dialog |

### Cross-cutting UI services (`core/ui/`)

- `ToastService` wrapping `MatSnackBar`: `success | error | info (message, { action?, onAction? })`.
- `ConfirmDialogService.confirm({ title, message, confirmLabel, destructive, requirePassword? })`
  returning `Promise<boolean | string>` (string = entered password when required).
  Replaces every native `confirm()`.
- `ErrorInterceptor` (functional): see §6.

## 4. Screens

Feature parity checklist. Each item must be ticked before P1 is done.

### Login / Register
- [x] Centered `mat-card`, outlined fields, password visibility toggle, inline validation.
- [ ] Demo credentials as subtle chip row.
- [x] Register keeps pending-activation result state.
- [x] Language toggle visible on auth pages.

### Trees
- [x] "New tree" opens a dialog (name, description).
- [ ] Card: Fraunces title, description, people-count chip, created date; body click opens.
- [x] Kebab menu: Rename (dialog), Delete (confirm).
- [ ] Empty state with "Create first tree" and "Import from text".

### Tree view
- [x] Layout per §3; canvas per §5.
- [x] People list: `cdk-virtual-scroll`, filter with clear, sort by name / birth year,
      rows with avatar or initials, name, lifespan; click selects, double-click opens.
- [x] Canvas controls as mini-FAB cluster: fit, zoom in/out, layout toggle, reset
      custom layout (only when custom positions exist), export PNG.
- [x] Add relationship dialog: type select, two `mat-autocomplete` person pickers,
      start date/place where applicable, adoptive hint; pre-fillable with a person.
- [x] Selection panel: avatar, name, maiden name, lifespan, birth/death place,
      Parents / Spouses / Children chips (click selects that node), Open profile, Edit.
- [x] Search route `/trees/:id/search` redirects into tree view with `?q=`; the
      filter also matches places and notes.

### Person detail
- [x] Two columns desktop, stacked handset.
- [x] Left card: large avatar, maiden name, lifespan, birth/death + place,
      cause of death, notes (the page `h1` carries the name; not repeated in the card).
- [x] Family: Parents / Spouses (with year) / Children chips, remove via X + confirm,
      Add relation opens the shared dialog.
- [x] Right `mat-tab-group`: Timeline | Photos & documents.
- [x] Timeline: grouped by decade, type chip, place, description, auto badge for
      derived events, edit/delete icon buttons, Add event dialog (type, title, date,
      place, description, spouse picker for marriage).
- [x] Media: thumbnail grid, drop zone + button upload (images, pdf, audio),
      set-avatar / delete via hover menu, lightbox on click, avatar badge.

### Person edit
- [x] Sectioned cards: Avatar, Basics (first, last, maiden, sex button-toggle),
      Life (birth/death partial dates + places, cause of death), Notes.
- [x] Typed Reactive Form, required validation, server errors mapped to fields.
- [x] Dirty guard (`canDeactivate`) with confirm.
- [x] Sticky bottom Save/Cancel on handset; Delete in header kebab (existing persons).
- [x] Avatar upload on new person deferred until created (existing behaviour).

### Partial date input
- [x] Rewritten as `ControlValueAccessor`: day, month, year, approximate toggle.

### Import
- [x] Step 1 paste textarea with collapsible format guide.
- [x] Step 2 preview: counts of persons and relationships plus the warning list
      (the import API returns aggregate counts only; a row preview needs a backend change, deferred to P2).
- [x] Commit → summary (persons, relationships created) + "Open tree".

### Settings
- [x] Cards: Profile (display name, email read-only), Language, Appearance
      (light/dark/auto), Password, Data (export JSON, delete all data), Danger zone
      (delete account). Destructive actions via confirm dialog requiring password.

### Admin users
- [x] `mat-table` with sort; status and role chips; row kebab: activate/deactivate,
      grant/revoke admin, set password (dialog), delete (confirm); "me" row protected.
- [x] Registration enabled `mat-slide-toggle` in header.
- [x] Create user dialog.
- [x] Handset: card list instead of table.

## 5. Graph

### Kept

Cytoscape + dagre, `tree-graph.model.ts` (pure, tested), couple nodes, saved
custom positions, lineage emphasis on select, keyboard navigation, PNG export,
auto/tree layout toggle.

### Node design

- Size 180×72. Rendered as an SVG data-URI `background-image` generated per person
  by a pure `renderNodeSvg(person, theme)` function (unit tested): warm surface,
  hairline sex-hued left stripe, 36px avatar circle (photo or initials), name in
  Fraunces 14px, lifespan in Inter 11px muted.
- Regenerated when the person, avatar or theme changes.
- Below zoom 0.45 a compact variant (avatar + surname) is used.
- Selected: primary 2px border + soft glow. Lineage: full opacity, others 0.15.

### Edges

Marriage: tertiary ochre 1.5px, couple node 8px ochre dot. Descent: neutral
outline 1.5px, rounded taxi routing. Adoptive: dashed. Colors read from CSS
custom properties; stylesheet rebuilt on theme change.

### Zoom and input

Fit with 40px padding on load; `minZoom` 0.2, `maxZoom` 2.5; wheel and pinch
zoom; touch pan.

### Interactions

| Input | Result |
|---|---|
| Tap | select → detail panel / bottom sheet |
| Double-tap | open profile |
| Right-click / long-press | context `mat-menu`: Open, Edit, Add parent, Add child, Add spouse (dialog pre-filled), Focus lineage, Remove |
| Drag | saves custom layout, shows Reset |
| Arrows | move selection between neighbours |
| Enter / Esc | open / clear selection |
| `+` `-` `0` | zoom in / out / fit |

### Overlays

Loading: skeleton of faint node placeholders. Empty: illustration + "Add first
person" + "Import". Error: message + Retry.

## 6. Data layer

### Backend

- Export `contracts/openapi.json` via `dotnet swagger tofile` (build script), committed.
- `AddProblemDetails()`; `ResultExtensions` maps `Result` failures to `ProblemDetails`
  (`status`, `title`, `detail`); FluentValidation failures become
  `ValidationProblemDetails` with `errors: { field: string[] }`.
- Controllers annotated with `ProducesResponseType` for all outcomes.
- Existing tests updated for the new error shape; one test per controller for
  validation → 400 ProblemDetails.

### Generated client

- `ng-openapi-gen` (pure Node, no JVM), output `frontend/src/app/core/api/generated/`
  (gitignored), run by `npm run gen:api` and as `prebuild`/`pretest` hook.
- Hand-written `ApiClient` deleted. Features inject generated services
  (`TreesService`, `PersonsService`, `RelationshipsService`, `TimelineService`,
  `MediaService`, `AuthService`, `UsersService`, `AdminService`, `ImportService`).
- Domain types come from generated models. `core/models/` holds view helpers
  only (`fullName`, `lifespan`, `initials`), unit tested.

### State

Signals only, no NgRx. `resource()` / `toSignal` for reads. Route-scoped stores:

- `TreeStore` (tree-view route): persons, relationships, selected id, filter,
  sort; mutations update locally.
- `PersonStore` (person-detail route): person, relations, timeline, media,
  avatar url; shared by tabs and dialogs.

### Forms

- `FormBuilder.nonNullable` typed forms everywhere; no `ngModel`.
- `FormErrorsPipe` maps validation errors to i18n keys.
- `setServerErrors(form, problem)` applies `ValidationProblemDetails` to controls.
- Submit disabled while pending; progress bar in dialogs.

### i18n

Custom `I18nService` and `translate` pipe retained (runtime switching required).
Dictionaries move to `assets/i18n/de.json` and `en.json`, loaded at bootstrap;
a `TranslationKey` union type is generated from the JSON so keys are checked at
compile time.

### Error handling (`ErrorInterceptor`)

| Status | Action |
|---|---|
| 401 | attempt refresh once; on failure logout and redirect to login with `returnUrl` |
| 403 | toast "no access" |
| 404 (route resource) | not-found view |
| 400 / 422 validation | rethrown for form mapping |
| 5xx / network | toast with Retry action |

## 7. Testing and done criteria

### Unit (Vitest)

Keep `tree-graph.model.spec.ts`, `auth.service.spec.ts`. Add specs for
`ToastService`, `ConfirmDialogService`, `ErrorInterceptor`, `setServerErrors`,
model helpers, `renderNodeSvg`, `PartialDateInput` CVA, `TreeStore`, and a
component smoke test per screen (renders with mocked services, submits, shows
validation). Target roughly 60% lines on `core/` and `shared/`.

### Backend

`dotnet test backend/Qseng.slnx` green with updated error-shape assertions.

### Visual verification

Before claiming done: every screen at 1400px and 400px, light and dark, via
Playwright, screenshots saved to `docs/superpowers/specs/assets/p1/`.

### Done criteria

- `ng build --configuration production` clean; initial bundle ≤ 600 kB gzipped
  (Cytoscape stays a lazy chunk).
- `npm test --prefix frontend` and `dotnet test backend/Qseng.slnx` green.
- `angular-eslint` added; `ng lint` clean.
- Grep gates: no emoji in `src/app`, no `confirm(`/`alert(`, no `ngModel`,
  no legacy global class names.
- All checklist items in §4 ticked.
- Lighthouse accessibility ≥ 95 on trees, tree view, person detail.
- Demo tree readable at fit zoom on 1400px and 400px widths.

### P1e results (2026-09-14, branch `feat/material-rewrite`)

- Bundle: raw initial 781.6 kB / 181.6 kB estimated transfer (gzip). The "≤ 600 kB gzipped"
  target above refers to transfer size and is met with margin; `angular.json` budgets are raw
  sizes and are set to 800 kB (warning) / 1100 kB (error) to catch regressions. `MatDialog`
  left the initial bundle (the unsaved-changes guard loads the confirm dialog lazily);
  Cytoscape remains a lazy chunk. Remaining eager weight is Angular + Material core, the shell
  and the route-level `PersonStore`/`TreeStore` providers (~10 kB).
- Gates: `npm run gates --prefix frontend` (`frontend/scripts/check-gates.mjs`) enforces the
  grep gates (emoji, `ngModel`, `window.confirm/alert/prompt`, legacy `ApiClient`, `autofocus`,
  legacy stylesheet) and the i18n invariants (sorted, identical key sets, no empty or emoji
  values, no unused keys). Bare `confirm(`/`alert(` calls are caught by eslint `no-alert`.
  Dynamic i18n prefixes the unused-key check whitelists: `sex.`, `event.`, `rel.`, `admin.confirm.`.
- Accessibility: Lighthouse accessibility 100 on `/login` and `/register`; authenticated
  screens cannot be audited by Lighthouse without a login flow, so every screen was audited
  with axe-core (WCAG 2.1 AA rulesets) at 1400 px and 400 px, light and dark: 0 violations.
  Evidence and screenshots: `assets/p1/README.md`.
- Legacy removed: `core/api/api-client.service.ts`, `styles/_legacy.scss`, `ngModel` in the
  confirm dialog, 75 orphaned dictionary keys (400 → 325).
- CI gate: four commands — `npm run gates`, `ng lint`, `ng test`, `ng build` — the last piped
  through an explicit `grep -E "Initial total|WARNING|ERROR"`, since a budget warning alone
  (raw size over 800 kB) does not fail the build; only a grep-matched `WARNING` or `ERROR` line
  does. Bare `confirm(`/`alert(` calls are enforced separately by eslint's `no-alert` rule, not
  by `check-gates.mjs`.
- Two intentional visual deltas from the avatar-class unification: the selection panel's
  initials avatar is now 1.1rem, sharing `.qs-avatar--56` with the other 56px avatar users;
  the people-list empty state is now centred with 16px padding, sharing `.qs-empty--compact`
  instead of a one-off local rule.

### §4 items not delivered in P1

Verified by reading `features/auth`, `features/trees`, `features/persons`, `features/timeline`,
`features/import`, `features/settings`, `features/admin`; left unticked in §4:

- Login: demo credentials render as an outlined `useDemo()` button ("Use demo account"), not a
  chip row — no `mat-chip` is used for it.
- Trees: the card body has no click handler; only the Fraunces title link and the explicit
  "Open" button (`mat-card-actions`) navigate to the tree.
- Trees: the empty state offers only "Create first tree" — there is no "Import from text"
  action there (import is reachable only from inside an existing tree, at `/trees/:id/import`).

### Accepted deviations carried from P1d

- Graph compact mode (zoom < 0.45) keeps the full-card couple spacing: node positions are
  shared by both variants, so the clamp is sized for the 180 px card.
- Cytoscape `wheelSensitivity: 0.25` is kept (the default is too fast on trackpads); the
  console warning it triggers is informational.
- The search route `/trees/:id/search` redirects into the tree view with `?q=`; the filter
  re-seeds only when the tree changes (the retired search page has no remaining entry point).
- The 42-person demo tree at fit zoom is below the 0.45 compact threshold at both widths
  (surname-only cards, not legible at 1400/400); cards become legible one zoom step in via the
  controls or pinch. Readability at fit is achievable only for trees of roughly ≤ 20 people.
