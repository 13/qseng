# Release publishing: Docker images on ghcr.io + GitHub Releases

**Date:** 2026-09-15 · **Status:** approved by the user (§1–§4) · **Branch:** `feat/release-publishing`

## 0. Decisions (user)

| Topic | Decision |
|---|---|
| Trigger | Tag push `v*` publishes versioned images + a GitHub Release; every push to `main` publishes `edge`. Tags are created manually with git. |
| Platforms | `linux/amd64` only. |
| Gating | Images are pushed only after backend, frontend, contract and e2e jobs are green for that commit. |
| Shape | Extend `ci.yml` (one workflow). No reusable-workflow indirection. |
| Deployment | `docker-compose.yml` pulls `ghcr.io/13/qseng-{api,web}:${QSENG_VERSION:-latest}`; dev still builds locally. |
| Release notes | GitHub auto-generated notes (`--generate-notes`). |
| Version in app | Stamped into both images; shown on `/health/*`, `version.json`, and a Settings "About" card. |
| Supply chain | Build-provenance and SBOM attestations per image. |

## 1. Workflow (`.github/workflows/ci.yml`)

**Triggers.** `pull_request`; `push` on `main`; `push` on tags `v*`. Concurrency stays `ci-${{ github.ref }}` with `cancel-in-progress: true`; a tag ref never shares a group with `main`, so a tag push never cancels a main run. Top-level `permissions: { contents: read }` stays; jobs that need more declare it themselves.

**Existing jobs** (`backend`, `frontend`, `contract`, `e2e`) are unchanged.

**Job `images`** replaces `docker`. `needs: [backend, frontend, contract, e2e]`. `strategy.matrix.image: [api, web]`, `fail-fast: false`. `permissions: { contents: read, packages: write, id-token: write, attestations: write }`. `timeout-minutes: 20`. Steps:

1. `actions/checkout@v7`.
2. `docker/setup-buildx-action@v3`.
3. `docker/login-action@v3` to `ghcr.io` with `${{ github.actor }}` / `${{ secrets.GITHUB_TOKEN }}` — `if: github.event_name == 'push'`.
4. Compute version inputs in a small `run` step exporting to `$GITHUB_OUTPUT`:
   - `version`: on a tag, the tag without the leading `v` (`v1.2.0` → `1.2.0`); on `main`, `0.0.0-edge+<sha7>`; on PRs, `0.0.0-pr+<sha7>`.
   - `commit`: `${{ github.sha }}`.
5. `docker/metadata-action@v5` with `images: ghcr.io/${{ steps.owner.outputs.lc }}/qseng-${{ matrix.image }}` (owner lowercased in a prior step from `github.repository_owner`) and tags:
   - `type=semver,pattern={{version}}` → `1.2.0`
   - `type=semver,pattern={{major}}.{{minor}}` → `1.2`
   - `type=raw,value=latest,enable=${{ startsWith(github.ref, 'refs/tags/v') }}`
   - `type=raw,value=edge,enable={{is_default_branch}}`
   - `type=sha,prefix=sha-,format=short,enable={{is_default_branch}}`
   Labels come from metadata-action's defaults (`org.opencontainers.image.source/revision/version/created/…`), plus `org.opencontainers.image.description` per image.
6. `docker/build-push-action@v6`: `context: .`, `file: docker/Dockerfile.${{ matrix.image }}`, `platforms: linux/amd64`, `push: ${{ github.event_name == 'push' }}`, `load: ${{ github.event_name != 'push' }}` (PRs still build to validate the Dockerfile), `tags`/`labels` from step 5, `build-args: QSENG_VERSION=…, QSENG_COMMIT=…`, `cache-from: type=gha,scope=${{ matrix.image }}`, `cache-to: type=gha,mode=max,scope=${{ matrix.image }}`. Output `digest`.
7. On push only: `anchore/sbom-action@v0` on the pushed image ref (`image: ghcr.io/…@<digest>`, `format: spdx-json`, `output-file: sbom-${{ matrix.image }}.spdx.json`), then `actions/attest-build-provenance@v3` and `actions/attest-sbom@v3` with `subject-name: ghcr.io/<owner>/qseng-<image>`, `subject-digest: <digest>`, `push-to-registry: true`.
8. Write `digest` and the primary tag to `$GITHUB_OUTPUT` so the release job can list them (`outputs` are collected via a tiny artifact `image-<name>.txt`, since matrix job outputs cannot be keyed by matrix value).

**Job `release`.** `if: startsWith(github.ref, 'refs/tags/v')`, `needs: [images]`, `permissions: { contents: write }`, `timeout-minutes: 5`. Steps: checkout; download the two `image-*.txt` artifacts; build a notes footer (image refs with digests + the attestation verify commands); `gh release create "$GITHUB_REF_NAME" --verify-tag --generate-notes --notes-file footer.md` (`--generate-notes` and `--notes-file` combine: generated notes first, file appended). If a Release for the tag already exists (re-run), `gh release edit` the notes instead of failing.

**PR behaviour.** Nothing is pushed; `images` still builds both images (validates Dockerfiles and build args). Fork PRs get no registry login and no `id-token`, which is fine because they never push.

## 2. Images and version stamping

Both Dockerfiles declare `ARG QSENG_VERSION=0.0.0-dev` and `ARG QSENG_COMMIT=unknown` in the build stage; local `docker compose build` keeps these defaults.

