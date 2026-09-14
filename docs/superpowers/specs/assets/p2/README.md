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
