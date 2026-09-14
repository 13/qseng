# P3b End-to-End Tests, Coverage Gates and CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Playwright suite (Chromium + axe) that drives the real app against an isolated, seeded SQLite API; Vitest coverage with pinned thresholds for `core/` and `shared/`; a GitHub Actions workflow running every gate; a README section describing the checks.

**Architecture:** `frontend/e2e/` holds `playwright.config.ts`, a `global-setup.ts` that starts the API on a temp database (locally via `dotnet run`, in CI via the published binary) and waits for `/health/ready`, fixtures (`demo`, `freshUser`, `axeCheck`, `api`) and one spec file per feature. Coverage is configured on the `@angular/build:unit-test` target. CI: five jobs (backend, frontend, contract, e2e, docker) with artifacts shared between backend/frontend and e2e.

**Tech Stack:** `@playwright/test` 1.x (Chromium), `axe-core` (already a devDependency), Vitest 4 v8 coverage, GitHub Actions (`actions/checkout@v4`, `setup-dotnet@v4`, `setup-node@v4`, `upload-artifact@v4`, `download-artifact@v4`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-14-p3-hardening-design.md` §4, §5, §6, §7. Branch `feat/p3-hardening`; P3a merged into it first (e2e covers the trash card; the API exposes `/health/ready` and the `RateLimiting__Auth__PermitLimit` override).
- e2e selectors: roles/labels/text first; `data-testid` only where the DOM has no semantic hook (graph canvas host, palette rows) — add them in the components as part of Task 2, no other component changes.
- Every spec is independent: it creates the data it mutates (fresh tree via the API or the UI) and never assumes the outcome of another spec; the seeded demo tree is read-only for the suite (undo/delete specs use their own persons).
- axe (`wcag2a`, `wcag2aa`, `wcag21aa`) runs once per distinct page in a spec and fails the test on `serious`/`critical`; the JSON is attached to the report.
- CI must run the exact commands developers run: `npm run gates`, `npx ng lint`, `npx ng test --watch=false --coverage`, `npx ng build` (+ warning grep), `dotnet test`, `npm run e2e`. Budget 800 kB; Node 22; .NET 10.
- Tooling (local): `cd` is broken in the sandbox shell — `npm --prefix`, absolute paths; `ng test --watch=false` inside `timeout 300`; stale workers `ps -eo pid,args | grep "suppress-warn[i]ng" | awk '{print $1}' | xargs -r kill -9`; never `pkill -f` (the e2e global teardown kills the API by PID). Playwright browsers: `npx playwright install chromium` once (the MCP's Chromium is separate).
- Commit messages end with the attribution lines from the session's system reminder.

## File structure produced by this plan

```
frontend/e2e/playwright.config.ts, global-setup.ts, global-teardown.ts, fixtures.ts, helpers/api.ts, helpers/axe.ts
frontend/e2e/specs/{auth,trees,onboarding,person,relationships,timeline,media,import,settings,admin,palette,shortcuts}.spec.ts
frontend/e2e/assets/avatar.png, sample-import.txt
frontend/package.json                       scripts e2e, e2e:ui, e2e:install; devDependency @playwright/test
frontend/angular.json                        coverage options + thresholds
frontend/src/app/... (data-testid only)      tree canvas host, palette rows
.github/workflows/ci.yml
docker/Dockerfile.web                        node:22-alpine
README.md                                    "Running the checks"
docs/superpowers/specs/2026-09-14-p3-hardening-design.md   §7 results block (measured coverage, bundle, CI run link)
```

---

### Task 1: Playwright scaffold, isolated API, fixtures, first spec (auth)

**Files:**
- Create: `frontend/e2e/playwright.config.ts`, `global-setup.ts`, `global-teardown.ts`, `fixtures.ts`, `helpers/api.ts`, `helpers/axe.ts`, `specs/auth.spec.ts`
- Modify: `frontend/package.json` (scripts + devDependency), `frontend/.gitignore` (`playwright-report/`, `test-results/`, `e2e/.state/`), `frontend/tsconfig.json` (exclude `e2e/` from the app build if `include` picks it up), `frontend/eslint.config.js` (ignore `e2e/**` or lint it with the ts config — choose lint it)

- [ ] **Step 1: Install**
```bash
npm install --prefix /home/ben/repo/qseng/frontend --save-dev @playwright/test@1
npx --prefix /home/ben/repo/qseng/frontend playwright install chromium
```
Scripts: `"e2e": "playwright test -c e2e/playwright.config.ts"`, `"e2e:ui": "playwright test -c e2e/playwright.config.ts --ui"`, `"e2e:install": "playwright install --with-deps chromium"`.

- [ ] **Step 2: Config + global setup**
`playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './specs',
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../playwright-report' }]],
  use: { baseURL: 'http://localhost:4200', trace: 'on-first-retry', screenshot: 'only-on-failure', locale: 'de-DE' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'npm start', url: 'http://localhost:4200', reuseExistingServer: !process.env['CI'], timeout: 180_000 }
});
```
`global-setup.ts`: creates a temp dir (`fs.mkdtempSync`), spawns the API — `process.env['E2E_API_CMD']` if set (CI: `dotnet <path>/Qseng.Api.dll`) else `dotnet run --project ../backend/src/Qseng.Api --no-launch-profile` — with env `ASPNETCORE_ENVIRONMENT=Development`, `ASPNETCORE_URLS=http://127.0.0.1:5000`, `DB_PROVIDER=sqlite`, `CONNECTION_STRING=Data Source=<tmp>/e2e.db`, `Uploads__Path=<tmp>/uploads`, `RateLimiting__Auth__PermitLimit=1000`, `Cors__AllowedOrigins__0=http://localhost:4200`; polls `http://127.0.0.1:5000/health/ready` up to 120 s; writes `{ pid, tmp }` to `e2e/.state/api.json`. `global-teardown.ts` reads it, `process.kill(pid)`, removes the temp dir. (Port 5000 is what `proxy.conf.json` targets; if something already listens there locally, setup fails with a clear message rather than reusing it.)

- [ ] **Step 3: Helpers + fixtures**
`helpers/api.ts`: `login(request, username, password) → token`, `registerAndActivate(request, adminToken, username, password)` (POST register, GET admin/users to find the id, PATCH `active: true`), `createTree(request, token, name) → id`, `createPerson(request, token, treeId, body) → id`, `deleteTree(request, token, id)`.
`helpers/axe.ts`: `axeCheck(page, name)` injects `node_modules/axe-core/axe.min.js` via `page.addScriptTag({ path })`, runs the three tags, attaches the JSON, `expect(serious+critical).toEqual([])`.
`fixtures.ts` (`test.extend`): `demo` (page logged in through the UI: fill username/password, submit, wait for `/trees`) — cache the storage state per worker in `e2e/.state/demo.json`; `freshUser` (returns `{ username, password, page }` registered + activated via the API then logged in); `api` (`request` with the demo token header); `treeId` of the seeded demo tree (from `GET /api/v1/trees`).

- [ ] **Step 4: `auth.spec.ts`**
- login page renders and passes axe; wrong password shows the error and stays; demo login lands on `/trees`;
- register → "pending activation" message → admin activates via API → login works;
- logout from the user menu returns to `/login` and `/trees` redirects to login.
Run `npm run e2e --prefix /home/ben/repo/qseng/frontend` → green. Commit: `test(e2e): Playwright scaffold with isolated API, fixtures, axe helper, auth specs`.

---

### Task 2: Feature specs (trees, onboarding, person, relationships, timeline, media, import)

**Files:**
- Create: the seven spec files, `e2e/assets/avatar.png` (a 64×64 PNG generated in setup or committed), `e2e/assets/sample-import.txt` (use the format guide from `import-text.component.ts`)
- Modify: `data-testid="tree-canvas"` on the tree-view canvas host, `data-testid="palette-row"` on palette rows (if roles are not enough)

Per spec (each in its own tree created through the API in `beforeEach`, deleted in `afterEach`):
- `trees.spec.ts`: create via header button (dialog), rename via kebab, delete with confirm; card count and toasts; axe on the trees page.
- `onboarding.spec.ts`: with `freshUser`: hero → stepper (tree, you, one parent) → tree view shows two people and "you" selected; skip path; close on step 2 leaves the created tree listed.
- `person.spec.ts`: add person via header → form → save; edit + Ctrl+S; delete from the context menu (right-click on `[data-testid=tree-canvas]` center after selecting) → undo toast → Undo → person back; let a second delete expire → gone from the list; axe on tree view + person page + edit page.
- `relationships.spec.ts`: existing-person mode from the family section; inline "New person" from the selection panel → toast names the relation; chip remove → Undo.
- `timeline.spec.ts`: add event (dialog), edit, delete → Undo.
- `media.spec.ts`: upload `avatar.png` via the file input (`setInputFiles`), set as avatar (initials replaced by the image), delete → Undo, lightbox opens/closes with Escape.
- `import.spec.ts`: paste `sample-import.txt` → preview counts → commit → tree has the people.
Commit after each two specs or at the end: `test(e2e): trees, onboarding, person, relationships, timeline, media, import`.

---

### Task 3: Remaining specs (settings incl. trash, admin, palette, shortcuts)

- `settings.spec.ts`: language toggle changes the heading text (de/en) and persists after reload; theme toggle sets `color-scheme` on `<html>`; password change (then log in with the new one, change back); Trash card: delete a person in a throwaway tree, wait for the undo toast to expire (or dismiss), open `/settings#trash` → row present → Restore → row gone; delete again → Delete now → confirm → gone.
- `admin.spec.ts`: as demo (admin): register a user via API → Users page shows "pending" → activate → toggle admin → set password; the "me" row has no destructive actions.
- `palette.spec.ts`: `Control+k` on `/trees` → actions only; in a tree, type a surname → people group; Enter opens the person; "Trash" action lands on `/settings#trash`; palette does not open while the relationship dialog is open.
- `shortcuts.spec.ts`: `?` opens the sheet with the platform label; Escape closes; the user-menu item opens it too.
Commit: `test(e2e): settings, trash, admin, palette, shortcuts`. Full `npm run e2e` green twice in a row (flake check).

---

### Task 4: Coverage thresholds

- [ ] **Step 1: Measure** — `npx --prefix /home/ben/repo/qseng/frontend ng test --watch=false --coverage` after adding to `angular.json` test options:
```json
"coverage": { "enabled": true, "include": ["src/app/core/**/*.ts", "src/app/shared/**/*.ts"], "exclude": ["**/*.spec.ts", "**/generated/**", "**/translation-keys.ts"], "reporters": ["text", "lcov"] }
```
(check `npx ng test --help` / the `@angular/build:unit-test` schema for the exact option names and adjust). Record the summary line (lines/functions/branches/statements for the included files) in the report.
- [ ] **Step 2: Pin** — add `"thresholds": { "lines": <measured-5>, "functions": <measured-5>, "branches": <measured-5>, "statements": <measured-5> }` (integers, rounded down); confirm the run passes and that lowering a threshold above measured makes it fail (prove the gate bites), then restore. Add the numbers to spec §7 results.
- [ ] Commit: `test(frontend): coverage for core and shared with pinned thresholds`.

---

### Task 5: GitHub Actions workflow, Node 22 image, README

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `docker/Dockerfile.web` (`node:22-alpine`), `README.md` ("Running the checks"), spec §7 results block

- [ ] **Step 1: Workflow**
```yaml
name: ci
on:
  push: { branches: [main] }
  pull_request:
concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }
jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with: { dotnet-version: 10.0.x }
      - run: dotnet restore backend/Qseng.slnx
      - run: dotnet build backend/Qseng.slnx --configuration Release --no-restore
      - run: dotnet test backend/Qseng.slnx --configuration Release --no-build
      - run: dotnet publish backend/src/Qseng.Api -c Release -o out/api --no-build
      - uses: actions/upload-artifact@v4
        with: { name: api, path: out/api }
  frontend:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: frontend } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: frontend/package-lock.json }
      - run: npm ci
      - run: npm run gates
      - run: npx ng lint
      - run: npx ng test --watch=false --coverage
      - run: |
          npx ng build 2>&1 | tee build.log
          ! grep -E "WARNING|ERROR" build.log
      - uses: actions/upload-artifact@v4
        with: { name: web, path: frontend/dist/frontend/browser }
  contract:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with: { dotnet-version: 10.0.x }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: frontend/package-lock.json }
      - run: bash backend/export-openapi.sh
      - run: git diff --exit-code -- contracts/openapi.json
      - run: npm ci && npm run gen:api && npx ng build
        working-directory: frontend
  e2e:
    needs: [backend, frontend]
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: frontend } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with: { dotnet-version: 10.0.x }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: frontend/package-lock.json }
      - uses: actions/download-artifact@v4
        with: { name: api, path: out/api }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run e2e
        env: { E2E_API_CMD: "dotnet ${{ github.workspace }}/out/api/Qseng.Api.dll" }
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: frontend/playwright-report }
  docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -f docker/Dockerfile.api -t qseng-api:ci .
      - run: docker build -f docker/Dockerfile.web -t qseng-web:ci .
