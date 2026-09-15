# P3 Engineering hardening — design

Date: 2026-09-14 · Status: approved · Branch: `feat/p3-hardening` (from `main` at a6e1415, P1 + P2 merged)

Goal: make the quality bar automatic (GitHub Actions running every gate, Playwright end-to-end
tests with accessibility checks, pinned coverage), and harden the backend for real deployments
(configured CORS, rate-limited auth, health endpoints, request logging), plus the trash view
and the purge/avatar fixes carried from the P2 reviews.

Decisions taken during brainstorming:

| Topic | Decision |
|---|---|
| CI | GitHub Actions, one workflow: backend, frontend, contract drift, e2e (Chromium + axe), docker build-only |
| e2e depth | Roadmap list + P2 flows, axe on every distinct page, seeded SQLite API per run |
| Coverage | v8 via Vitest; measure `core/` + `shared/` first, pin thresholds 5 points below measured |
| Hardening | CORS from configuration; fixed-window rate limit on auth; `/health/live` + `/health/ready`; Serilog request logging |
| Trash | `GET /api/v1/trash`, `DELETE /api/v1/trash/{personId}`; Settings "Trash" card; avatar swap in one transaction; account deletion removes files; timeline delete scoped by person |

## 1. Scope and order

| # | Area | Deliverable |
|---|---|---|
| A | Backend hardening | CORS options, auth rate limiting, health checks, request logging |
| B | Trash + fixes | Trash list/purge endpoints, transaction on avatar swap, media files on account deletion, scoped timeline delete; Settings "Trash" card; palette action |
| C | e2e | `frontend/e2e/` Playwright suite with fixtures, axe, isolated API |
| D | Coverage | Vitest v8 coverage, thresholds pinned in `angular.json` |
| E | CI | `.github/workflows/ci.yml` with the five jobs; README "Running the checks" |

Order A → B → C → D → E: e2e exercises the trash view; CI is written last so it runs the final
commands. Out of scope: image publishing, deployment, Postgres in CI (the SQLite chain is the
tested one; Postgres migrations are generated from the same model and boot-tested manually).

## 2. Backend hardening

### CORS

`CorsOptions { string[] AllowedOrigins }` bound from section `Cors` (env
`Cors__AllowedOrigins__0`). Development default (when the section is absent):
`["http://localhost:4200"]`. Production with an empty list fails at startup through
`IValidateOptions<CorsOptions>` like `JwtOptionsValidator`. `Program.cs` replaces
`AllowAnyOrigin()` with `WithOrigins(options.AllowedOrigins)` + `AllowAnyHeader().AllowAnyMethod()`
and `AllowCredentials()` is NOT added (bearer tokens, no cookies). `docker-compose.yml` sets
`Cors__AllowedOrigins__0: http://localhost:8081`. Test: options validator rejects empty in
production, accepts the dev default.

### Rate limiting

`builder.Services.AddRateLimiter(o => { o.AddFixedWindowLimiter("auth", w => { w.PermitLimit = 10; w.Window = TimeSpan.FromMinutes(1); w.QueueLimit = 0; }); o.RejectionStatusCode = 429; o.OnRejected = … })`
— partitioned per client IP (`RemoteIpAddress`, falling back to a single partition when null),
so `AddPolicy("auth", ctx => RateLimitPartition.GetFixedWindowLimiter(ip, …))`. Applied with
`[EnableRateLimiting("auth")]` on `Auth_Login`, `Auth_Register`, `Auth_Refresh`. `OnRejected`
writes a ProblemDetails body (`status 429`, `title "Too Many Requests"`, `detail "Try again in
N seconds."`) with `Retry-After`, `application/problem+json`. Limits are configurable via
`RateLimiting:Auth:PermitLimit` / `WindowSeconds` (defaults 10 / 60) so the e2e run can raise
them (`RateLimiting__Auth__PermitLimit=1000`). `app.UseRateLimiter()` after routing, before auth.
Test (`Qseng.Api.Tests`): the `OnRejected` writer produces the ProblemDetails shape.

### Health checks

