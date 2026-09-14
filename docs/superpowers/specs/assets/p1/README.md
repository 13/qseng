# P1 final verification — screenshots and accessibility audit

- Date: 2026-09-14 · commit 94576ca on `feat/material-rewrite` · demo data (42-person tree), language de
- Tools: Playwright (Chromium 1228 via the Playwright MCP), axe-core 4.13.0 (rulesets wcag2a, wcag2aa, wcag21aa), Lighthouse 12.8.2
- Files: `<screen>-<desktop|handset>-<light|dark>.jpg` (desktop 1400×900, handset 400×800, JPEG q70)

## Screens (10 × 2 widths × 2 themes = 40 captures)

login, register, trees, tree-view, person-detail, person-edit, person-new, import, settings, admin-users.

## axe-core result

All 40 captures: **0 violations** (after fix 94576ca — before it: white initials on sex-hued avatars < 4.5:1, unnamed user-menu button at handset width, aria attributes on the role-less context-menu trigger, register-page inline link distinguishable only by colour).

## Lighthouse (public pages; authenticated screens cannot be audited without a login flow, axe covers them)

| Page | Accessibility | Best practices |
|---|---|---|
| /login | 100 | 100 |
| /register | 100 | 100 |

## Notes

- Bundle: Initial total 781.6 kB raw / 181.6 kB estimated transfer (budget warning 800 kB, error 1100 kB); Cytoscape lazy.
- Console: zero errors on every screen; one informational cytoscape warning about the custom `wheelSensitivity` (accepted).