```
(The `dotnet publish --no-build` may need `--no-restore` variations; adjust to what passes. If `Dockerfile.api` uses a preview SDK tag that no longer exists, pin `mcr.microsoft.com/dotnet/sdk:10.0` / `aspnet:10.0`.)

- [ ] **Step 2: Local dry run** — `act` is not available; instead run each job's commands locally in order from a clean clone (`git clone /home/ben/repo/qseng /tmp/…`) to catch path assumptions; for e2e set `E2E_API_CMD` to the locally published dll. Also `docker build` both images if Docker is available locally (skip with a note otherwise).

- [ ] **Step 3: README + spec results** — README section "Running the checks" listing `npm run gates`, `npx ng lint`, `npx ng test --watch=false --coverage`, `npx ng build`, `dotnet test backend/Qseng.slnx`, `npm run e2e` (+ `e2e:install` once), and what CI runs. Spec §7 gets a "P3 results" block: measured coverage + thresholds, bundle size, e2e spec count, CI job list.

- [ ] Commit: `ci: GitHub Actions workflow (backend, frontend, contract, e2e, docker); Node 22 image; README checks`.

---

### Task 6: Push and verify CI (controller-run, after the user's go-ahead)

- [ ] Push `feat/p3-hardening`, open a PR against `main`, watch the five jobs; fix wave for any CI-only failure (paths, permissions, timing); record the run URL in the ledger and spec §7.
- [ ] Whole-plan review (opus) of P3a + P3b; close P3 in the ledger and memory.