`AddHealthChecks().AddDbContextCheck<QsengDbContext>("database").AddCheck<UploadsWritableCheck>("uploads")`
(writes and deletes a probe file under `Uploads:Path`). Endpoints: `/health/live` with
`Predicate = _ => false` (process up) and `/health/ready` running all checks, both with a JSON
writer `{ "status": "Healthy", "checks": [{ "name", "status", "duration" }] }` and
`AllowAnonymous`; not part of the OpenAPI document (minimal endpoints, already excluded by the
`DocInclusionPredicate`). `/api/v1/health` stays for compatibility. `docker/Dockerfile.api`
HEALTHCHECK → `/health/ready`. Test: `UploadsWritableCheck` returns Unhealthy for a read-only
path (temp dir with `chmod 500`) and Healthy for a writable one.

### Request logging

`app.UseSerilogRequestLogging(o => o.EnrichDiagnosticContext = (ctx, http) => ctx.Set("UserId", http.User.FindFirstValue(ClaimTypes.NameIdentifier)))`
after authentication. Health endpoints logged at Verbose (`GetLevel`).

## 3. Trash view and purge fixes

### Endpoints

| Method | Route | operationId | Notes |
|---|---|---|---|
| GET | `/api/v1/trash` | `Trash_List` | caller's trashed persons across their trees, newest first: `TrashedPersonDto(id, firstName, lastName, treeId, treeName, deletedAt, purgeAt)`; `purgeAt = deletedAt + Trash:RetentionDays` |
| DELETE | `/api/v1/trash/{personId}` | `Trash_Purge` | hard-deletes that person's batch now (media files first) through a new `TrashPurger.PurgeBatchAsync(Guid personId)`; 404 when not trashed, 403 when not the owner |

Restore keeps using `Persons_Restore`. Handlers in `Qseng.Application/Trash/`. Tests: list shows
only the caller's rows with the right `purgeAt`; purge removes exactly the batch and calls
`IFileStorage.DeleteAsync` for its media.

### Fixes

- `IQsengDbContext.BeginTransactionAsync(CancellationToken) → Task<IAsyncDisposable>` (wraps
  `Database.BeginTransactionAsync`; commits on `CompleteAsync()` — expose a small
  `ITransactionScope { CompleteAsync(); DisposeAsync(); }`). `SetAvatarHandler` and
  `DeleteMediaHandler` wrap their two saves in one scope. With real SQLite in tests the
  per-statement index check still passes because the two `SaveChanges` calls stay separate
  inside the transaction.
- `DeleteOwnDataHandler` / `DeleteOwnAccountHandler`: collect media urls of the user's trees
  (`IgnoreQueryFilters()`) before removing the trees; after `SaveChangesAsync` delete the files
  (failures logged). Test asserts `DeleteAsync` called per url.
- `TimelineController.Delete` passes `personId`: `DeleteTimelineEventCommand(Guid PersonId, Guid Id)`;
  the handler returns 404 when the event's `PersonId` differs. Contract: the route is unchanged.

### Settings "Trash" card

Below "Data export": `mat-card` "Trash" (`id="trash"`) with a `mat-table` (name, tree, deleted
on, purge on) loaded from `TrashApi.trashList()`, which returns
`TrashListDto { retentionDays, items: TrashedPersonDto[] }`. Row actions: "Restore"
(`personsRestore` → success toast `trash.restored` with `__NAME__`) and "Delete now" (confirm
dialog → `trashPurge` → toast `trash.purged`). Empty state `trash.empty` ("Trash is empty").
Retention note `trash.retention` ("Items are removed automatically after __DAYS__ days").
The palette gains an action "Trash" → `/settings#trash`; the settings page scrolls to the
fragment after load.

## 4. End-to-end tests

- `frontend/e2e/` with `@playwright/test` (devDependency) and `playwright.config.ts`: Chromium
  only, `baseURL http://localhost:4200`, `webServer` = `npm start` (dev server with the proxy),
  `globalSetup` starts the API: copies nothing — starts `dotnet run` on
  `backend/src/Qseng.Api` with `ASPNETCORE_ENVIRONMENT=Development`,
  `CONNECTION_STRING=Data Source=<tmp>/e2e.db`, `Uploads__Path=<tmp>/uploads`,
  `RateLimiting__Auth__PermitLimit=1000`, waits for `/health/ready`; `globalTeardown` kills it.
  In CI the API binary is prebuilt (`dotnet publish` output cached from the backend job) to
  avoid a second compile; locally `dotnet run` is fine.
