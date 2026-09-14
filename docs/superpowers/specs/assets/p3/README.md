# P3 verification

## P3a — backend hardening + trash view (2026-09-15)

- `/health/ready` → `{"status":"Healthy","checks":[database, uploads]}`; `/health/live` → 200 with no checks.
- Rate limit (window 60 s, limit lowered to 2 for the check): login attempts `401 401 429`; the 429 body is `application/problem+json` `{"title":"Too Many Requests","status":429,"detail":"Try again in 60 seconds."}` with `Retry-After: 60`.
- CORS: preflight from `http://evil.example` gets no `Access-Control-Allow-Origin`; from `http://localhost:4200` it does.
- Trash card (`p3a-trash-card.jpg`, `p3a-trash-card-handset-dark.jpg`): a trashed person is listed with tree, deleted and purge dates; Restore → "… wiederhergestellt." and the person is live again; Delete now → confirm dialog → "… endgültig entfernt.", trash API empty, person gone. Palette action "Papierkorb" navigates to `/settings#trash`. axe 0 violations (1400 light, 400 dark). Zero console errors.
- Backend 106 tests (real SQLite); frontend 53 files / 296 tests; bundle 793 kB.
