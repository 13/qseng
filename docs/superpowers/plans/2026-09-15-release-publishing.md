# Release Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every push to `main` publishes `ghcr.io/13/qseng-api:edge` and `ghcr.io/13/qseng-web:edge`; every `v*` tag publishes semver-tagged images with provenance/SBOM attestations and creates a GitHub Release; the running app shows its version.

**Architecture:** `ci.yml` keeps its four check jobs; the `docker` job becomes an `images` matrix job that builds on PRs and builds+pushes on push events, gated on the checks; a `release` job (tags only) creates the GitHub Release. Version and commit are stamped into both images through build args, surfaced by `/health/*` (API) and `/version.json` (web), and shown on a Settings "About" card.

**Tech Stack:** GitHub Actions (docker/setup-buildx-action@v3, docker/login-action@v3, docker/metadata-action@v5, docker/build-push-action@v6, anchore/sbom-action@v0, actions/attest-build-provenance@v3, actions/attest-sbom@v3, gh CLI), Docker, .NET 10 (MSBuild `Version`/`InformationalVersion`), Angular 21 (signals, HttpClient), Playwright.

Spec: `docs/superpowers/specs/2026-09-15-release-publishing-design.md`.

## Global Constraints

- Images: `ghcr.io/<owner lowercased>/qseng-api` and `…/qseng-web`; `linux/amd64` only; pushed only on `push` events and only after `backend`, `frontend`, `contract`, `e2e` are green.
- Tags: on `refs/tags/vX.Y.Z` → `X.Y.Z`, `X.Y`, `latest`; on `main` → `edge`, `sha-<7>`; on PRs → none (build only, no login).
- Build args: `QSENG_VERSION` (`X.Y.Z` on tags, `0.0.0-edge` on main, `0.0.0-pr` on PRs, default `0.0.0-dev`) and `QSENG_COMMIT` (`github.sha`, default `unknown`). `InformationalVersion` = `<version>+<commit>`; `Version` = `<version>` (never contains `+`).
- `/health/live` and `/health/ready` JSON gains `version` and `commit`; `version.json` = `{"version","commit","builtAt"}` served with `Cache-Control: no-cache`; nginx proxies `/health/` to the API.
- Top-level workflow `permissions: { contents: read }` stays; `images` declares `{ contents: read, packages: write, id-token: write, attestations: write }`; `release` declares `{ contents: write }`. No repository secrets.
- i18n: keys in `frontend/public/assets/i18n/{en,de}.json`, sorted, identical sets; `npm run gen:i18n` after edits; `npm run gates` must pass (no emoji, no `window.confirm/alert`, no ngModel, no raw generated-client import outside `core/api`).
- Bundle warning budget 800 kB (currently 793.62 kB).
- Every commit ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01GwjzuwwNEe1aHdVkPbFffW`. Commit only named files. Nothing is pushed by implementers; the controller pushes after the user's go-ahead.
- Shell: `cd` is broken — absolute paths, `git -C`, `npm --prefix`; wrap long commands in `timeout`; never `pkill -f`; kill by PID.

---

### Task 1: API version stamping (`AppVersion`, health JSON, Dockerfile.api)

**Files:**
- Create: `backend/src/Qseng.Api/AppVersion.cs`
- Modify: `backend/src/Qseng.Api/Health/HealthResponseWriter.cs`
- Modify: `backend/src/Qseng.Api/Qseng.Api.csproj` (PropertyGroup)
- Modify: `docker/Dockerfile.api`
- Test: `backend/tests/Qseng.Api.Tests/AppVersionTests.cs`, `backend/tests/Qseng.Api.Tests/HealthResponseWriterTests.cs`

**Interfaces:**
- Produces: `Qseng.Api.AppVersion.Version` (string), `AppVersion.Commit` (string), `AppVersion.Parse(string informationalVersion) → (string Version, string Commit)`; health JSON fields `version`, `commit` (Task 3 reads them from `/health/ready`).

- [ ] **Step 1: Failing tests**

`backend/tests/Qseng.Api.Tests/AppVersionTests.cs`:
```csharp
using FluentAssertions;
using Qseng.Api;
using Xunit;