- Fixtures (`e2e/fixtures.ts`): `demoPage` (logged in as demo via the UI once per worker,
  storage state reused), `freshUser` (registers `e2e-<run>-<n>`, activates through the admin
  API with the demo token, logs in), `axeCheck(page, name)` (injects `axe-core` from
  `node_modules`, fails on `serious`/`critical`, attaches the JSON), `api` (request context with
  the bearer token).
- Specs (one file each, independent, own data where they mutate): `auth`, `trees`,
  `onboarding`, `person` (create/edit + Ctrl+S/delete + undo), `relationships` (existing,
  inline new, undo), `timeline`, `media` (fixture PNG), `import`, `settings` (language, theme,
  password, trash card), `admin`, `palette`, `shortcuts`. Selectors: roles and labels; no CSS
  classes except the few `data-testid`s added for the graph canvas and palette rows.
- `npm run e2e` (headless), `npm run e2e:ui`. Reports: HTML + trace on first retry; CI uploads
  `playwright-report/` and `test-results/` on failure.

## 5. Coverage

`ng test --coverage` (Vitest v8, reporters text + lcov, `coverage.include` =
`src/app/core/**`, `src/app/shared/**`, exclude `**/generated/**` and `*.spec.ts`). Step 1
measures; step 2 pins `thresholds` (lines, functions, branches, statements) at measured − 5,
rounded down, in `angular.json`'s test target `coverage` options (or `vitest.config` if the
builder needs it). Documented in the plan with the measured numbers.

## 6. CI

`.github/workflows/ci.yml`, triggers `push: [main]`, `pull_request`; `concurrency` per ref with
cancel-in-progress.

| Job | Steps |
|---|---|
| backend | `actions/setup-dotnet@v4` (10.0.x), NuGet cache, `dotnet build --configuration Release`, `dotnet test backend/Qseng.slnx --no-build --configuration Release`, `dotnet publish backend/src/Qseng.Api -c Release -o out/api` → artifact `api` |
| frontend | `actions/setup-node@v4` (22, npm cache), `npm ci` (in `frontend`), `npm run gates`, `npx ng lint`, `npx ng test --watch=false --coverage`, `npx ng build 2>&1 \| tee build.log` + `! grep -E "WARNING\|ERROR" build.log`, artifact `web` (`dist/frontend/browser`) |
| contract | needs backend build only: `bash backend/export-openapi.sh`, `git diff --exit-code contracts/openapi.json`, then `npm ci && npm run gen:api && npx ng build` (regenerated client compiles) |
| e2e | needs backend + frontend: download `api`, `npx playwright install --with-deps chromium`, `npm run e2e` with `E2E_API_CMD` pointing at the published `Qseng.Api.dll`; upload report on failure |
| docker | `docker build -f docker/Dockerfile.api .` and `docker/Dockerfile.web`, no push |

Node 22 in CI (`docker/Dockerfile.web` moves to `node:22-alpine` for consistency). README gains
"Running the checks": the four frontend commands, `dotnet test`, `npm run e2e`.

## 7. Testing and done criteria

- Backend: options validators, rate-limit rejection writer, health check, trash list/purge,
  transaction scope (real SQLite), media-file deletion on account removal, scoped timeline delete.
- Frontend: settings trash card spec (list, restore, purge with confirm), palette action; e2e
  suite green locally (`npm run e2e`) and in CI.
- CI green on the P3 PR (all five jobs); coverage thresholds pinned; `npm run gates`, lint,
  build (budget 800 kB — re-measured; if the trash card pushes the initial bundle over, it is
  lazy) green; OpenAPI contract regenerated and committed with the new trash operations.
- README updated; spec §7 results block appended at the end (measured coverage, bundle).

## 8. P3a results (2026-09-15, branch `feat/p3-hardening`)