**`docker/Dockerfile.api`.** `dotnet publish … -p:Version=$QSENG_VERSION -p:InformationalVersion=$QSENG_VERSION+$QSENG_COMMIT` (MSBuild `Version` must be a valid NuGet version; the pre-release form `0.0.0-edge` is valid, and the `+commit` metadata only goes into `InformationalVersion`). The runtime stage gets `LABEL org.opencontainers.image.source=https://github.com/13/qseng` as a static fallback (metadata-action overrides labels at build time). `AppVersion` (new static class in `Qseng.Api`): reads `AssemblyInformationalVersionAttribute` once, splits on `+` into `Version` and `Commit` (`unknown` when absent). `HealthResponseWriter` adds `version` and `commit` to the JSON on both `/health/live` and `/health/ready`. These endpoints are anonymous by design; the version string is not a secret in a public repo.

**`docker/Dockerfile.web`.** After `ng build`, the build stage writes `version.json` into the bundle directory: `{"version":"<QSENG_VERSION>","commit":"<QSENG_COMMIT>","builtAt":"<ISO-8601 UTC>"}` (via a `RUN printf`). The runtime stage serves it as a static file (`/version.json`) with `Cache-Control: no-cache` (nginx `location = /version.json`). nginx gains `location /health/ { proxy_pass http://api:8080; }` (same headers as `/api/`), so the browser can read the API's version through the web container. Dev (`ng serve`): `frontend/public/version.json` holds the dev defaults so the dev server serves the same path; it is committed (values `0.0.0-dev`/`unknown`), and the Dockerfile overwrites it.

## 3. Settings "About" card (frontend)

- `VersionService` (`core/version/version.service.ts`): `web = resource(...)`-style signals via `HttpClient`: `GET /version.json` and `GET /health/ready` (typed `{ status, version, commit }`), each fetched once, cached, failures degrade to `null` (card shows `—`). Uses the existing `apiBase` handling so `/health/ready` reaches the API in dev (proxy config: add `/health` to `proxy.conf.json` next to `/api`).
- `AboutCardComponent` (`features/settings/about-card.component.ts`): last card in Settings; rows "Web", "API" with `version` and short commit (7 chars, monospace), and a link to `https://github.com/13/qseng/releases`. i18n keys `settings.about.title`, `settings.about.web`, `settings.about.api`, `settings.about.version`, `settings.about.commit`, `settings.about.releases` in `en`/`de` (sorted, identical sets; `npm run gen:i18n`).
- Tests: unit tests for `VersionService` (both fetches, failure → null) and `AboutCardComponent` (renders both rows, link href); e2e `settings.spec.ts` asserts the About card shows `0.0.0-dev` for web and a non-empty API version, and runs `axeCheck` on the page (already done for the settings page; the card is part of it). Gates: no emoji, no raw api-client imports.

## 4. Deployment and docs

- `docker-compose.yml`: `api` and `web` gain `image: ghcr.io/13/qseng-api:${QSENG_VERSION:-latest}` / `ghcr.io/13/qseng-web:${QSENG_VERSION:-latest}` next to their existing `build:` stanzas. `docker compose build` tags local builds with that name; `docker compose up -d --no-build --pull always` deploys a published version. Dev override unchanged.
- README: new "Releases" section — cut a release (`git tag v1.2.0 && git push origin v1.2.0`), what CI publishes (tags, `edge`, attestations), deploy a version (`QSENG_VERSION=1.2.0 docker compose -f docker-compose.yml up -d --no-build --pull always`), verify (`gh attestation verify oci://ghcr.io/13/qseng-api:1.2.0 --owner 13`), and the note that the About card and `/health/ready` show the running version. "Running the checks" table row for the `images` job updated.
- Package visibility: ghcr packages created by the workflow are linked to the repository through the `org.opencontainers.image.source` label; on first publish the packages inherit the repository's public visibility. If GitHub leaves them private, the README tells the operator where to flip visibility (Package settings). This is verified in the first real release, see §5.

## 5. Verification

1. PR run of the branch: `images` builds both images without pushing (job log shows `push: false`), all other jobs green.
2. After merge, the `main` run publishes `edge` and `sha-<7>` for both images; `docker pull ghcr.io/13/qseng-api:edge` works anonymously; `docker run … /health/ready` returns `"version":"0.0.0-edge+<sha7>"`.
3. Tag `v0.1.0` on main: run publishes `0.1.0`, `0.1`, `latest`; a Release `v0.1.0` exists with generated notes + digests; `gh attestation verify oci://ghcr.io/13/qseng-api:0.1.0 --owner 13` passes for both images.
4. `QSENG_VERSION=0.1.0 docker compose -f docker-compose.yml up -d --no-build --pull always` (with a `Jwt__Key` override) starts; Settings → About shows `0.1.0` for both.
5. Local: `docker compose build` still works with the defaults; backend/unit/e2e suites green; bundle stays under 800 kB.

The controller performs steps 2–4 after the user's go-ahead on the merge and the first tag (pushing tags publishes packages).

## 6. Non-goals

Multi-arch images; Helm/Kubernetes manifests; automatic version bumping or changelog files; signing with cosign (attestations cover provenance); publishing on PRs; Docker Hub.
