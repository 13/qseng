# P2 verification — screenshots and audit

## P2a — soft delete, undo, inline add-relative (2026-09-14, closed at e6e208c)

Verified in Chromium against the demo tree (de), API on SQLite:

- `p2a-undo-person-toast.jpg` / `p2a-undo-person-restored.jpg` — context-menu delete → "Rosa Escobar gelöscht. Rückgängig" → Undo → person, edges and events back (API lists 42 persons; trash empty).
- `p2a-undo-relationship-toast.jpg`, `p2a-undo-event.jpg` — chip remove / event delete without confirm, Undo restores.
- `p2a-add-child-done.jpg` (desktop, selection panel) and `p2a-v2-add-child-handset.jpg` (bottom sheet) — "New person" mode creates, links and selects the new person; toast names the chosen relation with an "Open" action.
- `p2a-dialog-new-desktop.jpg`, `p2a-dialog-new-handset.jpg` — final layout after the dialog-width fix (no horizontal overflow, required-field errors).
- Trash: deleting the test person stamps the person, its relationship and event with one batch id (checked in `qseng.db`).
- axe-core (wcag2a/2aa/21aa): 0 violations on the dialog in both modes × light/dark × 1400/400. Zero console errors.

Backend suite runs on real SQLite (`TestDb`), which enforces the filtered unique indexes; 89 tests. Frontend 46 files / 227 tests; bundle 784 kB (budget 800 kB).

## P2b — onboarding, command palette, shortcut sheet (2026-09-14, closed at 08dd2cd)

- `p2b-onb-hero.jpg` — trees page for a fresh user (hero empty state, "Start your family tree" / "Import from text instead").
- `p2b-onb-step1..3.jpg`, `p2b-onb-done.jpg` — stepper on desktop: tree → you → mother; lands on the tree view with "you" selected and the "Your tree is ready." toast. `p2b-onb-step2-handset.jpg`, `p2b-onb-done-handset.jpg` — vertical stepper and the skip path at 400 px.
- `p2b-palette-actions.jpg` (trees page: actions only), `p2b-palette-people.jpg` (in a tree, "smi": people + trees, live count), `p2b-palette-handset.jpg`.
- `p2b-shortcut-sheet.jpg` — `?` sheet with the platform modifier label.
- Verified: Enter in the palette opens the highlighted person; Escape closes palette and sheet; Ctrl+S saves the person form ("Person gespeichert.").
- axe-core (wcag2a/2aa/21aa): 0 violations on hero, every stepper step (desktop + handset), palette (desktop + handset) and sheet after fix 08dd2cd (list semantics, handset palette width, empty-state icon size). Zero console errors.
- Frontend 51 files / 268 tests; bundle 791 kB (budget 800 kB); palette, onboarding and sheet are lazy chunks.