public class AppVersionTests
{
    [Theory]
    [InlineData("1.2.0+abc1234", "1.2.0", "abc1234")]
    [InlineData("0.0.0-edge+9f8e7d6c5b4a", "0.0.0-edge", "9f8e7d6c5b4a")]
    [InlineData("0.0.0-dev", "0.0.0-dev", "unknown")]
    [InlineData("", "0.0.0-dev", "unknown")]
    public void Parse_splits_version_and_commit(string input, string version, string commit)
    {
        var (v, c) = AppVersion.Parse(input);
        v.Should().Be(version);
        c.Should().Be(commit);
    }

    [Fact]
    public void Static_values_are_never_empty()
    {
        AppVersion.Version.Should().NotBeNullOrWhiteSpace();
        AppVersion.Commit.Should().NotBeNullOrWhiteSpace();
    }
}
```

`backend/tests/Qseng.Api.Tests/HealthResponseWriterTests.cs`:
```csharp
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Qseng.Api;
using Qseng.Api.Health;
using Xunit;

public class HealthResponseWriterTests
{
    [Fact]
    public async Task Payload_carries_status_checks_version_and_commit()
    {
        var http = new DefaultHttpContext();
        http.Response.Body = new MemoryStream();
        var report = new HealthReport(
            new Dictionary<string, HealthReportEntry>
            {
                ["uploads"] = new(HealthStatus.Healthy, null, TimeSpan.FromMilliseconds(3), null, null)
            },
            TimeSpan.FromMilliseconds(3));

        await HealthResponseWriter.WriteAsync(http, report);

        http.Response.Body.Position = 0;
        using var doc = await JsonDocument.ParseAsync(http.Response.Body);
        var root = doc.RootElement;
        root.GetProperty("status").GetString().Should().Be("Healthy");
        root.GetProperty("version").GetString().Should().Be(AppVersion.Version);
        root.GetProperty("commit").GetString().Should().Be(AppVersion.Commit);
        root.GetProperty("checks").GetArrayLength().Should().Be(1);
        http.Response.ContentType.Should().Be("application/json");
    }
}
```

- [ ] **Step 2: Run, expect compile failure** — `dotnet test /home/ben/repo/qseng/backend/Qseng.slnx --filter "AppVersion|HealthResponseWriter"` → error CS0103/CS0246 (`AppVersion` missing).

- [ ] **Step 3: Implement**

`backend/src/Qseng.Api/AppVersion.cs`:
```csharp
using System.Reflection;

namespace Qseng.Api;

/// <summary>
/// Build identity stamped at publish time (see docker/Dockerfile.api: -p:InformationalVersion=&lt;version&gt;+&lt;commit&gt;).
/// Local builds carry the csproj defaults ("0.0.0-dev", no commit).
/// </summary>
public static class AppVersion
{
    public const string DefaultVersion = "0.0.0-dev";
    public const string UnknownCommit = "unknown";

    public static string Version { get; }
    public static string Commit { get; }

    static AppVersion()
    {
        var info = typeof(AppVersion).Assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
        (Version, Commit) = Parse(info ?? DefaultVersion);
    }

    public static (string Version, string Commit) Parse(string informationalVersion)
    {
        if (string.IsNullOrWhiteSpace(informationalVersion)) return (DefaultVersion, UnknownCommit);
        var plus = informationalVersion.IndexOf('+');
        if (plus < 0) return (informationalVersion, UnknownCommit);
        var commit = informationalVersion[(plus + 1)..];
        return (informationalVersion[..plus], commit.Length == 0 ? UnknownCommit : commit);
    }
}
```

`HealthResponseWriter.cs` payload gains two fields after `status`:
```csharp
        var payload = new
        {
            status = report.Status.ToString(),
            version = AppVersion.Version,
            commit = AppVersion.Commit,
            checks = report.Entries.Select(e => new
            {
                name = e.Key,
                status = e.Value.Status.ToString(),
                duration = e.Value.Duration.ToString()
            })
        };
```

`Qseng.Api.csproj` PropertyGroup additions (keeps local `dotnet run` deterministic — the SDK otherwise appends the git SHA to InformationalVersion when a `.git` directory is present):
```xml
    <Version>0.0.0-dev</Version>
    <IncludeSourceRevisionInInformationalVersion>false</IncludeSourceRevisionInInformationalVersion>
