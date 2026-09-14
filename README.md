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
docker compose -f docker-compose.yml up --build
```

- Frontend: http://localhost:8081
- API:      http://localhost:8080/api/v1

> **Before going to prod:** change the `Jwt__Key` value in `docker-compose.yml` to a random 32+ character string.

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