- CORS from `Cors:AllowedOrigins` (validated at startup; origins with a path, query, fragment or trailing slash are rejected because the middleware compares the `Origin` header verbatim); Development defaults to `http://localhost:4200`.
- Auth rate limit: fixed window per client IP (`RateLimiting:Auth`, 10 / 60 s), 429 ProblemDetails with `Retry-After`, rejections logged at Warning. Behind the compose nginx the client IP comes from `X-Forwarded-For`, trusted only from `ForwardedHeaders:KnownNetworks` — the compose file pins the network to `172.28.0.0/16`; a custom Docker address pool must be mirrored into `ForwardedHeaders__KnownNetworks__0`, otherwise every client shares one partition. The api container no longer publishes a host port (nginx is the only entry).
- Health: `/health/live`, `/health/ready` (database + uploads-writable, path rooted at the content root); the image HEALTHCHECK uses `/health/ready`.
- Trash: `Trash_List` / `Trash_Purge`; the Settings card uses the key `trash.hint` for the retention note (spec text said `trash.retention`). Purge removes rows before files (orphan files, never dangling rows); a null deletion batch cannot widen a purge.
- Avatar swap and media delete run in one transaction; account/data deletion removes media files after the commit; timeline delete is scoped by person.
- Backend 109 tests on real SQLite; frontend 53 files / 297 tests; bundle 793 kB (headroom 7 kB). Deferred: app-wide `LOCALE_ID` for dates; unthrottled health endpoints (mitigated by no host port); `docker-compose.override.yml` now resets the api → postgres dependency for the SQLite profile.

## 9. P3b results (2026-09-15, branch `feat/p3-hardening`)

- CI: `.github/workflows/ci.yml`, five jobs (`backend`, `frontend`, `contract`, `e2e`, `docker`), `push: [main]` + `pull_request`, concurrency-cancelled per ref. `frontend` gained an `e2e:lint` step (new `npm run e2e:lint` script, `eslint e2e --config eslint.config.js`) alongside `gates`/`ng lint`/`ng test`/`ng build`. `docker/Dockerfile.web` moved to `node:22-alpine` to match CI's Node 22.
- Coverage (measured, `ng test --coverage`, Vitest v8): statements 90.57% / branches 89.58% / functions 84.55% / lines 93.11%, against pinned thresholds statements 85 / branches 84 / functions 79 / lines 88 — all comfortably above. 53 spec files / 298 tests.
- Frontend production bundle (`ng build`): initial total 793.04 kB, no build WARNING/ERROR lines (the CI build step tees the log and greps for them).
- Backend: `dotnet test backend/Qseng.slnx` — 109 tests (13 Domain, 20 Api, 76 Application) on real SQLite, all passing.
- e2e: 27 specs collected, 26 passed + 1 `fixme` (marriage-line spouse-name truncation, tracked separately), full suite in ~1.3 min against the published API DLL.
- Dry run (clean clone, local machine): every job's commands run in order and passed, including `docker build` for both `docker/Dockerfile.api` and `docker/Dockerfile.web`. Found and fixed two real bugs surfaced only by running the published artifacts rather than `dotnet run`/`ng serve`: (1) `dotnet <published-dll>` resolves `appsettings.json` against the process's current working directory, not the dll's own folder — the e2e job's `env` now sets `ASPNETCORE_CONTENTROOT` alongside `E2E_API_CMD` so the published API finds its `Jwt`/`Uploads`/`RateLimiting` config; without it the API fails `OptionsValidationException: Jwt:Issuer must be set` on startup. (2) `docker/Dockerfile.api`'s build stage only `COPY`s the four `src/*` project files before `dotnet restore backend/Qseng.slnx`, but the solution also references the three `backend/tests/*` projects — restore failed with `MSB3202: project file ... was not found`; added the missing `COPY backend/tests/*/*.csproj` lines. Also switched both `Dockerfile.api` stages from the `10.0-preview` SDK/runtime tags to the now-published non-preview `10.0` tags (verified present via `docker manifest inspect`), matching the locally installed `dotnet 10.0.109`.