```

`docker/Dockerfile.api` build stage: add after `WORKDIR /src`
```dockerfile
ARG QSENG_VERSION=0.0.0-dev
ARG QSENG_COMMIT=unknown
```
and change the publish line to
```dockerfile
RUN dotnet publish backend/src/Qseng.Api/Qseng.Api.csproj -c Release -o /app/publish \
    -p:Version=$QSENG_VERSION -p:InformationalVersion=$QSENG_VERSION+$QSENG_COMMIT
```
Runtime stage: add before `USER app`
```dockerfile
LABEL org.opencontainers.image.source=https://github.com/13/qseng
```

- [ ] **Step 4: Run tests** — same filter → 2 test classes pass; then `dotnet test /home/ben/repo/qseng/backend/Qseng.slnx` → 128 + 5 = 133 passed.

- [ ] **Step 5: Verify the image stamp** (Docker, ~5 min):
```bash
timeout 600 docker build --build-arg QSENG_VERSION=9.9.9 --build-arg QSENG_COMMIT=abc1234 -f /home/ben/repo/qseng/docker/Dockerfile.api -t qseng-api:vt /home/ben/repo/qseng
docker run -d --rm --name qseng-vt -p 127.0.0.1:18080:8080 -e ASPNETCORE_ENVIRONMENT=Development -e DB_PROVIDER=sqlite -e "CONNECTION_STRING=Data Source=/data/qseng.db" -e Uploads__Path=/app/uploads qseng-api:vt
for i in $(seq 1 30); do curl -fsS http://127.0.0.1:18080/health/ready && break; sleep 2; done
docker rm -f qseng-vt; docker rmi qseng-api:vt
```
Expected: the JSON contains `"version":"9.9.9","commit":"abc1234"`.

- [ ] **Step 6: Commit** — `git add backend/src/Qseng.Api/AppVersion.cs backend/src/Qseng.Api/Health/HealthResponseWriter.cs backend/src/Qseng.Api/Qseng.Api.csproj docker/Dockerfile.api backend/tests/Qseng.Api.Tests/AppVersionTests.cs backend/tests/Qseng.Api.Tests/HealthResponseWriterTests.cs` → `feat(api): stamp version and commit into the build and /health responses`.

---

### Task 2: Web image version file, nginx routes, dev defaults

**Files:**
- Modify: `docker/Dockerfile.web`
- Modify: `docker/nginx.conf`
- Create: `frontend/public/version.json`
- Modify: `frontend/proxy.conf.json`

**Interfaces:**
- Produces: `GET /version.json` → `{"version":"…","commit":"…","builtAt":"…"}` (Task 3 reads it); `GET /health/ready` reachable through the web container and through `ng serve`'s proxy.

- [ ] **Step 1: Dev defaults** — `frontend/public/version.json`:
```json
{"version":"0.0.0-dev","commit":"unknown","builtAt":"1970-01-01T00:00:00Z"}
```
`frontend/proxy.conf.json`: add a third entry identical to `/api` for `"/health"`.

- [ ] **Step 2: Dockerfile.web** — after `FROM node:22-alpine AS build` add
```dockerfile
ARG QSENG_VERSION=0.0.0-dev
ARG QSENG_COMMIT=unknown
```
and after the `npm run build` line add
```dockerfile
# Overwrites public/version.json's dev defaults with the values the CI workflow passes in.
RUN printf '{"version":"%s","commit":"%s","builtAt":"%s"}\n' "$QSENG_VERSION" "$QSENG_COMMIT" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    > /repo/frontend/dist/frontend/browser/version.json
```
Runtime stage: add `LABEL org.opencontainers.image.source=https://github.com/13/qseng` after the `FROM nginx…` line.

- [ ] **Step 3: nginx.conf** — add before `location / {`:
```nginx
  location = /version.json {
    add_header Cache-Control "no-cache";
  }

  location /health/ {
    proxy_pass http://api:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
```

- [ ] **Step 4: Verify** (~5 min):
```bash
timeout 600 docker build --build-arg QSENG_VERSION=9.9.9 --build-arg QSENG_COMMIT=abc1234 -f /home/ben/repo/qseng/docker/Dockerfile.web -t qseng-web:vt /home/ben/repo/qseng
docker run --rm qseng-web:vt cat /usr/share/nginx/html/version.json
docker run --rm qseng-web:vt nginx -t
docker rmi qseng-web:vt
```
Expected: `{"version":"9.9.9","commit":"abc1234","builtAt":"20..Z"}` and `syntax is ok`. Also `timeout 300 npx --prefix /home/ben/repo/qseng/frontend ng build` still passes and `dist/frontend/browser/version.json` holds the dev defaults.

