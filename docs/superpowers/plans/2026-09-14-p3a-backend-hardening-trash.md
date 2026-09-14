# P3a Backend Hardening and Trash View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configured CORS, rate-limited auth endpoints, `/health/live` + `/health/ready`, Serilog request logging; trash list/purge endpoints with a Settings "Trash" card; the three fixes carried from the P2 reviews (atomic avatar swap, media files removed on account deletion, timeline delete scoped by person).

**Architecture:** Options classes bound from configuration with `IValidateOptions` validators (same pattern as `JwtOptions`); ASP.NET's built-in rate limiter with a per-IP fixed-window policy and a ProblemDetails rejection writer; health checks via `Microsoft.Extensions.Diagnostics.HealthChecks` + the EF check; trash handlers in `Qseng.Application/Trash/` reusing `TrashPurger`; a small `ITransactionScope` abstraction on `IQsengDbContext`. Frontend: one new card in `SettingsComponent` backed by the regenerated `TrashApi`.

**Tech Stack:** .NET 10 (`Microsoft.AspNetCore.RateLimiting`, `Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore`, Serilog.AspNetCore), EF Core 9, xunit/NSubstitute/FluentAssertions on real SQLite; Angular 21 / Material 21 / Vitest 4; ng-openapi-gen.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-14-p3-hardening-design.md` §2, §3, §7. Branch `feat/p3-hardening` (from `main` a6e1415).
- Backend contracts: `Result<T>`, ProblemDetails via `ToActionResult()`, `ProducesResponseType` on every action, operationIds `<Controller>_<Action>`; ownership = `tree.OwnerId == _currentUser.UserId`; trash-sensitive lookups use `FirstOrDefaultAsync` (query filters), `IgnoreQueryFilters()` only where trash is the point.
- After any controller/DTO change: `bash backend/export-openapi.sh` → `contracts/openapi.json`; `npm run gen --prefix frontend`; both committed together; `npx ng build` still green.
- Tests run on real SQLite (`TestDb.Create()`), 89 green at the base; `dotnet test /home/ben/repo/qseng/backend/Qseng.slnx` before every commit.
- Frontend contracts (P1/P2): `ToastService.errorFrom`; dialogs own requests; i18n keys in BOTH dictionaries (sorted, identical sets) + `npm run gen:i18n`; `npm run gates`, `ng lint`, `ng build` (budget 800 kB, currently 792 kB — the trash card lives in the lazy settings chunk), suite green before every commit.
- Tooling: `cd` is broken in the sandbox shell — `npm --prefix`, `git -C`, absolute paths; `ng test --watch=false` inside `timeout 300`; stale workers `ps -eo pid,args | grep "suppress-warn[i]ng" | awk '{print $1}' | xargs -r kill -9`; never `pkill -f`; boot checks with `timeout 40 dotnet run …`.
- Commit messages end with the attribution lines from the session's system reminder.

## File structure produced by this plan

```
backend/src/Qseng.Infrastructure/Options/CorsOptions.cs (+ validator)        new
backend/src/Qseng.Infrastructure/Options/RateLimitingOptions.cs             new
backend/src/Qseng.Api/RateLimiting/AuthRateLimitPolicy.cs                   new (policy + rejection writer)
backend/src/Qseng.Api/Health/UploadsWritableCheck.cs, HealthResponseWriter.cs   new
backend/src/Qseng.Api/Program.cs                                            CORS/rate limiter/health/request logging wiring
backend/src/Qseng.Api/Controllers/AuthController.cs                          [EnableRateLimiting("auth")]
backend/src/Qseng.Api/Controllers/TrashController.cs                         new
backend/src/Qseng.Api/Controllers/TimelineController.cs                      personId passed to the delete command
backend/src/Qseng.Application/Trash/{TrashDtos,ListTrash/ListTrashQuery,PurgeTrashItem/PurgeTrashItemCommand}.cs   new
backend/src/Qseng.Application/Trash/TrashPurger.cs                           PurgeBatchAsync
backend/src/Qseng.Application/Abstractions/IQsengDbContext.cs                BeginTransactionAsync + ITransactionScope
backend/src/Qseng.Infrastructure/Persistence/QsengDbContext.cs               implementation
backend/src/Qseng.Application/Media/{SetAvatar,DeleteMedia}/*.cs             one transaction
backend/src/Qseng.Application/Users/UserCommands.cs                          media files removed
backend/src/Qseng.Application/Timeline/DeleteTimelineEvent/*.cs              PersonId scoping
backend/tests/Qseng.Api.Tests/{CorsOptionsValidatorTests,AuthRateLimitRejectionTests,UploadsWritableCheckTests}.cs   new
backend/tests/Qseng.Application.Tests/Trash/{TrashListPurgeTests,TransactionScopeTests}.cs, Users/DeleteOwnDataFilesTests.cs   new
docker/Dockerfile.api, docker-compose.yml                                    health path, CORS origin
contracts/openapi.json                                                       Trash_List, Trash_Purge
frontend/src/app/features/settings/{settings.component.ts, trash-card.component.ts (+ spec)}   Trash card
frontend/src/app/features/palette/palette-actions.ts (+ spec)               "Trash" action
frontend/public/assets/i18n/{en,de}.json                                     trash.* keys
```

---

### Task 1: CORS from configuration

**Files:**
- Create: `backend/src/Qseng.Infrastructure/Options/CorsOptions.cs`
- Modify: `backend/src/Qseng.Api/Program.cs` (lines ~126-130 and the options block ~66-72), `docker-compose.yml` (api env), `backend/src/Qseng.Api/appsettings.Development.json`
- Test: `backend/tests/Qseng.Api.Tests/CorsOptionsValidatorTests.cs`

- [ ] **Step 1: Failing test**
```csharp
using FluentAssertions;
using Qseng.Infrastructure.Options;
using Xunit;

namespace Qseng.Api.Tests;

public class CorsOptionsValidatorTests
{
    [Fact]
    public void Production_rejects_an_empty_origin_list()
    {
        var result = new CorsOptionsValidator(isDevelopment: false).Validate(null, new CorsOptions());
        result.Failed.Should().BeTrue();
        result.FailureMessage.Should().Contain("Cors:AllowedOrigins");
    }

    [Fact]
    public void Development_defaults_to_the_angular_dev_server()
    {
        var o = new CorsOptions();
        new CorsOptionsValidator(isDevelopment: true).Validate(null, o).Succeeded.Should().BeTrue();
        o.EffectiveOrigins(isDevelopment: true).Should().Equal("http://localhost:4200");
    }

    [Fact]
    public void Origins_must_be_absolute_urls_without_a_path()
    {
        var o = new CorsOptions { AllowedOrigins = ["https://app.example.org", "not a url", "https://x.org/app"] };
        var result = new CorsOptionsValidator(isDevelopment: false).Validate(null, o);
        result.Failed.Should().BeTrue();
        result.FailureMessage.Should().Contain("not a url").And.Contain("https://x.org/app");
    }
}
```

- [ ] **Step 2: Options + validator**
```csharp
using Microsoft.Extensions.Options;

namespace Qseng.Infrastructure.Options;

public class CorsOptions
{
    public const string SectionName = "Cors";
    public string[] AllowedOrigins { get; set; } = [];

    /// <summary>Configured origins, or the Angular dev server when running in Development with none configured.</summary>
    public string[] EffectiveOrigins(bool isDevelopment) =>
        AllowedOrigins.Length == 0 && isDevelopment ? ["http://localhost:4200"] : AllowedOrigins;
}

public sealed class CorsOptionsValidator : IValidateOptions<CorsOptions>
{
    private readonly bool _isDevelopment;
    public CorsOptionsValidator(bool isDevelopment) => _isDevelopment = isDevelopment;

    public ValidateOptionsResult Validate(string? name, CorsOptions o)
    {
        var errors = new List<string>();
        if (o.AllowedOrigins.Length == 0 && !_isDevelopment)
            errors.Add("Cors:AllowedOrigins must list at least one origin outside Development.");
        foreach (var origin in o.AllowedOrigins)
        {
            if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri) || (uri.Scheme != "http" && uri.Scheme != "https") || uri.AbsolutePath != "/" || !string.IsNullOrEmpty(uri.Query))
                errors.Add($"Cors:AllowedOrigins entry '{origin}' must be an absolute http(s) origin without a path.");
        }
        return errors.Count == 0 ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(errors);
    }
}
```
`Program.cs`: next to the Jwt options block add
```csharp
builder.Services.AddOptions<CorsOptions>().Bind(builder.Configuration.GetSection(CorsOptions.SectionName)).ValidateOnStart();
builder.Services.AddSingleton<IValidateOptions<CorsOptions>>(new CorsOptionsValidator(builder.Environment.IsDevelopment()));
var corsOrigins = (builder.Configuration.GetSection(CorsOptions.SectionName).Get<CorsOptions>() ?? new CorsOptions()).EffectiveOrigins(builder.Environment.IsDevelopment());
```
and replace the `AddCors` call with `builder.Services.AddCors(opt => opt.AddDefaultPolicy(p => p.WithOrigins(corsOrigins).AllowAnyHeader().AllowAnyMethod()));`. `docker-compose.yml` api env: `Cors__AllowedOrigins__0: "http://localhost:8081"`. `appsettings.Development.json`: `"Cors": { "AllowedOrigins": ["http://localhost:4200"] }` (explicit, documents the default).

- [ ] **Step 3: Tests, boot, commit**
```bash
dotnet test /home/ben/repo/qseng/backend/Qseng.slnx
ASPNETCORE_ENVIRONMENT=Production Jwt__Key=0123456789abcdef0123456789abcdef Jwt__Issuer=x Jwt__Audience=x timeout 30 dotnet run --project /home/ben/repo/qseng/backend/src/Qseng.Api --no-launch-profile --urls http://localhost:5001 2>&1 | grep -E "Cors:AllowedOrigins|Now listening" | head -2
```
Expected: the Production boot without CORS fails fast with the validator message (exit non-zero, message printed); Development boot (`ASPNETCORE_ENVIRONMENT=Development timeout 30 dotnet run …`) listens. Commit: `feat(api): CORS origins from configuration, validated at startup`.

---

### Task 2: Rate limiting on auth

**Files:**
- Create: `backend/src/Qseng.Infrastructure/Options/RateLimitingOptions.cs`, `backend/src/Qseng.Api/RateLimiting/AuthRateLimitPolicy.cs`
- Modify: `Program.cs`, `Controllers/AuthController.cs`, `appsettings.json` (`"RateLimiting": { "Auth": { "PermitLimit": 10, "WindowSeconds": 60 } }`)
- Test: `backend/tests/Qseng.Api.Tests/AuthRateLimitRejectionTests.cs`

- [ ] **Step 1: Failing test**
```csharp
public class AuthRateLimitRejectionTests
{
    [Fact]
    public async Task Rejection_writes_problem_details_with_retry_after()
    {
        var ctx = new DefaultHttpContext();
        ctx.Response.Body = new MemoryStream();
        await AuthRateLimitPolicy.WriteRejectionAsync(ctx, TimeSpan.FromSeconds(42), CancellationToken.None);
        ctx.Response.StatusCode.Should().Be(429);
        ctx.Response.Headers.RetryAfter.ToString().Should().Be("42");
        ctx.Response.ContentType.Should().StartWith("application/problem+json");
        ctx.Response.Body.Position = 0;
        var body = JsonDocument.Parse(await new StreamReader(ctx.Response.Body).ReadToEndAsync()).RootElement;
        body.GetProperty("status").GetInt32().Should().Be(429);
        body.GetProperty("title").GetString().Should().Be("Too Many Requests");
        body.GetProperty("detail").GetString().Should().Contain("42");
    }
}
```

- [ ] **Step 2: Options + policy**
```csharp
// RateLimitingOptions.cs
namespace Qseng.Infrastructure.Options;
public class RateLimitingOptions
{
    public const string SectionName = "RateLimiting";
    public AuthLimit Auth { get; set; } = new();
    public class AuthLimit { public int PermitLimit { get; set; } = 10; public int WindowSeconds { get; set; } = 60; }
}
```
```csharp
// AuthRateLimitPolicy.cs
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Qseng.Infrastructure.Options;

namespace Qseng.Api.RateLimiting;

public static class AuthRateLimitPolicy
{
    public const string Name = "auth";

    public static void Configure(RateLimiterOptions o, RateLimitingOptions.AuthLimit limit)
    {
        o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
        o.AddPolicy(Name, ctx => RateLimitPartition.GetFixedWindowLimiter(
            ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = limit.PermitLimit, Window = TimeSpan.FromSeconds(limit.WindowSeconds), QueueLimit = 0 }));
        o.OnRejected = (ctx, ct) =>
        {
            var retry = ctx.Lease.TryGetMetadata(MetadataName.RetryAfter, out var after) ? after : TimeSpan.FromSeconds(limit.WindowSeconds);
            return new ValueTask(WriteRejectionAsync(ctx.HttpContext, retry, ct));
        };
    }

    public static async Task WriteRejectionAsync(HttpContext http, TimeSpan retryAfter, CancellationToken ct)
    {
        var seconds = Math.Max(1, (int)Math.Ceiling(retryAfter.TotalSeconds));
        http.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        http.Response.Headers.RetryAfter = seconds.ToString();
        var problem = new ProblemDetails { Status = 429, Title = "Too Many Requests", Detail = $"Try again in {seconds} seconds." };
        await http.Response.WriteAsJsonAsync(problem, problem.GetType(), options: null, contentType: "application/problem+json", cancellationToken: ct);
    }
}
```
`Program.cs`: bind `RateLimitingOptions` (`AddOptions<…>().Bind(…)`), read it once (`Get<RateLimitingOptions>() ?? new()`), `builder.Services.AddRateLimiter(o => AuthRateLimitPolicy.Configure(o, rl.Auth));`, and after `app.UseCors();` add `app.UseRateLimiter();` (must come after `UseRouting` — with minimal hosting, routing is implicit before `UseAuthentication`; place `UseRateLimiter` right before `UseAuthentication`). `AuthController`: `[EnableRateLimiting(AuthRateLimitPolicy.Name)]` on `Register`, `Login`, `Refresh` (not `Logout`). Note: the middleware pipeline currently has `ExceptionMiddleware` first — rate-limit rejections happen before controllers, so nothing else changes.

- [ ] **Step 3: Tests, live check, commit**
Run the suite; boot in Development with `RateLimiting__Auth__PermitLimit=2` and hit login three times: `for i in 1 2 3; do curl -s -o /dev/null -w "%{http_code} " -X POST http://localhost:5000/api/v1/auth/login -H 'Content-Type: application/json' -d '{"username":"x","password":"y"}'; done` → `401 401 429`. Commit: `feat(api): per-IP fixed-window rate limit on login, register and refresh`.

---

### Task 3: Health checks and request logging

**Files:**
- Create: `backend/src/Qseng.Api/Health/UploadsWritableCheck.cs`, `HealthResponseWriter.cs`
- Modify: `Program.cs`, `backend/src/Qseng.Api/Qseng.Api.csproj` (`Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore` 9.0.4 — match the EF version in the solution), `docker/Dockerfile.api` (HEALTHCHECK → `/health/ready`), `docker-compose.yml` (api healthcheck if defined there)
- Test: `backend/tests/Qseng.Api.Tests/UploadsWritableCheckTests.cs`

- [ ] **Step 1: Failing test**
```csharp
public class UploadsWritableCheckTests
{
    [Fact]
    public async Task Writable_directory_is_healthy_and_leaves_no_probe_behind()
    {
        var dir = Directory.CreateTempSubdirectory().FullName;
        var result = await new UploadsWritableCheck(dir).CheckHealthAsync(new HealthCheckContext(), CancellationToken.None);
        result.Status.Should().Be(HealthStatus.Healthy);
        Directory.EnumerateFiles(dir).Should().BeEmpty();
    }

    [Fact]
    public async Task Missing_or_unwritable_directory_is_unhealthy()
    {
        var result = await new UploadsWritableCheck("/proc/qseng-does-not-exist").CheckHealthAsync(new HealthCheckContext(), CancellationToken.None);
        result.Status.Should().Be(HealthStatus.Unhealthy);
    }
}
```

- [ ] **Step 2: Implementation**
```csharp
public sealed class UploadsWritableCheck : IHealthCheck
{
    private readonly string _path;
    public UploadsWritableCheck(string path) => _path = path;
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct = default)
    {
        try
        {
            Directory.CreateDirectory(_path);
            var probe = Path.Combine(_path, $".probe-{Guid.NewGuid():N}");
            await File.WriteAllTextAsync(probe, "ok", ct);
            File.Delete(probe);
            return HealthCheckResult.Healthy();
        }
        catch (Exception ex) { return HealthCheckResult.Unhealthy($"Uploads path '{_path}' is not writable.", ex); }
    }
}
```
`HealthResponseWriter.WriteAsync(HttpContext, HealthReport)` → JSON `{ status, checks: [{ name, status, duration }] }` with `application/json`. `Program.cs`: `builder.Services.AddHealthChecks().AddDbContextCheck<QsengDbContext>("database").AddCheck("uploads", new UploadsWritableCheck(builder.Configuration["Uploads:Path"] ?? "uploads"));` (read the same key `LocalFileStorage` uses — check it); `app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false, ResponseWriter = HealthResponseWriter.WriteAsync }).AllowAnonymous(); app.MapHealthChecks("/health/ready", new HealthCheckOptions { ResponseWriter = HealthResponseWriter.WriteAsync }).AllowAnonymous();`. Request logging: `app.UseSerilogRequestLogging(o => { o.EnrichDiagnosticContext = (d, http) => d.Set("UserId", http.User.FindFirstValue(ClaimTypes.NameIdentifier)); o.GetLevel = (http, _, ex) => ex is not null || http.Response.StatusCode >= 500 ? LogEventLevel.Error : http.Request.Path.StartsWithSegments("/health") ? LogEventLevel.Verbose : LogEventLevel.Information; });` placed after `UseAuthorization()`. Dockerfile HEALTHCHECK: `curl -fsS http://localhost:8080/health/ready || exit 1` (keep the existing tool the Dockerfile uses — check whether it uses curl or wget).

- [ ] **Step 3: Verify, contract unchanged, commit**
Suite; boot; `curl -s localhost:5000/health/ready` → `{"status":"Healthy","checks":[…database…,…uploads…]}`; `curl -s -o /dev/null -w "%{http_code}" localhost:5000/health/live` → 200; `bash backend/export-openapi.sh && git -C /home/ben/repo/qseng status --short contracts/` → unchanged (health endpoints are minimal endpoints, excluded). Commit: `feat(api): liveness/readiness health endpoints and request logging`.

---

### Task 4: Trash list/purge endpoints and scoped timeline delete

**Files:**
- Create: `backend/src/Qseng.Application/Trash/TrashDtos.cs`, `Trash/ListTrash/ListTrashQuery.cs`, `Trash/PurgeTrashItem/PurgeTrashItemCommand.cs`, `backend/src/Qseng.Api/Controllers/TrashController.cs`
- Modify: `Trash/TrashPurger.cs` (`PurgeBatchAsync`), `Timeline/DeleteTimelineEvent/DeleteTimelineEventCommand.cs` (+ `PersonId`), `Controllers/TimelineController.cs`, tests that construct `DeleteTimelineEventCommand`
- Test: `backend/tests/Qseng.Application.Tests/Trash/TrashListPurgeTests.cs`
- Regenerate: `contracts/openapi.json`, frontend client

- [ ] **Step 1: Failing tests** (use `TrashFixtures.SeedFamilyAsync` / `FakeUser`; `TestDb.AddOwner` for a second user)
```csharp
public class TrashListPurgeTests
{
    [Fact]
    public async Task List_returns_only_the_callers_trashed_persons_newest_first_with_purge_date()
    {
        var (db, owner, a, b, _, _, _) = await TrashFixtures.SeedFamilyAsync();
        var user = TrashFixtures.FakeUser(owner);
        var storage = Substitute.For<IFileStorage>();
        await new DeletePersonHandler(db, user, storage).Handle(new DeletePersonCommand(a.Id), CancellationToken.None);
        await Task.Delay(5);
        await new DeletePersonHandler(db, user, storage).Handle(new DeletePersonCommand(b.Id), CancellationToken.None);
        // another owner's trashed person must not show
        var other = TestDb.AddOwner(db); var otherTree = new Tree { OwnerId = other, Name = "O" }; db.Trees.Add(otherTree);
        db.Persons.Add(new Person { TreeId = otherTree.Id, FirstName = "X", LastName = "Y", DeletedAt = DateTime.UtcNow, DeletionBatchId = Guid.NewGuid() });
        await db.SaveChangesAsync();

        var result = await new ListTrashHandler(db, user, Options.Create(new TrashOptions { RetentionDays = 30 })).Handle(new ListTrashQuery(), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.RetentionDays.Should().Be(30);
        result.Value.Items.Select(i => i.Id).Should().Equal(b.Id, a.Id);
        result.Value.Items[0].TreeName.Should().Be("T");
        result.Value.Items[0].PurgeAt.Should().BeCloseTo(result.Value.Items[0].DeletedAt.AddDays(30), TimeSpan.FromSeconds(1));
    }

    [Fact]
    public async Task Purge_removes_exactly_the_batch_and_its_files()
    {
        var (db, owner, a, b, rel, ev, media) = await TrashFixtures.SeedFamilyAsync();
        var user = TrashFixtures.FakeUser(owner);
        await new DeletePersonHandler(db, user, Substitute.For<IFileStorage>()).Handle(new DeletePersonCommand(a.Id), CancellationToken.None);
        var storage = Substitute.For<IFileStorage>();
        var result = await new PurgeTrashItemHandler(db, user, new TrashPurger(db, storage, NullLogger<TrashPurger>.Instance)).Handle(new PurgeTrashItemCommand(a.Id), CancellationToken.None);
        result.IsSuccess.Should().BeTrue();
        await storage.Received(1).DeleteAsync("/u/a.jpg", Arg.Any<CancellationToken>());
        (await db.Persons.IgnoreQueryFilters().CountAsync()).Should().Be(1);
        (await db.Relationships.IgnoreQueryFilters().CountAsync()).Should().Be(0);
        (await db.Persons.CountAsync(p => p.Id == b.Id)).Should().Be(1);
    }

    [Fact]
    public async Task Purge_of_a_live_person_is_404_and_of_someone_elses_is_403()
    {
        var (db, owner, a, _, _, _, _) = await TrashFixtures.SeedFamilyAsync();
        var purger = new TrashPurger(db, Substitute.For<IFileStorage>(), NullLogger<TrashPurger>.Instance);
        (await new PurgeTrashItemHandler(db, TrashFixtures.FakeUser(owner), purger).Handle(new PurgeTrashItemCommand(a.Id), CancellationToken.None)).StatusCode.Should().Be(404);
        await new DeletePersonHandler(db, TrashFixtures.FakeUser(owner), Substitute.For<IFileStorage>()).Handle(new DeletePersonCommand(a.Id), CancellationToken.None);
        (await new PurgeTrashItemHandler(db, TrashFixtures.FakeUser(Guid.NewGuid()), purger).Handle(new PurgeTrashItemCommand(a.Id), CancellationToken.None)).StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task Timeline_delete_is_scoped_to_the_person()
    {
        var (db, owner, a, b, _, ev, _) = await TrashFixtures.SeedFamilyAsync();
        var h = new DeleteTimelineEventHandler(db, TrashFixtures.FakeUser(owner));
        (await h.Handle(new DeleteTimelineEventCommand(b.Id, ev.Id), CancellationToken.None)).StatusCode.Should().Be(404);
        (await h.Handle(new DeleteTimelineEventCommand(a.Id, ev.Id), CancellationToken.None)).IsSuccess.Should().BeTrue();
    }
}
```

- [ ] **Step 2: Implementation**
`TrashDtos.cs`: `public record TrashedPersonDto(Guid Id, string FirstName, string LastName, Guid TreeId, string TreeName, DateTime DeletedAt, DateTime PurgeAt); public record TrashListDto(int RetentionDays, List<TrashedPersonDto> Items);`
`ListTrashQuery : IRequest<Result<TrashListDto>>` — handler injects `IQsengDbContext`, `ICurrentUser`, `IOptions<TrashOptions>`; query: `from p in _db.Persons.IgnoreQueryFilters() join t in _db.Trees on p.TreeId equals t.Id where t.OwnerId == user && p.DeletedAt != null orderby p.DeletedAt descending select new TrashedPersonDto(p.Id, p.FirstName, p.LastName, t.Id, t.Name, p.DeletedAt!.Value, p.DeletedAt.Value.AddDays(days))`.
`PurgeTrashItemCommand(Guid PersonId) : IRequest<Result<bool>>` — handler: `IgnoreQueryFilters` lookup of a trashed person → 404; owner → 403; `await _purger.PurgeBatchAsync(person, ct)`; `Ok(true)`.
`TrashPurger.PurgeBatchAsync(Person person, CancellationToken ct)`: media of the person (ignore filters) → files deleted (logged on failure) → remove media, events (`PersonId == id` or `DeletionBatchId == person.DeletionBatchId`), relationships (`From/To == id`), the person; one `SaveChangesAsync`; returns the row count. Refactor `PurgeAsync` to share the delete-files helper.
`TrashController` (`[Route("api/v1/trash")]`, `[Authorize]` like the other controllers): `GET` → `List` (`ProducesResponseType(typeof(TrashListDto), 200)`), `DELETE {personId:guid}` → `Purge` (200, 403, 404). Register `TrashPurger` in `Qseng.Application`'s DI if handlers need it (it is currently registered in Infrastructure — fine, same container).
`DeleteTimelineEventCommand(Guid PersonId, Guid Id)`; handler 404 when `ev.PersonId != cmd.PersonId`; `TimelineController.Delete` passes `personId`; update the existing timeline tests' constructor calls.

- [ ] **Step 3: Suite, contract, client, commit**
```bash
dotnet test /home/ben/repo/qseng/backend/Qseng.slnx
bash /home/ben/repo/qseng/backend/export-openapi.sh && node -e "const s=require('/home/ben/repo/qseng/contracts/openapi.json');console.log(Object.values(s.paths).flatMap(p=>Object.values(p)).map(o=>o.operationId).filter(x=>/^Trash_/.test(x)).join(', '))"
npm run gen --prefix /home/ben/repo/qseng/frontend && npx --prefix /home/ben/repo/qseng/frontend ng build 2>&1 | grep -E "Initial total|ERROR"
git -C /home/ben/repo/qseng add backend contracts/openapi.json && git -C /home/ben/repo/qseng commit -m "feat(api): trash list and purge endpoints; timeline delete scoped by person"
```
Expected operationIds: `Trash_List, Trash_Purge`.

---

### Task 5: Transaction scope and media files on account deletion

**Files:**
- Modify: `backend/src/Qseng.Application/Abstractions/IQsengDbContext.cs`, `backend/src/Qseng.Infrastructure/Persistence/QsengDbContext.cs`, `Media/SetAvatar/SetAvatarCommand.cs`, `Media/DeleteMedia/DeleteMediaCommand.cs`, `Users/UserCommands.cs`
- Test: `backend/tests/Qseng.Application.Tests/Trash/TransactionScopeTests.cs`, `Users/DeleteOwnDataFilesTests.cs`

- [ ] **Step 1: Failing tests**
```csharp
public class TransactionScopeTests
{
    [Fact]
    public async Task SetAvatar_is_all_or_nothing()
    {
        var (db, owner, a, _, _, _, media) = await TrashFixtures.SeedFamilyAsync();   // media is the avatar
        var other = new Qseng.Domain.Entities.Media { PersonId = a.Id, Url = "/u/b.jpg", Kind = MediaKind.Photo };
        db.Media.Add(other); await db.SaveChangesAsync();
        // simulate a failure between the two saves by cancelling after the first
        using var cts = new CancellationTokenSource();
        var failing = new FailingAfterFirstSaveDb(db, cts);
        var act = () => new SetAvatarHandler(failing, TrashFixtures.FakeUser(owner)).Handle(new SetAvatarCommand(a.Id, other.Id), cts.Token);
        await act.Should().ThrowAsync<OperationCanceledException>();
        (await db.Media.CountAsync(m => m.IsAvatar)).Should().Be(1, "the old avatar is kept when the swap fails");
        (await db.Media.SingleAsync(m => m.IsAvatar)).Id.Should().Be(media.Id);
    }
}
```
`FailingAfterFirstSaveDb` is a small test decorator implementing `IQsengDbContext` that forwards everything to the real context but cancels `cts` after the first `SaveChangesAsync` (so the second save throws) — put it in the test project. Because the handler runs both saves inside `BeginTransactionAsync`, the thrown exception disposes the scope without `CompleteAsync`, and SQLite rolls back the first save.

`DeleteOwnDataFilesTests`: seed a family with media `/u/a.jpg` (live) and a trashed media `/u/old.jpg` on the same tree; run `DeleteOwnDataHandler` with a storage substitute and the right password (use `IPasswordHasher` substitute returning true) → `DeleteAsync` received for both urls; trees gone. Same for `DeleteOwnAccountHandler`.

- [ ] **Step 2: Implementation**
```csharp
// IQsengDbContext additions
public interface ITransactionScope : IAsyncDisposable { Task CompleteAsync(CancellationToken ct = default); }
Task<ITransactionScope> BeginTransactionAsync(CancellationToken ct = default);
```
`QsengDbContext`: `public async Task<ITransactionScope> BeginTransactionAsync(CancellationToken ct = default) => new EfTransactionScope(await Database.BeginTransactionAsync(ct));` with `private sealed class EfTransactionScope(IDbContextTransaction tx) : ITransactionScope { bool done; public async Task CompleteAsync(CancellationToken ct = default) { await tx.CommitAsync(ct); done = true; } public async ValueTask DisposeAsync() { if (!done) await tx.RollbackAsync(); await tx.DisposeAsync(); } }`.
`SetAvatarHandler` / `DeleteMediaHandler`: wrap the two-save section: `await using var scope = await _db.BeginTransactionAsync(ct); …save…; …save…; await scope.CompleteAsync(ct);`.
`DeleteOwnDataHandler` / `DeleteOwnAccountHandler`: inject `IFileStorage` and `ILogger<…>`; before removing trees: `var urls = await (from m in _db.Media.IgnoreQueryFilters() join p in _db.Persons.IgnoreQueryFilters() on m.PersonId equals p.Id join t in _db.Trees on p.TreeId equals t.Id where t.OwnerId == _cu.UserId select m.Url).ToListAsync(ct);` after `SaveChangesAsync`: delete each url in try/catch with a warning log.

- [ ] **Step 3: Suite, commit** — `fix(backend): atomic avatar swap; account and data deletion remove media files`.

---

### Task 6: Settings "Trash" card and palette action

**Files:**
- Create: `frontend/src/app/features/settings/trash-card.component.ts` (+ spec)
- Modify: `frontend/src/app/features/settings/settings.component.ts` (embed the card after the export card, `id="trash"`, fragment scroll), `frontend/src/app/features/palette/palette-actions.ts` (+ spec), `frontend/public/assets/i18n/{en,de}.json`

- [ ] **Step 1: i18n**
```
"trash.title": "Trash" / "Papierkorb"
"trash.hint": "Deleted people stay here for __DAYS__ days, then they are removed for good." / "Gelöschte Personen bleiben __DAYS__ Tage hier und werden dann endgültig entfernt."
"trash.empty": "Trash is empty." / "Der Papierkorb ist leer."
"trash.col.name": "Name" / "Name"
"trash.col.tree": "Tree" / "Stammbaum"
"trash.col.deleted": "Deleted" / "Gelöscht"
"trash.col.purge": "Removed on" / "Entfernt am"
"trash.restore": "Restore" / "Wiederherstellen"
"trash.purge": "Delete now" / "Jetzt löschen"
"trash.purgeConfirm": "Delete __NAME__ for good? This cannot be undone." / "__NAME__ endgültig löschen? Das kann nicht rückgängig gemacht werden."
"trash.restored": "__NAME__ restored." / "__NAME__ wiederhergestellt."
"trash.purged": "__NAME__ removed for good." / "__NAME__ endgültig entfernt."
"palette.action.trash": "Trash" / "Papierkorb"
```

- [ ] **Step 2: Failing spec** (`trash-card.component.spec.ts`; stubs: `TrashApi { trashList: vi.fn(() => of({ retentionDays: 30, items: [...] })), trashPurge: vi.fn(() => of(true)) }`, `PersonsApi { personsRestore: vi.fn(() => of({})) }`, `ConfirmDialogService { confirm: vi.fn(async () => true) }`, `ToastService`, `I18nService` stub):
- renders one row per item with name, tree and formatted dates, and the hint with `__DAYS__` replaced;
- empty list → `trash.empty`;
- Restore → `personsRestore({ id })`, list reloaded, toast `trash.restored`;
- Delete now → confirm called with the name; on `true` → `trashPurge({ personId })`, reload, toast; on `false` → no call.

- [ ] **Step 3: Component**
Standalone `qs-trash-card` (`MatCardModule`, `MatTableModule`, `MatButtonModule`, `MatIconModule`, `TranslatePipe`, `DatePipe`): `items = signal<TrashedPersonDto[]>([])`, `retentionDays = signal(30)`, `loading`, `load()` in the constructor (via `afterNextRender` or directly — it is a plain HTTP call, direct is fine), `restore(item)`, `purge(item)` (confirm → API → reload → toast), errors through `errorFrom(e, i18n.t('err.load'|'err.delete'))`. Table columns `name, tree, deleted, purge, actions`; row action buttons carry `aria-label`s with the name. `SettingsComponent`: `<qs-trash-card id="trash" />` after the export card; in the constructor `inject(ActivatedRoute).fragment.pipe(takeUntilDestroyed()).subscribe(f => { if (f === 'trash') afterNextRender(() => document.getElementById('trash')?.scrollIntoView({ block: 'start' }), { injector }); })` — or simpler: `afterNextRender` once on init when the fragment is `trash`.
`palette-actions.ts`: action `trash` (`icon: 'delete_sweep'`, `run: () => router.navigate(['/settings'], { fragment: 'trash' })`, always available); spec case added; insert after `settings`.

- [ ] **Step 4: Gates, suite, lint, build, commit**
```bash
npm run gen:i18n --prefix /home/ben/repo/qseng/frontend && npm run gates --prefix /home/ben/repo/qseng/frontend
timeout 300 npx --prefix /home/ben/repo/qseng/frontend ng test --watch=false
npx --prefix /home/ben/repo/qseng/frontend ng lint && npx --prefix /home/ben/repo/qseng/frontend ng build 2>&1 | grep -E "Initial total|WARNING|ERROR"
git -C /home/ben/repo/qseng add frontend/src frontend/public/assets/i18n && git -C /home/ben/repo/qseng commit -m "feat(settings): trash card with restore and purge; palette action"
```

---

### Task 7: Browser verification (controller-run)

- [ ] Start API + dev server; log in as demo; delete a person from the tree view (let the undo toast expire); Settings → Trash lists it with the purge date; Restore → toast, row gone, person back in the tree; delete again → "Delete now" → confirm → row gone; `GET /api/v1/trash` empty; the person's media files gone from `uploads/` (upload one first).
- [ ] `curl` checks: `/health/live`, `/health/ready` JSON; three failed logins with `RateLimiting__Auth__PermitLimit=2` → 429 ProblemDetails with `Retry-After`; CORS preflight from `http://evil.example` gets no `Access-Control-Allow-Origin`, from `http://localhost:4200` it does.
- [ ] Palette "Trash" action lands on `/settings#trash` scrolled to the card. axe on the settings page with the card (light/dark, 1400/400). Zero console errors.
- [ ] Ledger, fix wave if needed, whole-plan review (opus), screenshots to `docs/superpowers/specs/assets/p3/`.

## Next plan

P3b: Playwright e2e suite, coverage thresholds, GitHub Actions workflow, README (`2026-09-14-p3b-e2e-coverage-ci.md`).
