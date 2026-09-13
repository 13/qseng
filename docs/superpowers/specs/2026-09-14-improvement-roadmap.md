# Qseng improvement roadmap

Date: 2026-09-14
Status: approved

Goal: make Qseng more modern, intuitive, beautiful, user-friendly and aligned with
best practice. Work is decomposed into four sub-projects. Each gets its own spec,
plan and implementation cycle. Only P1 is fully designed so far
(see `2026-09-14-p1-material-rewrite-design.md`).

## Decisions taken during brainstorming

| Topic | Decision |
|---|---|
| Overall focus | Both visual/UX and engineering, phased |
| Uncommitted work in tree | Commit as-is first (P0), after build + tests pass |
| UI foundation | Angular Material 21 (Material 3) |
| Visual direction | Warm heritage: warm neutrals, forest-green primary, ochre tertiary, Fraunces display serif, Inter body |
| Mobile | Responsive first-class, every screen works at phone width |
| Migration strategy | Big-bang rewrite of `frontend/src/app` on one branch |
| Engineering scope (P3) | CI (GitHub Actions), Playwright e2e, Vitest coverage, OpenAPI client + typed forms |

## Sub-projects

### P0 Baseline commit

Build backend and frontend, run `dotnet test backend/Qseng.slnx` and `npm test --prefix frontend`,
fix only what blocks green, commit the current working tree (refresh tokens, avatar,
split SQLite/Postgres migrations, new tests) on `main`. Fixes if any are separate commits.

### P1 Frontend rewrite on Angular Material 21

Branch `feat/material-rewrite`. New design system, app shell, all screens rebuilt,
responsive first-class, typed Reactive Forms, generated OpenAPI client, ProblemDetails
error contract, toast + confirm dialog services. Legacy `styles.scss` deleted.
Full design: `2026-09-14-p1-material-rewrite-design.md`.

### P2 UX flows

Depends on P1 primitives. Candidates, to be brainstormed separately:

- Onboarding: first-run empty states with guided "add yourself, add parents" flow.
- Add parent / child / spouse directly from a graph node with a pre-filled dialog
  that can create the new person inline.
- Command palette (Ctrl+K): jump to person, tree, action.
- Import wizard: paste → parsed preview with per-row accept/edit → commit; show
  which existing persons would be matched.
- Undo via toast for deletes (person, relationship, event, media).
- Keyboard shortcut sheet (`?`).
- Graph minimap and "focus on generation" filters.

### P3 Engineering hardening

Depends on final DOM from P1 and P2 for e2e selectors.

- GitHub Actions: backend build + test, frontend lint + test + production build,
  OpenAPI drift check (regenerate client, fail on diff).
- Playwright e2e against seeded SQLite: login, create tree, add person, add
  relationship, timeline event, media upload, import, settings, admin.
- Vitest coverage gates on `core/` and `shared/`.
- Backend: rate limiting on auth endpoints, health checks, structured logging review.

## Ordering

P0 → P1 → P2 → P3. P2 and P3 may be re-split when brainstormed.