- [ ] **Step 5: Commit** — `git add docker/Dockerfile.web docker/nginx.conf frontend/public/version.json frontend/proxy.conf.json` → `feat(web): serve version.json and proxy /health through nginx`.

---

### Task 3: Settings "About" card (frontend)

**Files:**
- Create: `frontend/src/app/core/version/version.service.ts`, `frontend/src/app/core/version/version.service.spec.ts`
- Create: `frontend/src/app/features/settings/about-card.component.ts`, `frontend/src/app/features/settings/about-card.component.spec.ts`
- Modify: `frontend/src/app/core/error.interceptor.ts` (+ its spec `frontend/src/app/core/error.interceptor.spec.ts`)
- Modify: `frontend/src/app/features/settings/settings.component.ts` (template: card after `<qs-trash-card …/>`, before the danger card; imports)
- Modify: `frontend/public/assets/i18n/en.json`, `frontend/public/assets/i18n/de.json` (then `npm run gen:i18n`)
- Modify: `frontend/e2e/specs/settings.spec.ts`

**Interfaces:**
- Consumes: `/version.json` (Task 2), `/health/ready` `{ version, commit }` (Task 1).
- Produces: `SKIP_ERROR_TOAST` `HttpContextToken<boolean>` exported from `core/error.interceptor.ts`; `VersionService { web: Signal<BuildInfo|null>; api: Signal<BuildInfo|null>; load(): void }`; `BuildInfo { version: string; commit: string }`.

- [ ] **Step 1: Interceptor bypass test** — in `error.interceptor.spec.ts` add a test: a request carrying `SKIP_ERROR_TOAST=true` that fails with 503 does not call `toast.error`, while the same request without the token does (mirror the existing 5xx test's setup: `HttpClient` + `HttpTestingController` + mocked `ToastService`).

- [ ] **Step 2: Implement the token** — `error.interceptor.ts`:
```ts
import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
/** Set on requests whose failure the caller renders itself (e.g. the About card's version probes). */
export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);
```
and guard the two toast branches: `const quiet = req.context.get(SKIP_ERROR_TOAST);` then `if (err.status === 403 && !quiet) …` / `else if ((err.status === 0 || err.status >= 500) && !quiet) …`.

- [ ] **Step 3: VersionService spec** (`version.service.spec.ts`), using `provideHttpClient()` + `provideHttpClientTesting()`:
  - `load()` requests `/version.json` and `/health/ready` once each (a second `load()` issues no new requests); responses `{version:'1.2.0',commit:'abc1234def'}` and `{status:'Healthy',version:'1.2.0',commit:'abc1234def'}` set `web()` and `api()` to `{ version: '1.2.0', commit: 'abc1234def' }`;
  - a 503 on `/health/ready` leaves `api()` at `null` without throwing;
  - both requests carry `SKIP_ERROR_TOAST` (`req.request.context.get(SKIP_ERROR_TOAST) === true`).

- [ ] **Step 4: Implement** `version.service.ts`:
```ts
import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { SKIP_ERROR_TOAST } from '../error.interceptor';

export interface BuildInfo { version: string; commit: string; }

interface BuildInfoLike { version?: string | null; commit?: string | null; }

function toInfo(v: BuildInfoLike | null): BuildInfo | null {
  return v?.version ? { version: v.version, commit: v.commit || 'unknown' } : null;
}

/** Build identity of the web bundle (/version.json) and the API (/health/ready), fetched once. */
@Injectable({ providedIn: 'root' })
export class VersionService {
  private readonly http = inject(HttpClient);
  private loaded = false;
  readonly web = signal<BuildInfo | null>(null);
  readonly api = signal<BuildInfo | null>(null);

  load(): void {
    if (this.loaded) return;
    this.loaded = true;
    const context = new HttpContext().set(SKIP_ERROR_TOAST, true);
    this.http.get<BuildInfoLike>('/version.json', { context }).pipe(catchError(() => of(null)))
      .subscribe(v => this.web.set(toInfo(v)));
    this.http.get<BuildInfoLike>('/health/ready', { context }).pipe(catchError(() => of(null)))
      .subscribe(v => this.api.set(toInfo(v)));
  }
}
```

- [ ] **Step 5: AboutCard spec** (`about-card.component.spec.ts`, TestBed with `VersionService` replaced by `{ web: signal({version:'1.2.0',commit:'abc1234def'}), api: signal(null), load: vi.fn() }` and `I18nService` `{ t: k => k, lang: signal('en') }`): renders `1.2.0 (abc1234)` for web and `—` for API; `load` was called once; the releases link has `href="https://github.com/13/qseng/releases"`, `target="_blank"`, `rel="noopener"`.

- [ ] **Step 6: Implement** `about-card.component.ts`:
```ts
import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { BuildInfo, VersionService } from '../../core/version/version.service';

/** Settings card showing the running web and API versions (see docs/superpowers/specs/2026-09-15-release-publishing-design.md §3). */
@Component({
  selector: 'qs-about-card',
  imports: [MatCardModule, MatButtonModule, MatIconModule, TranslatePipe],
  template: `
    <mat-card appearance="outlined">
      <mat-card-header><mat-card-title>{{ 'settings.about.title' | translate }}</mat-card-title></mat-card-header>
      <mat-card-content>
        <dl class="qs-dl">
          <dt>{{ 'settings.about.web' | translate }}</dt><dd class="qs-about__value">{{ label(versions.web()) }}</dd>
          <dt>{{ 'settings.about.api' | translate }}</dt><dd class="qs-about__value">{{ label(versions.api()) }}</dd>
        </dl>
        <a matButton="outlined" href="https://github.com/13/qseng/releases" target="_blank" rel="noopener">
          <mat-icon>open_in_new</mat-icon>{{ 'settings.about.releases' | translate }}
        </a>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    :host { display: block; }
    .qs-dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; margin: 0 0 12px; }
    .qs-dl dt { color: var(--mat-sys-on-surface-variant); }
    .qs-dl dd { margin: 0; }
    .qs-about__value { font-family: var(--mat-sys-body-medium-font, monospace); font-variant-numeric: tabular-nums; }
  `]
})
export class AboutCardComponent {
  readonly versions = inject(VersionService);

  constructor() { this.versions.load(); }

  label(info: BuildInfo | null): string {
    return info ? `${info.version} (${info.commit.slice(0, 7)})` : '—';
  }
}
```
`settings.component.ts`: import `AboutCardComponent`, add to `imports`, and place `<qs-about-card />` after `<qs-trash-card id="trash" #trashCard tabindex="-1" />`.

