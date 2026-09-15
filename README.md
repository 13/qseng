# <img src="assets/qseng.png" width="30" height="30" /> Qseng

A modern family tree and genealogy app. Browse ancestors, visualize relationships, manage timelines, and import German-language genealogy text.

## Stack

| Layer | Technology |
|---|---|
| Backend | ASP.NET Core 10 · Clean Architecture · MediatR CQRS |
| Database | SQLite (dev) · PostgreSQL (prod) · EF Core 9 |
| Auth | JWT (HS256) · BCrypt passwords |
| Frontend | Angular 21 · standalone components · signals |
| Graph | Cytoscape.js with breadth-first layout |
| Container | Docker · nginx reverse proxy |

## Quick start

```bash
./start.sh
```

Opens the app at **http://localhost:4200** (frontend proxied to the API).

### Demo account

```
Email:    demo@qseng.app
Password: Demo123!
```

The Escobar-Smith-Spath family tree (5 generations, 42 people) is seeded automatically on first boot.

> **Re-seed demo data** (after updates): `rm backend/src/Qseng.Api/qseng.db` then restart — the database is recreated from scratch.

---

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| .NET SDK | 10.x | Build & run backend |
| Node.js | 20+ | Build & run frontend |
| npm | 10+ | Frontend package manager |
| Docker (optional) | 24+ | Containerised deployment |

Check with:

```bash
dotnet --version   # 10.x
node --version     # v20+
npm --version      # 10+
```

---

## Running locally (recommended for development)

```bash
./start.sh
```

This script:
1. Restores NuGet packages and starts the API on **http://localhost:5000**
2. Installs npm deps (if needed) and starts the Angular dev server on **http://localhost:4200**
3. Proxies `/api/*` from the frontend to the backend — no CORS setup needed
4. Creates and seeds `qseng.db` (SQLite) on first run automatically

Stop both processes with **Ctrl+C**.

### Manual start (two terminals)

```bash
# Terminal 1 — API

pacman -S aspnet-runtime dotnet-runtime dotnet-sdk

cd backend
dotnet run --project src/Qseng.Api

# Terminal 2 — Frontend

pacman -S npm

cd frontend
npm install
npm start
```

---

## Running with Docker

### Development (SQLite)

```bash
docker compose up --build
```

- Frontend: http://localhost:8081
- API:      http://localhost:8080

The override file (`docker-compose.override.yml`) disables PostgreSQL and mounts a SQLite volume automatically.

### Production (PostgreSQL)

```bash
# build locally
docker compose -f docker-compose.yml up --build
# or deploy a published release
QSENG_VERSION=1.2.0 docker compose -f docker-compose.yml up -d --no-build --pull always
```

- Frontend: http://localhost:8081
- API:      http://localhost:8080/api/v1

> **`Jwt__Key` must be overridden.** `docker-compose.yml`'s `Jwt__Key` is the built-in development
> placeholder (`JwtOptions.InsecureDevelopmentKey`), and `JwtOptionsValidator` rejects that exact
> value at startup whenever `ASPNETCORE_ENVIRONMENT` is not `Development` — which is the api
> image's default; only `docker-compose.override.yml` (the Development compose above) sets it to
> `Development`. Running `docker compose -f docker-compose.yml up` on its own therefore fails to
> start until you override `Jwt__Key` with a random 32+ character secret — via an env file
> (`--env-file`, or `environment:`) or a `docker-compose.prod.yml` layered on top of
> `docker-compose.yml`.

---

## Releases

Images are published to GitHub Container Registry by CI:

| Event | Tags | Extras |
|---|---|---|
| push to `main` (all checks green) | `edge`, `sha-<7>` | provenance + SBOM attestations |
| tag `vX.Y.Z` (all checks green) | `X.Y.Z`, `X.Y`, `latest` | attestations + a GitHub Release with generated notes |

Images: `ghcr.io/13/qseng-api`, `ghcr.io/13/qseng-web` (linux/amd64).

Cut a release:

```bash
git tag v1.2.0 && git push origin v1.2.0
```

Verify what you pull:

```bash
gh attestation verify oci://ghcr.io/13/qseng-api:1.2.0 --owner 13
docker run --rm ghcr.io/13/qseng-web:1.2.0 cat /usr/share/nginx/html/version.json
```

The running version is shown in Settings → About and in `/health/ready` (`version`, `commit`).
Local builds report `0.0.0-dev`.

---

## Project structure

```
qseng/
├── backend/
│   ├── Qseng.slnx
│   └── src/
│       ├── Qseng.Domain/          # Entities, value objects, enums
│       ├── Qseng.Application/     # CQRS handlers, DTOs, validators
│       ├── Qseng.Infrastructure/  # EF Core, JWT, BCrypt, parser, seeder
│       └── Qseng.Api/             # Controllers, middleware, Program.cs
├── frontend/
│   └── src/app/
│       ├── core/                  # Auth service, API client, interceptors
│       ├── shared/pipes/          # PartialDatePipe
│       └── features/              # auth · trees · persons · timeline · import
├── docker/
│   ├── Dockerfile.api
│   ├── Dockerfile.web
│   └── nginx.conf
├── docker-compose.yml             # PostgreSQL production
├── docker-compose.override.yml    # SQLite development (applied automatically)
└── start.sh                       # One-command local start
```

---

## API overview