i18n (`en.json` / `de.json`, keep sorted): `settings.about.api` "API" / "API"; `settings.about.releases` "Release notes on GitHub" / "Versionshinweise auf GitHub"; `settings.about.title` "About" / "Über Qseng"; `settings.about.web` "Web app" / "Web-App". Run `npm --prefix /home/ben/repo/qseng/frontend run gen:i18n`.

- [ ] **Step 7: Run** — `npm --prefix /home/ben/repo/qseng/frontend run gates`, `npx --prefix … ng lint`, `timeout 600 npm --prefix /home/ben/repo/qseng/frontend test -- --watch=false` (all green, coverage thresholds still met; kill stale workers first with `ps -eo pid,args | grep "suppress-warn[i]ng" | awk '{print $1}' | xargs -r kill -9`), `timeout 300 npx --prefix … ng build` (initial total < 800 kB).

- [ ] **Step 8: e2e** — in `settings.spec.ts` add inside `test.describe('settings')`:
```ts
  test('about card shows the web and API versions', async ({ demo }) => {
    const page = demo;
    await page.goto('/settings');
    const card = page.locator('qs-about-card');
    await expect(card).toBeVisible();
    // ng serve serves public/version.json's dev defaults; the API reports its csproj version.
    await expect(card.locator('.qs-about__value').nth(0)).toHaveText(/^0\.0\.0-dev \(unknown\)$/);
    await expect(card.locator('.qs-about__value').nth(1)).toHaveText(/^\d+\.\d+\.\d+\S* \(\S+\)$/);
    await expect(card.getByRole('link', { name: /Release notes|Versionshinweise/ })).toHaveAttribute('href', 'https://github.com/13/qseng/releases');
  });
```
Run `timeout 600 npm --prefix /home/ben/repo/qseng/frontend run e2e -- specs/settings.spec.ts` (ports 4200/5000 free first) → all settings tests pass; `npm run e2e:lint` clean.

- [ ] **Step 9: Commit** — `git add` the files listed above (including `frontend/src/app/core/i18n/translation-keys.ts` if `gen:i18n` changed it) → `feat(settings): About card with web and API build versions`.

---

### Task 4: Workflow `images` + `release` jobs, compose image names, README

**Files:**
- Modify: `.github/workflows/ci.yml` (triggers; replace `docker` job)
- Modify: `docker-compose.yml` (`api`, `frontend` services)
- Modify: `README.md` ("Running with Docker" production subsection, new "Releases" section, checks table row)
- Modify: `docs/superpowers/specs/2026-09-15-release-publishing-design.md` (append `## 7. Results` placeholder is NOT allowed — append the section only in Task 5 with real results)

- [ ] **Step 1: Triggers** — top of `ci.yml`:
```yaml
on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
```

- [ ] **Step 2: Replace the `docker` job** with:
```yaml
  # Builds both images on every run; pushes to ghcr.io (edge on main, semver on v* tags) only on
  # push events and only after every check job is green. PR runs never log in or push.
  images:
    needs: [backend, frontend, contract, e2e]
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions: { contents: read, packages: write, id-token: write, attestations: write }
    strategy:
      fail-fast: false
      matrix: { image: [api, web] }
    steps:
      - uses: actions/checkout@v7
      - id: inputs
        shell: bash
        run: |
          owner="${{ github.repository_owner }}"
          echo "image=ghcr.io/${owner,,}/qseng-${{ matrix.image }}" >> "$GITHUB_OUTPUT"
          case "$GITHUB_REF" in
            refs/tags/v*)     echo "version=${GITHUB_REF_NAME#v}" >> "$GITHUB_OUTPUT" ;;
            refs/heads/main)  echo "version=0.0.0-edge" >> "$GITHUB_OUTPUT" ;;
            *)                echo "version=0.0.0-pr" >> "$GITHUB_OUTPUT" ;;
          esac
      - uses: docker/setup-buildx-action@v3
      - if: github.event_name == 'push'
        uses: docker/login-action@v3
        with: { registry: ghcr.io, username: "${{ github.actor }}", password: "${{ secrets.GITHUB_TOKEN }}" }
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ steps.inputs.outputs.image }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=raw,value=latest,enable=${{ startsWith(github.ref, 'refs/tags/v') }}
            type=raw,value=edge,enable={{is_default_branch}}
            type=sha,prefix=sha-,format=short,enable={{is_default_branch}}
          labels: |
            org.opencontainers.image.description=Qseng ${{ matrix.image }}
      - id: build
        uses: docker/build-push-action@v6
        with:
          context: .
          file: docker/Dockerfile.${{ matrix.image }}
          platforms: linux/amd64
          push: ${{ github.event_name == 'push' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          build-args: |
            QSENG_VERSION=${{ steps.inputs.outputs.version }}
            QSENG_COMMIT=${{ github.sha }}
          cache-from: type=gha,scope=${{ matrix.image }}
          cache-to: type=gha,mode=max,scope=${{ matrix.image }}
      - if: github.event_name == 'push'
        uses: anchore/sbom-action@v0
        with:
          image: ${{ steps.inputs.outputs.image }}@${{ steps.build.outputs.digest }}
          format: spdx-json
          output-file: sbom-${{ matrix.image }}.spdx.json
          upload-artifact: false
      - if: github.event_name == 'push'
        uses: actions/attest-build-provenance@v3
        with:
          subject-name: ${{ steps.inputs.outputs.image }}
          subject-digest: ${{ steps.build.outputs.digest }}
          push-to-registry: true
      - if: github.event_name == 'push'
        uses: actions/attest-sbom@v3
        with:
          subject-name: ${{ steps.inputs.outputs.image }}
          subject-digest: ${{ steps.build.outputs.digest }}
          sbom-path: sbom-${{ matrix.image }}.spdx.json
          push-to-registry: true
      - if: startsWith(github.ref, 'refs/tags/v')
        shell: bash
        run: printf '%s@%s\n' "${{ steps.inputs.outputs.image }}" "${{ steps.build.outputs.digest }}" > image-${{ matrix.image }}.txt
      - if: startsWith(github.ref, 'refs/tags/v')
        uses: actions/upload-artifact@v7
        with: { name: "image-${{ matrix.image }}", path: "image-${{ matrix.image }}.txt" }
  release:
    if: startsWith(github.ref, 'refs/tags/v')
    needs: [images]
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions: { contents: write }
    steps:
      - uses: actions/checkout@v7
      - uses: actions/download-artifact@v8
        with: { pattern: "image-*", merge-multiple: true, path: images }
      - shell: bash
        env: { GH_TOKEN: "${{ github.token }}", TAG: "${{ github.ref_name }}", OWNER: "${{ github.repository_owner }}" }
        run: |
          v="${TAG#v}"
          {
            echo "## Images"
            echo
            for f in images/image-*.txt; do echo "- \`$(cat "$f")\`"; done
            echo
            echo "Verify provenance and SBOM:"
            echo
            echo '```'
            echo "gh attestation verify oci://ghcr.io/${OWNER,,}/qseng-api:$v --owner $OWNER"
            echo "gh attestation verify oci://ghcr.io/${OWNER,,}/qseng-web:$v --owner $OWNER"
            echo '```'
          } > notes.md
          if gh release view "$TAG" >/dev/null 2>&1; then
            gh release edit "$TAG" --notes-file notes.md
          else
            gh release create "$TAG" --verify-tag --generate-notes --notes-file notes.md
          fi