Base path: `/api/v1`

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/auth/register` | Create account (pending admin activation unless first user) |
| `POST` | `/auth/login` | Login → JWT |
| `GET` | `/trees` | List your trees |
| `POST` | `/trees` | Create tree |
| `GET` | `/trees/{id}/persons` | List persons (+ `?search=`) |
| `POST` | `/trees/{id}/persons` | Add person |
| `GET` | `/persons/{id}` | Get person |
| `PUT` | `/persons/{id}` | Update person |
| `DELETE` | `/persons/{id}` | Delete person |
| `GET` | `/trees/{id}/relationships` | List relationships |
| `POST` | `/trees/{id}/relationships` | Create relationship |
| `DELETE` | `/trees/{id}/relationships/{rid}` | Delete relationship |
| `GET` | `/persons/{id}/timeline` | Get timeline |
| `POST` | `/persons/{id}/timeline` | Add event |
| `PUT` | `/persons/{id}/timeline/{eid}` | Update event |
| `DELETE` | `/persons/{id}/timeline/{eid}` | Delete event |
| `POST` | `/trees/{id}/import/preview` | Dry-run text import |
| `POST` | `/trees/{id}/import/commit` | Commit text import |
| `GET` | `/persons/{id}/media` | List person's media |
| `POST` | `/persons/{id}/media` | Upload photo / document |
| `DELETE` | `/persons/{id}/media/{mid}` | Delete media |

Swagger UI available at http://localhost:5000/swagger in development.

All endpoints except `/auth/*` and `/health` require `Authorization: Bearer <token>`.

- New registrations start **inactive** (`pendingActivation: true`, no token) until an admin activates them; the very first account becomes an active admin automatically.
- Passwords require a minimum of 8 characters.
- All tree, person, relationship, timeline, and media operations are scoped to the owning user (403 otherwise).

---

## Text import format

Paste German-notation genealogy text into the Import screen:

```
Johann Escobar * 12.04.1878 in Tirol + 03.11.1949
Maria Smith, geb. Huber * 01.06.1882 + 14.02.1955

Johann Escobar oo Maria Smith, 1905
```

- `*` = born · `+` = died · `oo` = marriage
- `geb.` = maiden name
- Dates: `DD.MM.YYYY`, `MM.YYYY`, or `YYYY`
- Prefix `~` or `ca.` for approximate dates

Use **Preview** to see what will be created before committing.

---

## Architecture notes

- **Result\<T\>** pattern throughout Application layer — no exceptions for expected errors.
- **PartialDate** value object handles genealogical dates where year, month, or day may be unknown. Stored as flat columns; sortable date computed in C#.
- **Auto-generated timeline events** are created when relationships are saved (marriage events on both spouses; "child born" on parent). Tagged `IsAutoGenerated = true` and linked via `SourceRelationshipId` for cleanup when the relationship is deleted.
- **Dual-DB**: `DB_PROVIDER=sqlite` (default) or `DB_PROVIDER=postgres`. `EnsureCreated` is used for schema creation (works for SQLite dev; formal EF migrations can be added for postgres prod).

---

## Running tests

```bash
cd backend
dotnet test
```

---

## Running the checks

The same checks CI runs, in order:

```bash
# Frontend — from frontend/
npm run gates              # source gates: no ngModel, no legacy imports, sorted/matching i18n keys, no emoji
npx ng lint                # ESLint over src/
npm run e2e:lint           # ESLint over e2e/
npx ng test --watch=false  # Vitest; coverage + thresholds run on every invocation (see below)
npx ng build                # production build

# Backend — from repo root
dotnet test backend/Qseng.slnx

# End-to-end — from frontend/, once Playwright's browser is installed
npm run e2e:install        # one-time: installs the Playwright Chromium browser
npm run e2e                # boots the API and dev server, runs the Playwright suite
```

Coverage is always on: `angular.json`'s `test` target sets `coverage: true`, so every `ng test`
run computes coverage (Vitest v8, reporters `text` + `lcov`) over `src/app/core/**` and
`src/app/shared/**` and enforces the pinned thresholds — lines 88 / functions 79 / branches 84 /
statements 85 — failing the run if any drop below. `--coverage` on the command line is optional
and only affects reporter verbosity. All 24 non-spec, non-generated `core/`/`shared/` files are
instrumented on a full run (`coverage/frontend/lcov.info` has 24 `SF:` entries); some files reach
100% on every metric and so don't print a row in the compact text table — see `lcov.info` for the
authoritative per-file list. `@angular/build`'s Vitest integration
(21.2.8) does not pass a `coverage.all` set via a `vitest.config.ts` runner config through to
Vitest — its plugin rebuilds `test.coverage` from a fixed field whitelist and drops anything
else — so that option isn't available here even where it would matter.

### What CI runs

`.github/workflows/ci.yml` runs on every push to `main` and on pull requests, with five jobs:

| Job | What it does |
|---|---|
| `backend` | restore, build (Release), `dotnet test`, `dotnet publish` → uploads the published API as an artifact |
| `frontend` | `npm ci`, `npm run gates`, `ng lint`, `npm run e2e:lint`, `ng test --coverage`, `ng build` (fails if the bundle exceeds its budget) → uploads the browser bundle as an artifact |
| `contract` | regenerates `contracts/openapi.json` from a live API instance and fails if it drifts from the committed file, then regenerates the Angular API client and builds |
| `e2e` | needs `backend` + `frontend`; downloads the published API artifact, installs Playwright's Chromium, runs the full Playwright suite against it |
| `images` | builds both images (PRs) and pushes them to ghcr.io with attestations (push to main / v* tags); `release` creates the GitHub Release on tags |