```
Validate: `python3 -c "import yaml; yaml.safe_load(open('/home/ben/repo/qseng/.github/workflows/ci.yml'))"`. Check each new action's current major on GitHub (`gh api repos/docker/build-push-action/releases/latest -q .tag_name`, same for `docker/metadata-action`, `docker/login-action`, `docker/setup-buildx-action`, `anchore/sbom-action`, `actions/attest-build-provenance`, `actions/attest-sbom`) and use the latest major if it differs from the plan; note any input renames.

- [ ] **Step 3: compose** — in `docker-compose.yml` add `image:` lines:
```yaml
  api:
    image: ghcr.io/13/qseng-api:${QSENG_VERSION:-latest}
    build:
      …
  frontend:
    image: ghcr.io/13/qseng-web:${QSENG_VERSION:-latest}
    build:
      …
```
`docker compose -f /home/ben/repo/qseng/docker-compose.yml config --quiet` must pass; `docker compose config | grep image:` shows both names with `latest`.

- [ ] **Step 4: README** — replace the "Production (PostgreSQL)" command block with:
```bash
# build locally
docker compose -f docker-compose.yml up --build
# or deploy a published release
QSENG_VERSION=1.2.0 docker compose -f docker-compose.yml up -d --no-build --pull always
```
Add a `## Releases` section before `## Project structure`:
```markdown
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
```
Update the checks table row: `| \`images\` | builds both images (PRs) and pushes them to ghcr.io with attestations (push to main / v* tags); \`release\` creates the GitHub Release on tags |`.

- [ ] **Step 5: Commit** — `git add .github/workflows/ci.yml docker-compose.yml README.md` → `ci: publish images to ghcr.io on main and v* tags with a GitHub Release`.

---

### Task 5: Push, PR, first edge and first tag (controller, each step after the user's go-ahead)

- [ ] **Step 1:** Push `feat/release-publishing`, open the PR (description ends with the required attribution lines), watch CI: `images` builds both images without pushing; all jobs green.
- [ ] **Step 2 (go-ahead):** Merge the PR (merge commit). Watch the `main` run: both images pushed with `edge` and `sha-<7>`; `docker pull ghcr.io/13/qseng-api:edge` works anonymously (if the package is private, flip visibility in package settings and note it in the README); `curl` of the container's `/health/ready` shows `"version":"0.0.0-edge"` and the commit SHA.
- [ ] **Step 3 (go-ahead):** `git tag v0.1.0 <merge sha> && git push origin v0.1.0`. Watch the tag run: `0.1.0`, `0.1`, `latest` pushed; Release `v0.1.0` exists with generated notes and the images footer; `gh attestation verify oci://ghcr.io/13/qseng-api:0.1.0 --owner 13` and the web equivalent pass.
- [ ] **Step 4:** `QSENG_VERSION=0.1.0 docker compose -f docker-compose.yml up -d --no-build --pull always` with a `Jwt__Key` override (env) — Settings → About shows `0.1.0` for both; then `docker compose down`.
- [ ] **Step 5:** Append `## 7. Results` to the spec with run ids, digests, and the visibility outcome; commit and push to `main` via a docs PR or a direct push if the user prefers.
