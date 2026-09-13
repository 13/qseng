# P1a Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the foundation for the Material 21 rewrite: ProblemDetails error contract and exported OpenAPI spec on the backend; Material + warm-heritage theme, generated API client, JSON i18n with typed keys, cross-cutting UI services, and the new app shell on the frontend. Old feature screens keep compiling and running until later plans replace them.

**Architecture:** Backend gains a uniform RFC 7807 error contract (`ProblemDetails` / `ValidationProblemDetails`) and explicit response types so `contracts/openapi.json` is complete; a script boots the API and dumps the spec. Frontend adds a `src/styles/` layer (M3 theme via `mat.theme()`, fonts, tokens), `ng-openapi-gen` output under `core/api/generated/`, JSON dictionaries under `public/assets/i18n/` with a generated `TranslationKey` union, `core/ui/` services (layout, theme, toast, confirm, pending requests, error interceptor, form errors), and a rewritten `App` shell driven by route data. Legacy `styles.scss` moves to `src/styles/_legacy.scss` and is deleted in P1e.

**Tech Stack:** ASP.NET Core 10, Swashbuckle 8.1.1, xunit 2.9.3 + FluentAssertions 8.3; Angular 21.2, @angular/material 21.2.14, @angular/cdk 21.2.14, ng-openapi-gen 1.0.5, @fontsource-variable/fraunces 5.3, @fontsource-variable/inter 5.3, material-symbols 0.47, angular-eslint 21.x, Vitest 4.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-14-p1-material-rewrite-design.md`. Sections 2, 3, 6 are implemented here.
- Branch: all work on `feat/material-rewrite` created from `main` after P0. Create it in Task 1 Step 0.
- Material and CDK pinned to `~21.2.14` (Angular core is 21.2; do NOT install 22.x).
- Fonts and icons self-hosted; no `fonts.googleapis.com`, no external CDN anywhere.
- Color seeds: primary `#2F5D50`, tertiary `#A6713C`, neutral `#8A8177`. Sex hues: male `#5B7A99`, female `#B5636F`.
- Fonts: display `'Fraunces Variable'`, body `'Inter Variable'`, base body 15px.
- Breakpoints: handset `< 600px`, tablet `600–1023px`, desktop `>= 1024px`.
- Generated client output `frontend/src/app/core/api/generated/` is gitignored; services are named `<Tag>Api` (e.g. `TreesApi`), methods `<controller><Action>` (e.g. `treesGetAll`).
- Every error response is `application/problem+json` with `status`, `title`, `detail`; validation errors are `ValidationProblemDetails` with `errors: { [field]: string[] }`, field names camelCase.
- `cd` is broken in the sandbox shell; use `--prefix`, `-C`, absolute paths. Repo root `/home/ben/repo/qseng`.
- `ng test` always with `--watch=false`. Stale vitest workers: `ps -eo pid,args | grep "suppress-warn[i]ng" | awk '{print $1}' | xargs -r kill -9`.
- Old feature components (`features/**`) are NOT rewritten here. They must still compile after every task.
- Commit messages end with the attribution lines from the session's system reminder.

## File structure produced by this plan

```
contracts/openapi.json                              exported spec (committed)
backend/export-openapi.sh                           boots API, dumps spec
backend/src/Qseng.Api/Controllers/ResultExtensions.cs   Result -> ProblemDetails
backend/src/Qseng.Api/Middleware/ExceptionMiddleware.cs ValidationProblemDetails / 500 ProblemDetails
backend/src/Qseng.Api/Program.cs                    swagger operation ids, global response types
backend/src/Qseng.Api/Controllers/*.cs              ProducesResponseType on every action
backend/tests/Qseng.Api.Tests/                      new xunit project (ResultExtensions, ExceptionMiddleware)
frontend/src/styles/_theme-colors.scss              generated M3 palettes
frontend/src/styles/_theme.scss                     mat.theme() + overrides
frontend/src/styles/_tokens.scss                    custom properties (sex hues, graph, layout)
frontend/src/styles/_typography.scss                type utilities
frontend/src/styles/_base.scss                      reset, body, focus, skip link
frontend/src/styles/_legacy.scss                    old styles.scss content (deleted in P1e)
frontend/src/styles.scss                            entry
frontend/scripts/extract-i18n.mjs                   one-off: TS dictionaries -> JSON (deleted after use)
frontend/scripts/gen-i18n-keys.mjs                  en.json -> translation-keys.ts
frontend/public/assets/i18n/{en,de}.json
frontend/src/app/core/i18n/translation-keys.ts      generated (committed)
frontend/src/app/core/i18n/i18n.service.ts          loads JSON, typed t()
frontend/ng-openapi-gen.json
frontend/src/app/core/api/generated/                generated (gitignored)
frontend/src/app/core/ui/layout.service.ts
frontend/src/app/core/theme/theme.service.ts        light | dark | auto
frontend/src/app/core/ui/toast.service.ts
frontend/src/app/core/ui/confirm-dialog.component.ts
frontend/src/app/core/ui/confirm-dialog.service.ts
frontend/src/app/core/ui/pending-requests.service.ts + pending.interceptor.ts
frontend/src/app/core/api/problem-details.ts        types + parse helper
frontend/src/app/core/error.interceptor.ts          rewritten
frontend/src/app/core/forms/server-errors.ts        setServerErrors()
frontend/src/app/core/forms/form-errors.pipe.ts
frontend/src/app/core/models/person-helpers.ts      fullName, lifespan, initials
frontend/src/app/core/ui/breadcrumb.service.ts
frontend/src/app/app.ts                             new shell
frontend/src/app/app.routes.ts                      route data { layout }
frontend/src/app/app.config.ts                      providers
frontend/eslint.config.js                           angular-eslint
```

---

### Task 1: ProblemDetails error contract (backend)

**Files:**
- Modify: `backend/src/Qseng.Api/Controllers/ResultExtensions.cs`
- Modify: `backend/src/Qseng.Api/Middleware/ExceptionMiddleware.cs`
- Modify: `backend/src/Qseng.Api/Controllers/MediaController.cs:33-34`
- Modify: `backend/src/Qseng.Api/Program.cs:27-29`
- Create: `backend/tests/Qseng.Api.Tests/Qseng.Api.Tests.csproj`
- Create: `backend/tests/Qseng.Api.Tests/ResultExtensionsTests.cs`
- Create: `backend/tests/Qseng.Api.Tests/ExceptionMiddlewareTests.cs`
- Modify: `backend/Qseng.slnx`

**Interfaces:**
- Produces: `ResultExtensions.ToActionResult<T>(this Result<T>)` unchanged signature; failures now return `ObjectResult` whose `Value` is `Microsoft.AspNetCore.Mvc.ProblemDetails`.
- Produces: `ResultExtensions.Problem(int status, string? detail): ObjectResult` for ad-hoc errors in controllers.

- [ ] **Step 0: Create the branch**

```bash
git -C /home/ben/repo/qseng checkout -b feat/material-rewrite main
```

- [ ] **Step 1: Create the API test project**

`backend/tests/Qseng.Api.Tests/Qseng.Api.Tests.csproj`:
```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <IsPackable>false</IsPackable>
  </PropertyGroup>
  <ItemGroup>
    <FrameworkReference Include="Microsoft.AspNetCore.App" />
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.12.0" />
    <PackageReference Include="xunit" Version="2.9.3" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.8.3">
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
      <PrivateAssets>all</PrivateAssets>
    </PackageReference>
    <PackageReference Include="FluentAssertions" Version="8.3.0" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="..\..\src\Qseng.Api\Qseng.Api.csproj" />
  </ItemGroup>
</Project>
```

Add to `backend/Qseng.slnx` inside `<Folder Name="/tests/">`:
```xml
    <Project Path="tests/Qseng.Api.Tests/Qseng.Api.Tests.csproj" />
```

- [ ] **Step 2: Write the failing ResultExtensions tests**

`backend/tests/Qseng.Api.Tests/ResultExtensionsTests.cs`:
```csharp
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Qseng.Api.Controllers;
using Qseng.Application.Common;
using Xunit;

namespace Qseng.Api.Tests;

public class ResultExtensionsTests
{
    [Fact]
    public void Success_returns_200_with_value()
    {
        var action = Result.Ok("hello").ToActionResult();

        var ok = action.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be("hello");
    }

    [Theory]
    [InlineData(400, "Bad Request")]
    [InlineData(401, "Unauthorized")]
    [InlineData(403, "Forbidden")]
    [InlineData(404, "Not Found")]
    [InlineData(409, "Conflict")]
    public void Failure_returns_problem_details_with_status_title_and_detail(int status, string title)
    {
        var action = Result.Fail<string>("it broke", status).ToActionResult();

        var obj = action.Should().BeOfType<ObjectResult>().Subject;
        obj.StatusCode.Should().Be(status);
        obj.ContentTypes.Should().Contain("application/problem+json");

        var problem = obj.Value.Should().BeOfType<ProblemDetails>().Subject;
        problem.Status.Should().Be(status);
        problem.Title.Should().Be(title);
        problem.Detail.Should().Be("it broke");
    }
}
```

- [ ] **Step 3: Run to verify it fails**

Run: `dotnet test backend/tests/Qseng.Api.Tests -nologo -v q 2>&1 | grep -E "error|Failed|Passed" | head -5`
Expected: build error `'ObjectResult' ... ` or test failures on `BeOfType<ObjectResult>` (current code returns `NotFoundObjectResult` with anonymous body).

- [ ] **Step 4: Rewrite ResultExtensions**

`backend/src/Qseng.Api/Controllers/ResultExtensions.cs`:
```csharp
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Qseng.Application.Common;

namespace Qseng.Api.Controllers;

public static class ResultExtensions
{
    public static IActionResult ToActionResult<T>(this Result<T> result)
    {
        if (result.IsSuccess) return new OkObjectResult(result.Value);
        return Problem(result.StatusCode, result.Error);
    }

    /// <summary>RFC 7807 body for any failure status.</summary>
    public static ObjectResult Problem(int status, string? detail)
    {
        var problem = new ProblemDetails
        {
            Status = status,
            Title = ReasonPhrases.GetReasonPhrase(status),
            Detail = detail
        };
        return new ObjectResult(problem)
        {
            StatusCode = status,
            ContentTypes = { "application/problem+json" }
        };
    }
}
```

- [ ] **Step 5: Run ResultExtensions tests**

Run: `dotnet test backend/tests/Qseng.Api.Tests -nologo -v q 2>&1 | grep -E "Passed!|Failed!"`
Expected: `Passed! - Failed: 0, Passed: 6`

- [ ] **Step 6: Write the failing ExceptionMiddleware tests**

`backend/tests/Qseng.Api.Tests/ExceptionMiddlewareTests.cs`:
```csharp
using System.Text.Json;
using FluentAssertions;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Qseng.Api.Middleware;
using Xunit;

namespace Qseng.Api.Tests;

public class ExceptionMiddlewareTests
{
    private static async Task<(int status, string contentType, JsonElement body)> RunAsync(Exception toThrow)
    {
        var ctx = new DefaultHttpContext();
        ctx.Response.Body = new MemoryStream();
        var mw = new ExceptionMiddleware(_ => throw toThrow, NullLogger<ExceptionMiddleware>.Instance);

        await mw.InvokeAsync(ctx);

        ctx.Response.Body.Position = 0;
        var json = await new StreamReader(ctx.Response.Body).ReadToEndAsync();
        return (ctx.Response.StatusCode, ctx.Response.ContentType ?? "", JsonDocument.Parse(json).RootElement);
    }

    [Fact]
    public async Task Validation_failure_becomes_400_validation_problem_details_with_camel_case_fields()
    {
        var failures = new[]
        {
            new ValidationFailure("FirstName", "Required."),
            new ValidationFailure("FirstName", "Too short."),
            new ValidationFailure("Birth.Year", "Out of range.")
        };

        var (status, contentType, body) = await RunAsync(new ValidationException(failures));

        status.Should().Be(400);
        contentType.Should().StartWith("application/problem+json");
        body.GetProperty("status").GetInt32().Should().Be(400);
        body.GetProperty("title").GetString().Should().Be("One or more validation errors occurred.");

        var errors = body.GetProperty("errors");
        errors.GetProperty("firstName").EnumerateArray().Select(e => e.GetString())
              .Should().Equal("Required.", "Too short.");
        errors.GetProperty("birth.year").EnumerateArray().Should().HaveCount(1);
    }

    [Fact]
    public async Task Unhandled_exception_becomes_500_problem_details_without_leaking_message()
    {
        var (status, contentType, body) = await RunAsync(new InvalidOperationException("secret internals"));

        status.Should().Be(500);
        contentType.Should().StartWith("application/problem+json");
        body.GetProperty("status").GetInt32().Should().Be(500);
        body.GetProperty("title").GetString().Should().Be("Internal server error.");
        body.TryGetProperty("detail", out var detail).Should().BeFalse("detail must not leak exception text");
        body.ToString().Should().NotContain("secret internals");
    }
}
```

- [ ] **Step 7: Run to verify it fails**

Run: `dotnet test backend/tests/Qseng.Api.Tests -nologo -v q 2>&1 | grep -E "Failed |Passed!|Failed!"`
Expected: `Failed! - Failed: 2` (current middleware writes `{ errors: [...] }` array and `{ error: ... }`).

- [ ] **Step 8: Rewrite ExceptionMiddleware**

`backend/src/Qseng.Api/Middleware/ExceptionMiddleware.cs`:
```csharp
using System.Text.Json;
using FluentValidation;
using Microsoft.AspNetCore.Mvc;

namespace Qseng.Api.Middleware;

/// <summary>
/// Turns FluentValidation failures into <see cref="ValidationProblemDetails"/> (400)
/// and anything else into a generic <see cref="ProblemDetails"/> (500).
/// </summary>
public class ExceptionMiddleware
{
    private const string ProblemJson = "application/problem+json";

    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _log;

    public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> log)
    { _next = next; _log = log; }

    public async Task InvokeAsync(HttpContext ctx)
    {
        try
        {
            await _next(ctx);
        }
        catch (ValidationException vex)
        {
            var errors = vex.Errors
                .GroupBy(e => CamelCasePath(e.PropertyName))
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());

            var problem = new ValidationProblemDetails(errors)
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "One or more validation errors occurred."
            };
            await WriteAsync(ctx, problem);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Unhandled exception");
            var problem = new ProblemDetails
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "Internal server error."
            };
            await WriteAsync(ctx, problem);
        }
    }

    /// <summary>"Birth.Year" -> "birth.year" so keys match the JSON the client sent.</summary>
    private static string CamelCasePath(string propertyName) =>
        string.Join('.', propertyName.Split('.').Select(JsonNamingPolicy.CamelCase.ConvertName));

    private static Task WriteAsync(HttpContext ctx, ProblemDetails problem)
    {
        ctx.Response.StatusCode = problem.Status!.Value;
        ctx.Response.ContentType = ProblemJson;
        return ctx.Response.WriteAsJsonAsync(problem, problem.GetType(), contentType: ProblemJson);
    }
}
```

- [ ] **Step 9: Run middleware tests**

Run: `dotnet test backend/tests/Qseng.Api.Tests -nologo -v q 2>&1 | grep -E "Passed!|Failed!"`
Expected: `Passed! - Failed: 0, Passed: 8`

- [ ] **Step 10: Replace the remaining ad-hoc error body**

In `backend/src/Qseng.Api/Controllers/MediaController.cs` replace
```csharp
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "No file provided." });
```
with
```csharp
        if (file is null || file.Length == 0)
            return ResultExtensions.Problem(StatusCodes.Status400BadRequest, "No file provided.");
```

- [ ] **Step 11: Declare global error response types**

In `backend/src/Qseng.Api/Program.cs` replace
```csharp
builder.Services.AddControllers()
    .AddJsonOptions(opt =>
        opt.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()));
```
with
```csharp
builder.Services.AddControllers(opt =>
    {
        // Every action can fail with these shapes; declaring them once keeps the OpenAPI spec honest.
        opt.Filters.Add(new Microsoft.AspNetCore.Mvc.ProducesResponseTypeAttribute(typeof(Microsoft.AspNetCore.Mvc.ValidationProblemDetails), StatusCodes.Status400BadRequest, "application/problem+json"));
        opt.Filters.Add(new Microsoft.AspNetCore.Mvc.ProducesResponseTypeAttribute(typeof(Microsoft.AspNetCore.Mvc.ProblemDetails), StatusCodes.Status401Unauthorized, "application/problem+json"));
        opt.Filters.Add(new Microsoft.AspNetCore.Mvc.ProducesResponseTypeAttribute(typeof(Microsoft.AspNetCore.Mvc.ProblemDetails), StatusCodes.Status403Forbidden, "application/problem+json"));
        opt.Filters.Add(new Microsoft.AspNetCore.Mvc.ProducesResponseTypeAttribute(typeof(Microsoft.AspNetCore.Mvc.ProblemDetails), StatusCodes.Status404NotFound, "application/problem+json"));
        opt.Filters.Add(new Microsoft.AspNetCore.Mvc.ProducesResponseTypeAttribute(typeof(Microsoft.AspNetCore.Mvc.ProblemDetails), StatusCodes.Status409Conflict, "application/problem+json"));
        opt.Filters.Add(new Microsoft.AspNetCore.Mvc.ProducesResponseTypeAttribute(typeof(Microsoft.AspNetCore.Mvc.ProblemDetails), StatusCodes.Status500InternalServerError, "application/problem+json"));
    })
    .AddJsonOptions(opt =>
        opt.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()));
```

- [ ] **Step 12: Full backend test run**

Run: `dotnet test backend/Qseng.slnx -nologo -v q 2>&1 | grep -E "Passed!|Failed!|error CS"`
Expected: three `Passed!` lines (Domain 13, Application 49, Api 8), no `error CS`.

- [ ] **Step 13: Commit**

```bash
git add backend
git commit -m "feat(api): RFC 7807 ProblemDetails for all error responses

Result failures and FluentValidation errors now produce application/problem+json
bodies; validation errors keyed by camelCase field path. Adds Qseng.Api.Tests."
```

---

### Task 2: Response types, operation ids, OpenAPI export

**Files:**
- Modify: `backend/src/Qseng.Api/Program.cs:30-43` (SwaggerGen options)
- Modify: all nine controllers under `backend/src/Qseng.Api/Controllers/` (add `[ProducesResponseType]` + `[Produces("application/json")]`)
- Create: `backend/export-openapi.sh`
- Create: `contracts/openapi.json` (generated by the script, committed)

**Interfaces:**
- Produces: operationIds `<Controller>_<Action>` for every endpoint (table below); every 2xx has a typed schema. Later plans depend on these generated method names:

| Service (tag) | operationId | 2xx type |
|---|---|---|
| Auth | Auth_Register, Auth_Login, Auth_Refresh | AuthResponse |
| Auth | Auth_Logout | 200, no body |
| Trees | Trees_GetAll | TreeDto[] |
| Trees | Trees_Create, Trees_Update | TreeDto |
| Trees | Trees_Delete | 200, no body |
| Persons | Persons_GetByTree | PersonDto[] |
| Persons | Persons_GetById, Persons_Create, Persons_Update | PersonDto |
| Persons | Persons_GetRelations | PersonRelationDto[] |
| Persons | Persons_Delete | 200, no body |
| Relationships | Relationships_GetByTree | RelationshipDto[] |
| Relationships | Relationships_Create | RelationshipDto |
| Relationships | Relationships_Delete | 200, no body |
| Timeline | Timeline_Get | TimelineEventDto[] |
| Timeline | Timeline_Add, Timeline_Update | TimelineEventDto |
| Timeline | Timeline_Delete | 200, no body |
| Import | Import_Preview, Import_Commit | ImportReport |
| User | User_GetProfile | UserProfileDto |
| User | User_ChangePassword | AuthResponse |
| User | User_ChangeLanguage, User_DeleteData, User_DeleteAccount | 200, no body |
| User | User_Export | ExportDto |
| Admin | Admin_ListUsers | UserSummaryDto[] |
| Admin | Admin_CreateUser | UserSummaryDto |
| Admin | Admin_SetActive, Admin_SetAdmin, Admin_ChangePassword, Admin_DeleteUser, Admin_SetRegistration | 200, no body |
| Admin | Admin_GetSettings | SiteSettingsDto |
| Media | Media_GetMedia | MediaDto[] |
| Media | Media_Upload | 201 MediaDto |
| Media | Media_SetAvatar, Media_Delete | 200, no body |

- [ ] **Step 1: Configure SwaggerGen**

In `backend/src/Qseng.Api/Program.cs` replace the line
```csharp
    c.SwaggerDoc("v1", new() { Title = "Qseng API", Version = "v1" });
```
with
```csharp
    c.SwaggerDoc("v1", new() { Title = "Qseng API", Version = "v1" });
    c.SupportNonNullableReferenceTypes();
    // Only controller actions; the /health minimal endpoint has no controller/action route values.
    c.DocInclusionPredicate((_, api) => api.ActionDescriptor.RouteValues.ContainsKey("controller"));
    // Stable, unique ids -> readable generated client methods (treesGetAll, personsCreate, ...).
    c.CustomOperationIds(api =>
        $"{api.ActionDescriptor.RouteValues["controller"]}_{api.ActionDescriptor.RouteValues["action"]}");
```

- [ ] **Step 2: Annotate controllers**

Add `using Microsoft.AspNetCore.Http;` is implicit (ImplicitUsings + Web SDK). For each controller add `[Produces("application/json")]` under `[ApiController]` and the attribute lines shown. Only the attribute lines change; method bodies stay.

`AuthController.cs` (add `using Qseng.Application.Auth.Register;` already present for AuthResponse):
```csharp
    [HttpPost("register")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Register(...)

    [HttpPost("login")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Login(...)

    [HttpPost("refresh")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Refresh(...)

    [HttpPost("logout")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Logout(...)
```

`TreesController.cs` (add `using Qseng.Application.Trees.CreateTree;` for `TreeDto`):
```csharp
    [HttpGet]
    [ProducesResponseType(typeof(List<TreeDto>), StatusCodes.Status200OK)]
    ... GetAll
    [HttpPost]
    [ProducesResponseType(typeof(TreeDto), StatusCodes.Status200OK)]
    ... Create
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(TreeDto), StatusCodes.Status200OK)]
    ... Update
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    ... Delete
```

`PersonsController.cs` (add `using Qseng.Application.Persons;` and `using Qseng.Application.Persons.GetPersonRelations;`):
```csharp
    GetByTree     -> [ProducesResponseType(typeof(List<PersonDto>), StatusCodes.Status200OK)]
    GetById       -> [ProducesResponseType(typeof(PersonDto), StatusCodes.Status200OK)]
    Create        -> [ProducesResponseType(typeof(PersonDto), StatusCodes.Status200OK)]
    Update        -> [ProducesResponseType(typeof(PersonDto), StatusCodes.Status200OK)]
    GetRelations  -> [ProducesResponseType(typeof(List<PersonRelationDto>), StatusCodes.Status200OK)]
    Delete        -> [ProducesResponseType(StatusCodes.Status200OK)]
```

`RelationshipsController.cs` (add `using Qseng.Application.Relationships;`):
```csharp
    GetByTree -> [ProducesResponseType(typeof(List<RelationshipDto>), StatusCodes.Status200OK)]
    Create    -> [ProducesResponseType(typeof(RelationshipDto), StatusCodes.Status200OK)]
    Delete    -> [ProducesResponseType(StatusCodes.Status200OK)]
```

`TimelineController.cs` (add `using Qseng.Application.Timeline;`):
```csharp
    Get    -> [ProducesResponseType(typeof(List<TimelineEventDto>), StatusCodes.Status200OK)]
    Add    -> [ProducesResponseType(typeof(TimelineEventDto), StatusCodes.Status200OK)]
    Update -> [ProducesResponseType(typeof(TimelineEventDto), StatusCodes.Status200OK)]
    Delete -> [ProducesResponseType(StatusCodes.Status200OK)]
```

`ImportController.cs` (add `using Qseng.Application.Import;`):
```csharp
    Preview -> [ProducesResponseType(typeof(ImportReport), StatusCodes.Status200OK)]
    Commit  -> [ProducesResponseType(typeof(ImportReport), StatusCodes.Status200OK)]
```

`UserController.cs` (add `using Qseng.Application.Users;` and `using Qseng.Application.Auth.Register;`):
```csharp
    GetProfile     -> [ProducesResponseType(typeof(UserProfileDto), StatusCodes.Status200OK)]
    ChangePassword -> [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    ChangeLanguage -> [ProducesResponseType(StatusCodes.Status200OK)]
    Export         -> [ProducesResponseType(typeof(ExportDto), StatusCodes.Status200OK)]
    DeleteData     -> [ProducesResponseType(StatusCodes.Status200OK)]
    DeleteAccount  -> [ProducesResponseType(StatusCodes.Status200OK)]
```

`AdminController.cs` (add `using Qseng.Application.Admin;`):
```csharp
    ListUsers       -> [ProducesResponseType(typeof(List<UserSummaryDto>), StatusCodes.Status200OK)]
    CreateUser      -> [ProducesResponseType(typeof(UserSummaryDto), StatusCodes.Status200OK)]
    SetActive       -> [ProducesResponseType(StatusCodes.Status200OK)]
    SetAdmin        -> [ProducesResponseType(StatusCodes.Status200OK)]
    ChangePassword  -> [ProducesResponseType(StatusCodes.Status200OK)]
    DeleteUser      -> [ProducesResponseType(StatusCodes.Status200OK)]
    GetSettings     -> [ProducesResponseType(typeof(SiteSettingsDto), StatusCodes.Status200OK)]
    SetRegistration -> [ProducesResponseType(StatusCodes.Status200OK)]
```

`MediaController.cs` (add `using Qseng.Application.Media;`):
```csharp
    GetMedia  -> [ProducesResponseType(typeof(List<MediaDto>), StatusCodes.Status200OK)]
    Upload    -> [ProducesResponseType(typeof(MediaDto), StatusCodes.Status201Created)]
    SetAvatar -> [ProducesResponseType(StatusCodes.Status200OK)]
    Delete    -> [ProducesResponseType(StatusCodes.Status200OK)]
```

- [ ] **Step 3: Build**

Run: `dotnet build backend/Qseng.slnx -nologo -v q 2>&1 | grep -E "error|Error\(s\)"`
Expected: `0 Error(s)`

- [ ] **Step 4: Write the export script**

`backend/export-openapi.sh`:
```bash
#!/usr/bin/env bash
# Boots the API against a throwaway SQLite db, downloads the Swagger document and
# writes it pretty-printed to contracts/openapi.json (stable diffs).
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$DIR/../contracts/openapi.json"
TMP="$(mktemp -d)"
PORT=5099

cleanup() { [[ -n "${API_PID:-}" ]] && kill "$API_PID" 2>/dev/null && wait "$API_PID" 2>/dev/null || true; rm -rf "$TMP"; }
trap cleanup EXIT

ASPNETCORE_ENVIRONMENT=Development \
ASPNETCORE_URLS="http://127.0.0.1:$PORT" \
DB_PROVIDER=sqlite CONNECTION_STRING="Data Source=$TMP/export.db" \
Uploads__Path="$TMP/uploads" \
dotnet run --project "$DIR/src/Qseng.Api" --no-launch-profile > "$TMP/api.log" 2>&1 &
API_PID=$!

for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:$PORT/swagger/v1/swagger.json" -o "$TMP/swagger.json"; then
    mkdir -p "$(dirname "$OUT")"
    python3 -c 'import json,sys; json.dump(json.load(open(sys.argv[1])), open(sys.argv[2], "w"), indent=2, ensure_ascii=False); open(sys.argv[2], "a").write("\n")' "$TMP/swagger.json" "$OUT"
    echo "wrote $OUT"
    exit 0
  fi
  sleep 1
done

echo "API did not come up; log:" >&2
cat "$TMP/api.log" >&2
exit 1
```

Then: `chmod +x backend/export-openapi.sh`

- [ ] **Step 5: Export and inspect**

Run: `backend/export-openapi.sh && python3 -c "
import json; s=json.load(open('contracts/openapi.json'))
ops=[o['operationId'] for p in s['paths'].values() for o in p.values()]
print(len(ops), sorted(ops)[:5]); print('schemas', len(s['components']['schemas']))
print('problem' , 'ProblemDetails' in s['components']['schemas'], 'ValidationProblemDetails' in s['components']['schemas'])
print('tree200', s['paths']['/api/v1/trees']['get']['responses']['200']['content']['application/json']['schema'])"`
Expected:
```
wrote /home/ben/repo/qseng/backend/../contracts/openapi.json
41 ['Admin_ChangePassword', 'Admin_CreateUser', 'Admin_DeleteUser', 'Admin_GetSettings', 'Admin_ListUsers']
schemas <some number >= 25>
problem True True
tree200 {'type': 'array', 'items': {'$ref': '#/components/schemas/TreeDto'}}
```
(41 = Auth 4 + Trees 4 + Persons 6 + Relationships 3 + Timeline 4 + Import 2 + User 6 + Admin 8 + Media 4.)

- [ ] **Step 6: Commit**

```bash
git add backend contracts
git commit -m "feat(api): typed responses, stable operation ids, OpenAPI export script + committed spec"
```

---

### Task 3: Material 21, fonts, icons, theme layer

**Files:**
- Modify: `frontend/package.json` (deps)
- Modify: `frontend/angular.json` (styles list, budgets)
- Create: `frontend/src/styles/_theme-colors.scss` (generated by schematic)
- Create: `frontend/src/styles/_theme.scss`, `_tokens.scss`, `_typography.scss`, `_base.scss`
- Move: `frontend/src/styles.scss` → `frontend/src/styles/_legacy.scss`; new `frontend/src/styles.scss` entry
- Modify: `frontend/src/app/app.config.ts` (Material defaults, icon font)
- Modify: `frontend/src/test-setup.ts` (animations provider)
- Modify: `frontend/src/index.html` (theme-color, color-scheme)
- Test: `frontend/src/app/core/ui/material-smoke.spec.ts`

**Interfaces:**
- Produces: CSS custom properties `--qs-sex-male`, `--qs-sex-female`, `--qs-sex-unknown`, `--qs-graph-marriage`, `--qs-graph-descent`, `--qs-graph-node-bg`, `--qs-graph-node-border`, `--qs-toolbar-h`, `--qs-gutter`, `--qs-page-max`; M3 system tokens `--mat-sys-*`.
- Produces: default `mat-icon` font set `material-symbols-rounded`; `MAT_FORM_FIELD_DEFAULT_OPTIONS` appearance `outline`.

- [ ] **Step 1: Install packages**

```bash
npm --prefix frontend install @angular/material@~21.2.14 @angular/cdk@~21.2.14 @fontsource-variable/fraunces@^5.3.0 @fontsource-variable/inter@^5.3.0 material-symbols@^0.47.0
```
Expected: `package.json` lists all five; `npm ls --prefix frontend @angular/material` prints `@angular/material@21.2.x`.

- [ ] **Step 2: Generate M3 palettes**

```bash
npx --prefix frontend ng generate @angular/material:theme-color --primary-color=#2F5D50 --tertiary-color=#A6713C --neutral-color=#8A8177 --directory=src/styles --is-scss=true
```
Expected: `frontend/src/styles/_theme-colors.scss` created, containing `$primary-palette` and `$tertiary-palette`.

- [ ] **Step 3: Move legacy styles**

```bash
git -C /home/ben/repo/qseng mv frontend/src/styles.scss frontend/src/styles/_legacy.scss
```

- [ ] **Step 4: Write the theme layer**

`frontend/src/styles/_tokens.scss`:
```scss
// Project tokens layered on top of the Material system tokens (--mat-sys-*).
:root {
  --qs-toolbar-h: 64px;
  --qs-gutter: 24px;
  --qs-page-max: 1200px;

  // Person sex hues. Never the sole carrier of meaning (initials + symbol always shown).
  --qs-sex-male: #5b7a99;
  --qs-sex-female: #b5636f;
  --qs-sex-unknown: var(--mat-sys-outline);

  // Graph
  --qs-graph-node-bg: var(--mat-sys-surface-container-lowest);
  --qs-graph-node-border: var(--mat-sys-outline-variant);
  --qs-graph-marriage: var(--mat-sys-tertiary);
  --qs-graph-descent: var(--mat-sys-outline);
  --qs-graph-selected: var(--mat-sys-primary);
}

@media (max-width: 599.98px) {
  :root {
    --qs-toolbar-h: 56px;
    --qs-gutter: 16px;
  }
}
```

`frontend/src/styles/_theme.scss`:
```scss
@use '@angular/material' as mat;
@use './theme-colors' as palettes;

html {
  // ThemeService sets `color-scheme` on <html>; mat.theme() defaults to
  // theme-type: color-scheme, so every token flips with it via light-dark().
  color-scheme: light dark;

  @include mat.theme((
    color: (
      primary: palettes.$primary-palette,
      tertiary: palettes.$tertiary-palette,
    ),
    typography: (
      plain-family: 'Inter Variable',
      brand-family: 'Fraunces Variable',
      regular-weight: 400,
      medium-weight: 500,
      bold-weight: 600,
    ),
    density: 0,
  ));

  // Shape: cards 12px, inputs/small 8px, chips full.
  @include mat.theme-overrides((
    corner-extra-small: 6px,
    corner-small: 8px,
    corner-medium: 12px,
    corner-large: 16px,
  ));
}

// Flat cards with a hairline border; elevation reserved for overlays.
html {
  @include mat.card-overrides((
    elevated-container-elevation: none,
    outlined-outline-color: var(--mat-sys-outline-variant),
  ));
}
```

`frontend/src/styles/_typography.scss`:
```scss
// Fonts are self-hosted via the @fontsource-variable css files listed in angular.json.
body {
  font: var(--mat-sys-body-large);
  font-size: 15px;
  line-height: 1.5;
}

h1, h2, h3, h4 {
  margin: 0;
  font-family: 'Fraunces Variable', Georgia, serif;
  font-weight: 500;
  line-height: 1.2;
  letter-spacing: -0.01em;
}

h1 { font-size: 1.9rem; }
h2 { font-size: 1.45rem; }
h3 { font-size: 1.15rem; }

.qs-display { font-family: 'Fraunces Variable', Georgia, serif; }
.qs-muted   { color: var(--mat-sys-on-surface-variant); }
```

`frontend/src/styles/_base.scss`:
```scss
*, *::before, *::after { box-sizing: border-box; }

html, body { height: 100%; margin: 0; }

body {
  color: var(--mat-sys-on-surface);
  background: var(--mat-sys-surface);
  -webkit-font-smoothing: antialiased;
}

a { color: var(--mat-sys-primary); text-decoration: none; }
a:hover { text-decoration: underline; }

:focus-visible {
  outline: 2px solid var(--mat-sys-primary);
  outline-offset: 2px;
}

.qs-skip-link {
  position: absolute;
  left: 8px;
  top: -100px;
  z-index: 1000;
  padding: 8px 12px;
  background: var(--mat-sys-primary);
  color: var(--mat-sys-on-primary);
  border-radius: var(--mat-sys-corner-small);
  &:focus { top: 8px; }
}

.qs-page {
  max-width: var(--qs-page-max);
  margin: 0 auto;
  padding: 24px var(--qs-gutter) 48px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

`frontend/src/styles.scss` (new entry):
```scss
@use './styles/theme';
@use './styles/tokens';
@use './styles/base';
@use './styles/typography';

// Old global styles still used by feature screens not yet rewritten. Removed in P1e.
@use './styles/legacy';
```

- [ ] **Step 5: Register font and icon css in angular.json**

In `frontend/angular.json`, build `options.styles` becomes:
```json
"styles": [
  "node_modules/@fontsource-variable/inter/index.css",
  "node_modules/@fontsource-variable/fraunces/index.css",
  "node_modules/material-symbols/rounded.css",
  "src/styles.scss"
]
```
and the production `budgets` become:
```json
"budgets": [
  { "type": "initial", "maximumWarning": "600kB", "maximumError": "900kB" },
  { "type": "anyComponentStyle", "maximumWarning": "6kB", "maximumError": "12kB" }
]
```

- [ ] **Step 6: Material defaults in app.config.ts**

`frontend/src/app/app.config.ts`:
```ts
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatIconRegistry } from '@angular/material/icon';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MAT_SNACK_BAR_DEFAULT_OPTIONS } from '@angular/material/snack-bar';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { errorInterceptor } from './core/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    provideAnimationsAsync(),
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'outline' } },
    { provide: MAT_SNACK_BAR_DEFAULT_OPTIONS, useValue: { duration: 4000 } },
    provideAppInitializer(() => {
      inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-rounded');
    })
  ]
};
```
(Interceptors are extended in Tasks 6 and 7; the `provideAppInitializer` gains the i18n loader in Task 4.)

- [ ] **Step 7: index.html**

In `frontend/src/index.html` replace `<meta name="theme-color" content="#4f46e5">` with:
```html
  <meta name="theme-color" content="#2F5D50">
  <meta name="color-scheme" content="light dark">
```

- [ ] **Step 8: Test setup gets animations**

Append to `frontend/src/test-setup.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { beforeEach } from 'vitest';

beforeEach(() => {
  TestBed.configureTestingModule({ providers: [provideNoopAnimations()] });
});
```

- [ ] **Step 9: Smoke test that Material renders**

`frontend/src/app/core/ui/material-smoke.spec.ts`:
```ts
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { describe, expect, it } from 'vitest';

@Component({
  imports: [MatButtonModule, MatIconModule],
  template: `<button matButton="filled"><mat-icon>park</mat-icon>Trees</button>`
})
class HostComponent {}

describe('Material setup', () => {
  it('renders a filled button with an icon', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('button.mat-mdc-button-base')).not.toBeNull();
    expect(el.querySelector('mat-icon')?.textContent?.trim()).toBe('park');
  });
});
```

- [ ] **Step 10: Run tests and build**

Run: `timeout 150 npx --prefix frontend ng test --watch=false 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "Tests |Test Files"`
Expected: `Test Files  3 passed (3)` / `Tests  36 passed (36)`

Run: `npx --prefix frontend ng build --configuration production 2>&1 | grep -E "complete|ERROR|error|exceeded"`
Expected: `Application bundle generation complete`, no `exceeded`.

- [ ] **Step 11: Visual check**

Start API (`ASPNETCORE_ENVIRONMENT=Development DB_PROVIDER=sqlite CONNECTION_STRING="Data Source=/tmp/p1a.db" dotnet run --project backend/src/Qseng.Api --no-launch-profile &`) and `npm start --prefix frontend &`, open http://localhost:4200/login in Playwright, screenshot to the scratchpad. Expected: page renders (legacy styles still apply), body font is Inter, no console errors about fonts. Stop both processes afterwards.

- [ ] **Step 12: Commit**

```bash
git add frontend
git commit -m "feat(ui): Angular Material 21 with warm-heritage M3 theme, self-hosted Inter/Fraunces and Material Symbols"
```

---

### Task 4: i18n dictionaries to JSON with typed keys

**Files:**
- Create: `frontend/scripts/extract-i18n.mjs` (one-off, deleted at end of task)
- Create: `frontend/scripts/gen-i18n-keys.mjs`
- Create: `frontend/public/assets/i18n/en.json`, `frontend/public/assets/i18n/de.json`
- Create: `frontend/src/app/core/i18n/translation-keys.ts` (generated, committed)
- Modify: `frontend/src/app/core/i18n/i18n.service.ts` (rewrite)
- Modify: `frontend/src/app/core/i18n/translate.pipe.ts`
- Modify: `frontend/src/app/features/persons/person-relations.component.ts:32`, `frontend/src/app/features/trees/tree-view/tree-view.component.ts:88`, `frontend/src/app/features/admin/admin-users.component.ts:246`
- Modify: `frontend/package.json` scripts; `frontend/src/app/app.config.ts` initializer
- Test: `frontend/src/app/core/i18n/i18n.service.spec.ts`

**Interfaces:**
- Produces: `type TranslationKey` (union of all keys in `en.json`).
- Produces: `I18nService.t(key: TranslationKey): string`, `I18nService.dynamic(key: string): string`, `I18nService.lang: Signal<'en'|'de'>`, `setLang(lang)`, `load(): Promise<void>`, plus existing `sexLabel`, `eventLabel`, `relLabel`, `sexLabels`, `eventTypeLabels`, `relTypeLabels`.

- [ ] **Step 1: One-off extraction script**

`frontend/scripts/extract-i18n.mjs`:
```js
// One-off: pulls the `T` dictionary out of i18n.service.ts and writes JSON files.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/app/core/i18n/i18n.service.ts'), 'utf8');
const start = src.indexOf('const T: Record<Lang, Record<string, string>> = ');
const end = src.indexOf('\n};', start) + 3;
if (start < 0 || end < 3) throw new Error('dictionary literal not found');

const literal = src.slice(start, end).replace(/^const T: [^=]+= /, 'const T = ');
const js = ts.transpileModule(literal + '\nmodule.exports = T;', {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const T = mod.exports;

const enKeys = Object.keys(T.en).sort();
const deKeys = Object.keys(T.de).sort();
const missingDe = enKeys.filter(k => !(k in T.de));
const extraDe = deKeys.filter(k => !(k in T.en));
if (missingDe.length || extraDe.length) {
  console.error('key mismatch', { missingDe, extraDe });
  process.exit(1);
}

mkdirSync(join(root, 'public/assets/i18n'), { recursive: true });
for (const lang of ['en', 'de']) {
  const sorted = Object.fromEntries(enKeys.map(k => [k, T[lang][k]]));
  writeFileSync(join(root, `public/assets/i18n/${lang}.json`), JSON.stringify(sorted, null, 2) + '\n');
}
console.log(`wrote ${enKeys.length} keys for en and de`);
```

Run: `node /home/ben/repo/qseng/frontend/scripts/extract-i18n.mjs`
Expected: `wrote N keys for en and de` (N about 300). If it reports `key mismatch`, add the missing keys to the JSON of the other language by hand with an English fallback, then continue.

- [ ] **Step 2: Key type generator**

`frontend/scripts/gen-i18n-keys.mjs`:
```js
// Generates a string-literal union of every translation key so `t()` is type-checked.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const keys = Object.keys(JSON.parse(readFileSync(join(root, 'public/assets/i18n/en.json'), 'utf8'))).sort();
const out = `// GENERATED by scripts/gen-i18n-keys.mjs from public/assets/i18n/en.json. Do not edit.
export type TranslationKey =
${keys.map(k => `  | '${k.replace(/'/g, "\\'")}'`).join('\n')};

export const TRANSLATION_KEYS: readonly TranslationKey[] = [
${keys.map(k => `  '${k.replace(/'/g, "\\'")}',`).join('\n')}
];
`;
writeFileSync(join(root, 'src/app/core/i18n/translation-keys.ts'), out);
console.log(`generated ${keys.length} translation keys`);
```

Add to `frontend/package.json` `scripts`:
```json
"gen:i18n": "node scripts/gen-i18n-keys.mjs",
"prestart": "npm run gen:i18n",
"prebuild": "npm run gen:i18n",
"pretest": "npm run gen:i18n"
```
(Task 5 extends these `pre*` scripts with `gen:api`.)

Run: `npm run gen:i18n --prefix frontend`
Expected: `generated N translation keys`; file `frontend/src/app/core/i18n/translation-keys.ts` exists.

- [ ] **Step 3: Write the failing service spec**

`frontend/src/app/core/i18n/i18n.service.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from './i18n.service';

describe('I18nService', () => {
  const dictionaries: Record<string, Record<string, string>> = {
    en: { 'save': 'Save', 'rel.parent': 'Parent', 'only.en': 'English only' },
    de: { 'save': 'Speichern', 'rel.parent': 'Elternteil' }
  };

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const lang = /([a-z]{2})\.json$/.exec(url)![1];
      return new Response(JSON.stringify(dictionaries[lang]), { status: 200 });
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('loads both dictionaries once at startup', async () => {
    const i18n = TestBed.inject(I18nService);
    await i18n.load();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(i18n.t('save')).toBe('Save');
  });

  it('switches language at runtime and persists the choice', async () => {
    const i18n = TestBed.inject(I18nService);
    await i18n.load();
    i18n.setLang('de');
    expect(i18n.t('save')).toBe('Speichern');
    expect(localStorage.getItem('lang')).toBe('de');
  });

  it('falls back to English, then to the key itself', async () => {
    const i18n = TestBed.inject(I18nService);
    await i18n.load();
    i18n.setLang('de');
    expect(i18n.dynamic('only.en')).toBe('English only');
    expect(i18n.dynamic('missing.key')).toBe('missing.key');
  });

  it('formats relationship labels through the typed helper', async () => {
    const i18n = TestBed.inject(I18nService);
    await i18n.load();
    expect(i18n.relLabel('Parent')).toBe('Parent');
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `timeout 120 npx --prefix frontend ng test --watch=false --include='**/i18n.service.spec.ts' 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "×|✓|Tests "`
Expected: failures (`load is not a function`, `dynamic is not a function`).

- [ ] **Step 5: Rewrite the service**

`frontend/src/app/core/i18n/i18n.service.ts`:
```ts
import { Injectable, computed, signal } from '@angular/core';
import { RelationshipType, Sex, TimelineEventType } from '../api/api-client.service';
import { TranslationKey } from './translation-keys';

export type Lang = 'en' | 'de';
export const LANGS: readonly Lang[] = ['en', 'de'];

type Dictionary = Record<string, string>;

/**
 * Runtime-switchable translations. Both dictionaries are fetched once at
 * bootstrap (see app.config.ts) so switching is instant and offline-safe.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly dictionaries = signal<Record<Lang, Dictionary>>({ en: {}, de: {} });
  private readonly _lang = signal<Lang>(I18nService.initialLang());
  readonly lang = this._lang.asReadonly();

  private static initialLang(): Lang {
    const stored = localStorage.getItem('lang');
    return stored === 'de' || stored === 'en' ? stored : 'en';
  }

  async load(): Promise<void> {
    const [en, de] = await Promise.all(LANGS.map(l => fetch(`assets/i18n/${l}.json`).then(r => r.json() as Promise<Dictionary>)));
    this.dictionaries.set({ en, de });
  }

  /** Type-checked lookup for literal keys. */
  t(key: TranslationKey): string {
    return this.dynamic(key);
  }

  /** For keys assembled at runtime (e.g. `'rel.' + type`). Falls back en -> key. */
  dynamic(key: string): string {
    const d = this.dictionaries();
    return d[this._lang()][key] ?? d.en[key] ?? key;
  }

  setLang(lang: Lang) {
    this._lang.set(lang);
    localStorage.setItem('lang', lang);
  }

  readonly sexLabels = computed(() => ({
    Male: this.t('sex.male'), Female: this.t('sex.female')
  }));

  readonly eventTypeLabels = computed(() => ({
    Birth: this.t('event.birth'), Death: this.t('event.death'), Marriage: this.t('event.marriage'),
    Move: this.t('event.move'), Occupation: this.t('event.occupation'),
    Education: this.t('event.education'), Custom: this.t('event.custom')
  }));

  readonly relTypeLabels = computed(() => ({
    Parent: this.t('rel.parent'), Spouse: this.t('rel.spouse'), Adoptive: this.t('rel.adoptive')
  }));

  sexLabel(s: Sex): string { return this.dynamic('sex.' + s.toLowerCase()); }
  eventLabel(type: TimelineEventType): string { return this.dynamic('event.' + type.toLowerCase()); }
  relLabel(type: RelationshipType): string { return this.dynamic('rel.' + type.toLowerCase()); }
}
```

`frontend/src/app/core/i18n/translate.pipe.ts`:
```ts
import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from './i18n.service';
import { TranslationKey } from './translation-keys';

@Pipe({ name: 'translate', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  private i18n = inject(I18nService);
  // `string` is accepted for legacy templates; new code should pass TranslationKey.
  transform(key: TranslationKey | string): string { return this.i18n.dynamic(key); }
}
```

- [ ] **Step 6: Fix the three dynamic call sites in legacy code**

- `frontend/src/app/features/persons/person-relations.component.ts:32` and `frontend/src/app/features/trees/tree-view/tree-view.component.ts:88`: replace `i18n.t('rel.' + t.toLowerCase())` with `i18n.dynamic('rel.' + t.toLowerCase())`.
- `frontend/src/app/features/admin/admin-users.component.ts:246`: replace `this.i18n.t(key)` with `this.i18n.dynamic(key)`.

- [ ] **Step 7: Load dictionaries at bootstrap**

In `frontend/src/app/app.config.ts` change the initializer to:
```ts
    provideAppInitializer(async () => {
      inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-rounded');
      await inject(I18nService).load();
    })
```
and add `import { I18nService } from './core/i18n/i18n.service';`.

- [ ] **Step 8: Run the spec, whole suite, build**

Run: `timeout 150 npx --prefix frontend ng test --watch=false 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "Tests |Test Files|error TS"`
Expected: `Test Files  4 passed (4)` / `Tests  40 passed (40)`, no `error TS`.

Run: `npx --prefix frontend ng build --configuration production 2>&1 | grep -E "complete|error"`
Expected: `Application bundle generation complete`.

- [ ] **Step 9: Delete the one-off script and commit**

```bash
rm frontend/scripts/extract-i18n.mjs
git add frontend
git commit -m "feat(i18n): JSON dictionaries loaded at bootstrap, generated TranslationKey union, typed t()"
```

---

### Task 5: Generated API client (ng-openapi-gen)

**Files:**
- Modify: `frontend/package.json` (devDependency, scripts)
- Create: `frontend/ng-openapi-gen.json`
- Modify: `.gitignore`
- Test: `frontend/src/app/core/api/generated-client.spec.ts`

**Interfaces:**
- Produces: `frontend/src/app/core/api/generated/` with `ApiConfiguration`, `ApiModule`, `services/<tag>-api.ts` exporting `TreesApi`, `PersonsApi`, `RelationshipsApi`, `TimelineApi`, `ImportApi`, `UserApi`, `AdminApi`, `MediaApi`, `AuthApi`; `models/*.ts` exporting `TreeDto`, `PersonDto`, `PersonRelationDto`, `RelationshipDto`, `TimelineEventDto`, `ImportReport`, `MediaDto`, `UserProfileDto`, `UserSummaryDto`, `SiteSettingsDto`, `ExportDto`, `AuthResponse`, `ProblemDetails`, `ValidationProblemDetails`, `PartialDate`, `Sex`, `RelationshipType`, `TimelineEventType`, `MediaKind`, and request records (`PersonRequest`, `CreateTreeRequest`, ...). Import path: `'../../core/api/generated'` (barrel).
- Method naming: operationId `Trees_GetAll` → `treesGetAll(params?)`; parameters passed as one object, e.g. `personsApi.personsGetById({ id })`, `treesApi.treesCreate({ body: { name, description } })`.

- [ ] **Step 1: Install and configure**

```bash
npm --prefix frontend install -D ng-openapi-gen@^1.0.5
```

`frontend/ng-openapi-gen.json`:
```json
{
  "$schema": "node_modules/ng-openapi-gen/ng-openapi-gen-schema.json",
  "input": "../contracts/openapi.json",
  "output": "src/app/core/api/generated",
  "serviceSuffix": "Api",
  "enumStyle": "alias",
  "indexFile": true,
  "removeStaleFiles": true,
  "ignoreUnusedModels": false,
  "silent": true
}
```

Append to `.gitignore`:
```
# generated OpenAPI client (npm run gen:api)
frontend/src/app/core/api/generated/
```

`frontend/package.json` scripts (replace the `pre*` ones from Task 4):
```json
"gen:api": "ng-openapi-gen --config ng-openapi-gen.json",
"gen": "npm run gen:i18n && npm run gen:api",
"prestart": "npm run gen",
"prebuild": "npm run gen",
"pretest": "npm run gen",
"postinstall": "npm run gen"
```

- [ ] **Step 2: Generate and inspect**

Run: `npm run gen:api --prefix frontend && ls frontend/src/app/core/api/generated frontend/src/app/core/api/generated/services && grep -n "treesGetAll\|personsGetById" frontend/src/app/core/api/generated/services/*.ts | head -4`
Expected: directories `models/`, `services/`, files `api-configuration.ts`, `api.module.ts`, `index.ts`, `base-service.ts`, `request-builder.ts`, `strict-http-response.ts`; services `admin-api.ts auth-api.ts import-api.ts media-api.ts persons-api.ts relationships-api.ts timeline-api.ts trees-api.ts user-api.ts`; grep shows `treesGetAll(` and `personsGetById(`.

If `enumStyle: "alias"` is rejected by the schema, use `"enumStyle": "alias"` → check `models/sex.ts` reads `export type Sex = 'Male' | 'Female';`.

- [ ] **Step 3: Write a compile-and-call spec**

`frontend/src/app/core/api/generated-client.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { PersonsApi, TreesApi, TreeDto, Sex } from './generated';

describe('generated API client', () => {
  it('calls the expected URL and types the response', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const api = TestBed.inject(TreesApi);
    const http = TestBed.inject(HttpTestingController);

    let trees: TreeDto[] = [];
    api.treesGetAll().subscribe(t => (trees = t));

    const req = http.expectOne('/api/v1/trees');
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 't1', name: 'Familie', createdAt: '2026-01-01T00:00:00Z', personCount: 3 }]);

    expect(trees[0].name).toBe('Familie');
    http.verify();
  });

  it('serialises path params and bodies', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const api = TestBed.inject(PersonsApi);
    const http = TestBed.inject(HttpTestingController);
    const sex: Sex = 'Female';

    api.personsCreate({ treeId: 'abc', body: { firstName: 'Ada', lastName: 'L', sex } }).subscribe();

    const req = http.expectOne('/api/v1/trees/abc/persons');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ firstName: 'Ada', lastName: 'L', sex: 'Female' });
    req.flush({ id: 'p1', treeId: 'abc', firstName: 'Ada', lastName: 'L', sex: 'Female' });
    http.verify();
  });
});
```

- [ ] **Step 4: Run it**

Run: `timeout 120 npx --prefix frontend ng test --watch=false --include='**/generated-client.spec.ts' 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "Tests |error TS"`
Expected: `Tests  2 passed (2)`. If `PersonRequest` field names differ (check `models/person-request.ts`), adjust the body in the spec to the generated names; do not edit generated files.

- [ ] **Step 5: Commit**

```bash
git add .gitignore frontend/package.json frontend/package-lock.json frontend/ng-openapi-gen.json frontend/src/app/core/api/generated-client.spec.ts
git commit -m "feat(api-client): generate typed Angular client from contracts/openapi.json with ng-openapi-gen"
```

---

### Task 6: Cross-cutting UI services and error handling

**Files:**
- Create: `frontend/src/app/core/ui/layout.service.ts` + spec
- Modify: `frontend/src/app/core/theme/theme.service.ts` (rewrite) + spec
- Create: `frontend/src/app/core/ui/toast.service.ts` + spec
- Create: `frontend/src/app/core/ui/confirm-dialog.component.ts`, `confirm-dialog.service.ts` + spec
- Create: `frontend/src/app/core/ui/pending-requests.service.ts`, `pending.interceptor.ts` + spec
- Create: `frontend/src/app/core/api/problem-details.ts` + spec
- Modify: `frontend/src/app/core/error.interceptor.ts` (rewrite) + spec
- Create: `frontend/src/app/core/forms/server-errors.ts` + spec
- Create: `frontend/src/app/core/forms/form-errors.pipe.ts` + spec
- Create: `frontend/src/app/core/models/person-helpers.ts` + spec
- Modify: `frontend/src/app/app.config.ts` (pending interceptor)
- Modify: `frontend/src/app/app.ts` (theme toggle now cycles; fixed fully in Task 7)

**Interfaces:**
- `LayoutService { handset: Signal<boolean>; tablet: Signal<boolean>; desktop: Signal<boolean> }`
- `ThemeService { mode: Signal<'light'|'dark'|'auto'>; isDark: Signal<boolean>; setMode(m); cycle() }`
- `ToastService { success(msg, opts?); error(msg, opts?); info(msg, opts?) }` with `opts: { action?: string; onAction?: () => void; duration?: number }`
- `ConfirmDialogService.confirm(opts: ConfirmOptions): Promise<boolean | string>`; `ConfirmOptions { title: string; message: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean; requirePassword?: boolean }`
- `PendingRequestsService { count: Signal<number>; busy: Signal<boolean>; start(); end() }`
- `problem-details.ts`: `interface ProblemDetails { status?: number; title?: string; detail?: string }`, `interface ValidationProblemDetails extends ProblemDetails { errors: Record<string, string[]> }`, `isProblem(x): x is ProblemDetails`, `isValidationProblem(x): x is ValidationProblemDetails`, `problemMessage(err: unknown, fallback: string): string`
- `setServerErrors(form: FormGroup, problem: ValidationProblemDetails): string[]` (returns unmatched messages)
- `FormErrorsPipe`: `errors | formErrors` → first message string or ''
- `person-helpers.ts`: `fullName(p)`, `initials(p)`, `lifespan(p)`, `sexClass(sex)` where `p: { firstName: string; lastName: string; birth?: PartialDate|null; death?: PartialDate|null }`

- [ ] **Step 1: LayoutService spec + implementation**

`frontend/src/app/core/ui/layout.service.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { BehaviorSubject } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { LayoutService, QUERIES } from './layout.service';

function observerFor(active: string) {
  const state = (): BreakpointState => ({
    matches: true,
    breakpoints: { [QUERIES.handset]: active === 'handset', [QUERIES.tablet]: active === 'tablet', [QUERIES.desktop]: active === 'desktop' }
  });
  const subject = new BehaviorSubject<BreakpointState>(state());
  return { observe: () => subject.asObservable(), subject };
}

describe('LayoutService', () => {
  it('exposes handset / tablet / desktop as mutually exclusive signals', () => {
    const observer = observerFor('tablet');
    TestBed.configureTestingModule({ providers: [{ provide: BreakpointObserver, useValue: observer }] });
    const layout = TestBed.inject(LayoutService);
    expect(layout.tablet()).toBe(true);
    expect(layout.handset()).toBe(false);
    expect(layout.desktop()).toBe(false);
  });
});
```

`frontend/src/app/core/ui/layout.service.ts`:
```ts
import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { map } from 'rxjs';

export const QUERIES = {
  handset: '(max-width: 599.98px)',
  tablet: '(min-width: 600px) and (max-width: 1023.98px)',
  desktop: '(min-width: 1024px)'
} as const;

@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly observer = inject(BreakpointObserver);

  private readonly state = toSignal(
    this.observer.observe(Object.values(QUERIES)).pipe(map(s => s.breakpoints)),
    { initialValue: { [QUERIES.handset]: false, [QUERIES.tablet]: false, [QUERIES.desktop]: true } as Record<string, boolean> }
  );

  readonly handset = computed(() => this.state()[QUERIES.handset] === true);
  readonly tablet = computed(() => this.state()[QUERIES.tablet] === true);
  readonly desktop = computed(() => !this.handset() && !this.tablet());
}
```

- [ ] **Step 2: ThemeService spec + implementation**

`frontend/src/app/core/theme/theme.service.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute('data-color-scheme'); });

  it('defaults to auto and writes color-scheme "light dark"', () => {
    const theme = TestBed.inject(ThemeService);
    expect(theme.mode()).toBe('auto');
    expect(document.documentElement.getAttribute('data-color-scheme')).toBe('light dark');
  });

  it('setMode persists and applies the scheme', () => {
    const theme = TestBed.inject(ThemeService);
    theme.setMode('dark');
    expect(document.documentElement.getAttribute('data-color-scheme')).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(theme.isDark()).toBe(true);
  });

  it('cycle goes auto -> light -> dark -> auto', () => {
    const theme = TestBed.inject(ThemeService);
    theme.cycle(); expect(theme.mode()).toBe('light');
    theme.cycle(); expect(theme.mode()).toBe('dark');
    theme.cycle(); expect(theme.mode()).toBe('auto');
  });
});
```

`frontend/src/app/core/theme/theme.service.ts`:
```ts
import { Injectable, computed, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'auto';
const ORDER: ThemeMode[] = ['auto', 'light', 'dark'];

/**
 * Material's theme uses light-dark(); flipping `color-scheme` on <html> is all
 * that is needed. 'auto' follows the OS.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _mode = signal<ThemeMode>(ThemeService.stored());
  readonly mode = this._mode.asReadonly();

  private readonly systemDark = signal(window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  readonly isDark = computed(() => this._mode() === 'dark' || (this._mode() === 'auto' && this.systemDark()));

  constructor() {
    this.apply(this._mode());
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', e => this.systemDark.set(e.matches));
  }

  private static stored(): ThemeMode {
    const v = localStorage.getItem('theme');
    return v === 'light' || v === 'dark' ? v : 'auto';
  }

  setMode(mode: ThemeMode) {
    this._mode.set(mode);
    if (mode === 'auto') localStorage.removeItem('theme'); else localStorage.setItem('theme', mode);
    this.apply(mode);
  }

  cycle() {
    this.setMode(ORDER[(ORDER.indexOf(this._mode()) + 1) % ORDER.length]);
  }

  /** Kept for the legacy toolbar until Task 7 replaces it. */
  toggle() { this.setMode(this.isDark() ? 'light' : 'dark'); }
  readonly dark = this.isDark;

  private apply(mode: ThemeMode) {
    const scheme = mode === 'auto' ? 'light dark' : mode;
    const html = document.documentElement;
    // The CSS property drives Material's light-dark(); the attribute mirrors it (jsdom drops unknown style props).
    html.style.setProperty('color-scheme', scheme);
    html.setAttribute('data-color-scheme', scheme);
    // Legacy stylesheet still keys off this attribute until P1e removes it.
    html.setAttribute('data-theme', this.isDark() ? 'dark' : 'light');
  }
}
```

- [ ] **Step 3: ToastService spec + implementation**

`frontend/src/app/core/ui/toast.service.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  it('opens a snackbar with the right panel class and calls onAction', () => {
    const onAction = new Subject<void>();
    const ref = { onAction: () => onAction.asObservable() } as unknown as MatSnackBarRef<TextOnlySnackBar>;
    const snack = { open: vi.fn(() => ref) };
    TestBed.configureTestingModule({ providers: [{ provide: MatSnackBar, useValue: snack }] });

    const toast = TestBed.inject(ToastService);
    const handler = vi.fn();
    toast.error('Boom', { action: 'Retry', onAction: handler });

    expect(snack.open).toHaveBeenCalledWith('Boom', 'Retry', expect.objectContaining({ panelClass: 'qs-toast-error', duration: 6000 }));
    onAction.next();
    expect(handler).toHaveBeenCalled();
  });

  it('success uses the default duration', () => {
    const ref = { onAction: () => new Subject<void>() } as unknown as MatSnackBarRef<TextOnlySnackBar>;
    const snack = { open: vi.fn(() => ref) };
    TestBed.configureTestingModule({ providers: [{ provide: MatSnackBar, useValue: snack }] });
    TestBed.inject(ToastService).success('Saved');
    expect(snack.open).toHaveBeenCalledWith('Saved', undefined, expect.objectContaining({ panelClass: 'qs-toast-success', duration: 4000 }));
  });
});
```

`frontend/src/app/core/ui/toast.service.ts`:
```ts
import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface ToastOptions {
  action?: string;
  onAction?: () => void;
  duration?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly snack = inject(MatSnackBar);

  success(message: string, opts: ToastOptions = {}) { this.show(message, 'qs-toast-success', 4000, opts); }
  info(message: string, opts: ToastOptions = {})    { this.show(message, 'qs-toast-info', 4000, opts); }
  error(message: string, opts: ToastOptions = {})   { this.show(message, 'qs-toast-error', 6000, opts); }

  private show(message: string, panelClass: string, defaultDuration: number, opts: ToastOptions) {
    const ref = this.snack.open(message, opts.action, {
      panelClass,
      duration: opts.duration ?? defaultDuration,
      politeness: panelClass === 'qs-toast-error' ? 'assertive' : 'polite'
    });
    if (opts.onAction) ref.onAction().subscribe(opts.onAction);
  }
}
```

Append to `frontend/src/styles/_base.scss`:
```scss
.qs-toast-error   { --mat-snack-bar-container-color: var(--mat-sys-error-container); --mat-snack-bar-supporting-text-color: var(--mat-sys-on-error-container); --mat-snack-bar-button-color: var(--mat-sys-on-error-container); }
.qs-toast-success { --mat-snack-bar-container-color: var(--mat-sys-primary-container); --mat-snack-bar-supporting-text-color: var(--mat-sys-on-primary-container); --mat-snack-bar-button-color: var(--mat-sys-on-primary-container); }
```

- [ ] **Step 4: Confirm dialog component + service + spec**

`frontend/src/app/core/ui/confirm-dialog.component.ts`:
```ts
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '../i18n/translate.pipe';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** When true the dialog resolves with the entered password instead of `true`. */
  requirePassword?: boolean;
}

@Component({
  selector: 'qs-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, FormsModule, TranslatePipe],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
      @if (data.requirePassword) {
        <mat-form-field style="width:100%">
          <mat-label>{{ 'login.password' | translate }}</mat-label>
          <input matInput type="password" autocomplete="current-password"
                 [ngModel]="password()" (ngModelChange)="password.set($event)" (keydown.enter)="confirm()">
        </mat-form-field>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton (click)="ref.close(false)">{{ data.cancelLabel ?? ('cancel' | translate) }}</button>
      <button matButton="filled" [class.qs-destructive]="data.destructive" cdkFocusInitial
              [disabled]="data.requirePassword && !password()" (click)="confirm()">
        {{ data.confirmLabel ?? ('delete' | translate) }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .qs-destructive { --mat-button-filled-container-color: var(--mat-sys-error); --mat-button-filled-label-text-color: var(--mat-sys-on-error); }
  `]
})
export class ConfirmDialogComponent {
  readonly data = inject<ConfirmOptions>(MAT_DIALOG_DATA);
  readonly ref = inject<MatDialogRef<ConfirmDialogComponent, boolean | string>>(MatDialogRef);
  readonly password = signal('');

  confirm() {
    if (this.data.requirePassword) {
      if (!this.password()) return;
      this.ref.close(this.password());
    } else {
      this.ref.close(true);
    }
  }
}
```
`frontend/src/app/core/ui/confirm-dialog.service.ts`:
```ts
import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogComponent, ConfirmOptions } from './confirm-dialog.component';

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly dialog = inject(MatDialog);

  /** Resolves `true` (or the password when `requirePassword`) on confirm, `false` on cancel/escape. */
  async confirm(opts: ConfirmOptions): Promise<boolean | string> {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmOptions, boolean | string | undefined>(ConfirmDialogComponent, {
      data: opts, width: '420px', maxWidth: '95vw', autoFocus: opts.requirePassword ? 'input' : 'dialog', restoreFocus: true
    });
    return (await firstValueFrom(ref.afterClosed())) ?? false;
  }
}
```

`frontend/src/app/core/ui/confirm-dialog.service.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialogService } from './confirm-dialog.service';

describe('ConfirmDialogService', () => {
  function withResult(result: unknown) {
    const dialog = { open: vi.fn(() => ({ afterClosed: () => of(result) })) };
    TestBed.configureTestingModule({ providers: [{ provide: MatDialog, useValue: dialog }] });
    return { service: TestBed.inject(ConfirmDialogService), dialog };
  }

  it('resolves true on confirm', async () => {
    const { service } = withResult(true);
    await expect(service.confirm({ title: 'T', message: 'M' })).resolves.toBe(true);
  });

  it('resolves false when dismissed without a value', async () => {
    const { service } = withResult(undefined);
    await expect(service.confirm({ title: 'T', message: 'M' })).resolves.toBe(false);
  });

  it('resolves the password when required', async () => {
    const { service, dialog } = withResult('hunter2');
    await expect(service.confirm({ title: 'T', message: 'M', requirePassword: true })).resolves.toBe('hunter2');
    expect(dialog.open).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ data: expect.objectContaining({ requirePassword: true }) }));
  });
});
```

- [ ] **Step 5: Pending requests service + interceptor + spec**

`frontend/src/app/core/ui/pending-requests.service.ts`:
```ts
import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PendingRequestsService {
  private readonly _count = signal(0);
  readonly count = this._count.asReadonly();
  readonly busy = computed(() => this._count() > 0);

  start() { this._count.update(n => n + 1); }
  end()   { this._count.update(n => Math.max(0, n - 1)); }
}
```

`frontend/src/app/core/ui/pending.interceptor.ts`:
```ts
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { PendingRequestsService } from './pending-requests.service';

export const pendingInterceptor: HttpInterceptorFn = (req, next) => {
  const pending = inject(PendingRequestsService);
  pending.start();
  return next(req).pipe(finalize(() => pending.end()));
};
```

`frontend/src/app/core/ui/pending.interceptor.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, expect, it } from 'vitest';
import { pendingInterceptor } from './pending.interceptor';
import { PendingRequestsService } from './pending-requests.service';

describe('pendingInterceptor', () => {
  it('counts in-flight requests and returns to zero on error too', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([pendingInterceptor])), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpClient);
    const ctrl = TestBed.inject(HttpTestingController);
    const pending = TestBed.inject(PendingRequestsService);

    http.get('/a').subscribe();
    http.get('/b').subscribe({ error: () => {} });
    expect(pending.count()).toBe(2);

    ctrl.expectOne('/a').flush({});
    expect(pending.count()).toBe(1);
    ctrl.expectOne('/b').flush('x', { status: 500, statusText: 'err' });
    expect(pending.busy()).toBe(false);
  });
});
```

- [ ] **Step 6: ProblemDetails helpers + spec**

`frontend/src/app/core/api/problem-details.ts`:
```ts
import { HttpErrorResponse } from '@angular/common/http';

export interface ProblemDetails { type?: string; title?: string; status?: number; detail?: string; }
export interface ValidationProblemDetails extends ProblemDetails { errors: Record<string, string[]>; }

export function isProblem(x: unknown): x is ProblemDetails {
  return typeof x === 'object' && x !== null && ('title' in x || 'status' in x || 'detail' in x);
}

export function isValidationProblem(x: unknown): x is ValidationProblemDetails {
  return isProblem(x) && typeof (x as ValidationProblemDetails).errors === 'object' && (x as ValidationProblemDetails).errors !== null;
}

/** Best human-readable message from an HTTP error, else the fallback. */
export function problemMessage(err: unknown, fallback: string): string {
  const body = err instanceof HttpErrorResponse ? err.error : err;
  if (isValidationProblem(body)) {
    const first = Object.values(body.errors).flat()[0];
    if (first) return first;
  }
  if (isProblem(body)) return body.detail ?? body.title ?? fallback;
  return fallback;
}
```

`frontend/src/app/core/api/problem-details.spec.ts`:
```ts
import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { isValidationProblem, problemMessage } from './problem-details';

describe('problem-details', () => {
  it('prefers detail, then title, then fallback', () => {
    expect(problemMessage(new HttpErrorResponse({ error: { status: 409, title: 'Conflict', detail: 'Name taken' } }), 'x')).toBe('Name taken');
    expect(problemMessage(new HttpErrorResponse({ error: { status: 404, title: 'Not Found' } }), 'x')).toBe('Not Found');
    expect(problemMessage(new HttpErrorResponse({ error: 'html garbage' }), 'fallback')).toBe('fallback');
  });

  it('surfaces the first validation message', () => {
    const err = new HttpErrorResponse({ error: { status: 400, title: 'v', errors: { firstName: ['Required.'] } } });
    expect(isValidationProblem(err.error)).toBe(true);
    expect(problemMessage(err, 'x')).toBe('Required.');
  });
});
```

- [ ] **Step 7: Error interceptor rewrite + spec**

`frontend/src/app/core/error.interceptor.ts`:
```ts
import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth/auth.service';
import { I18nService } from './i18n/i18n.service';
import { ToastService } from './ui/toast.service';
import { problemMessage } from './api/problem-details';

/** Refreshing on a 401 from these would loop. */
const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

function isAuthEndpoint(req: HttpRequest<unknown>): boolean {
  return AUTH_ENDPOINTS.some(path => req.url.includes(path));
}

/**
 * 401: one shared refresh then replay, else end the session (returnUrl kept).
 * 403: toast. 5xx / network: toast. 400/404/409 are rethrown for the caller
 * (forms map validation errors; resources show not-found views).
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);
  const toast = inject(ToastService);
  const i18n = inject(I18nService);

  const endSession = () => {
    auth.clear();
    void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
  };

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        if (isAuthEndpoint(req) || !auth.isAuthenticated()) {
          if (!isAuthEndpoint(req)) endSession();
          return throwError(() => err);
        }
        return auth.refreshSession().pipe(
          switchMap(session => next(req.clone({ setHeaders: { Authorization: `Bearer ${session.accessToken}` } }))),
          catchError(refreshErr => { endSession(); return throwError(() => refreshErr); })
        );
      }
      if (err.status === 403) toast.error(problemMessage(err, i18n.t('err.forbidden')));
      else if (err.status === 0 || err.status >= 500) toast.error(problemMessage(err, i18n.t('err.server')));
      return throwError(() => err);
    })
  );
};
```

Add these keys to `frontend/public/assets/i18n/en.json` and `de.json` (keep alphabetical order) and rerun `npm run gen:i18n --prefix frontend`:
```json
"err.forbidden": "You don't have access to that.",
"err.server": "Something went wrong on the server. Please try again."
```
```json
"err.forbidden": "Dafür hast du keine Berechtigung.",
"err.server": "Auf dem Server ist ein Fehler aufgetreten. Bitte erneut versuchen."
```

`frontend/src/app/core/error.interceptor.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { errorInterceptor } from './error.interceptor';
import { AuthService } from './auth/auth.service';
import { ToastService } from './ui/toast.service';
import { I18nService } from './i18n/i18n.service';

function setup(auth: Partial<AuthService>) {
  const toast = { error: vi.fn(), success: vi.fn(), info: vi.fn() };
  const router = { navigate: vi.fn(), url: '/trees/1' };
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting(),
      { provide: AuthService, useValue: { isAuthenticated: () => true, clear: vi.fn(), refreshSession: vi.fn(), ...auth } },
      { provide: ToastService, useValue: toast },
      { provide: Router, useValue: router },
      { provide: I18nService, useValue: { t: (k: string) => k } }
    ]
  });
  return { http: TestBed.inject(HttpClient), ctrl: TestBed.inject(HttpTestingController), toast, router, auth: TestBed.inject(AuthService) };
}

describe('errorInterceptor', () => {
  it('refreshes once on 401 and replays with the new token', () => {
    const { http, ctrl, auth } = setup({ refreshSession: vi.fn(() => of({ accessToken: 'new' } as never)) });
    let body: unknown;
    http.get('/api/v1/trees').subscribe(b => (body = b));
    ctrl.expectOne('/api/v1/trees').flush('', { status: 401, statusText: 'u' });
    const replay = ctrl.expectOne('/api/v1/trees');
    expect(replay.request.headers.get('Authorization')).toBe('Bearer new');
    replay.flush([]);
    expect(body).toEqual([]);
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('ends the session with returnUrl when refresh fails', () => {
    const { http, ctrl, auth, router } = setup({ refreshSession: vi.fn(() => throwError(() => new Error('nope'))) });
    http.get('/api/v1/trees').subscribe({ error: () => {} });
    ctrl.expectOne('/api/v1/trees').flush('', { status: 401, statusText: 'u' });
    expect(auth.clear).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/trees/1' } });
  });

  it('toasts on 403 and 5xx but rethrows 400', () => {
    const { http, ctrl, toast } = setup({});
    http.get('/a').subscribe({ error: () => {} });
    ctrl.expectOne('/a').flush({ title: 'Forbidden', status: 403 }, { status: 403, statusText: 'f' });
    http.get('/b').subscribe({ error: () => {} });
    ctrl.expectOne('/b').flush({ title: 'Internal server error.', status: 500 }, { status: 500, statusText: 's' });
    let caught: unknown;
    http.get('/c').subscribe({ error: e => (caught = e) });
    ctrl.expectOne('/c').flush({ status: 400, errors: { x: ['bad'] } }, { status: 400, statusText: 'b' });
    expect(toast.error).toHaveBeenCalledTimes(2);
    expect(toast.error).toHaveBeenNthCalledWith(1, 'Forbidden');
    expect(caught).toBeDefined();
  });
});
```

- [ ] **Step 8: Form helpers + specs**

`frontend/src/app/core/forms/server-errors.ts`:
```ts
import { FormGroup } from '@angular/forms';
import { ValidationProblemDetails } from '../api/problem-details';

/**
 * Applies `errors: { "birth.year": ["..."] }` onto matching controls as
 * `{ server: string }`. Returns messages for fields the form doesn't have.
 */
export function setServerErrors(form: FormGroup, problem: ValidationProblemDetails): string[] {
  const unmatched: string[] = [];
  for (const [path, messages] of Object.entries(problem.errors)) {
    const control = form.get(path.split('.'));
    if (control) {
      control.setErrors({ ...(control.errors ?? {}), server: messages.join(' ') });
      control.markAsTouched();
    } else {
      unmatched.push(...messages);
    }
  }
  return unmatched;
}
```

`frontend/src/app/core/forms/form-errors.pipe.ts`:
```ts
import { Pipe, PipeTransform, inject } from '@angular/core';
import { ValidationErrors } from '@angular/forms';
import { I18nService } from '../i18n/i18n.service';

/** `control.errors | formErrors` -> first human message, '' when valid. */
@Pipe({ name: 'formErrors', standalone: true, pure: false })
export class FormErrorsPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(errors: ValidationErrors | null | undefined): string {
    if (!errors) return '';
    if (typeof errors['server'] === 'string') return errors['server'];
    if (errors['required']) return this.i18n.t('form.required');
    if (errors['email']) return this.i18n.t('form.email');
    if (errors['minlength']) return this.i18n.t('form.minlength').replace('{n}', String(errors['minlength'].requiredLength));
    if (errors['maxlength']) return this.i18n.t('form.maxlength').replace('{n}', String(errors['maxlength'].requiredLength));
    if (errors['min'] || errors['max']) return this.i18n.t('form.range');
    return this.i18n.t('form.invalid');
  }
}
```

Add keys (en / de) and rerun `npm run gen:i18n --prefix frontend`:
```json
"form.required": "Required.",
"form.email": "Enter a valid email address.",
"form.minlength": "At least {n} characters.",
"form.maxlength": "At most {n} characters.",
"form.range": "Out of range.",
"form.invalid": "Invalid value."
```
```json
"form.required": "Pflichtfeld.",
"form.email": "Bitte eine gültige E-Mail-Adresse eingeben.",
"form.minlength": "Mindestens {n} Zeichen.",
"form.maxlength": "Höchstens {n} Zeichen.",
"form.range": "Außerhalb des gültigen Bereichs.",
"form.invalid": "Ungültiger Wert."
```

`frontend/src/app/core/forms/forms.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { setServerErrors } from './server-errors';
import { FormErrorsPipe } from './form-errors.pipe';
import { I18nService } from '../i18n/i18n.service';

describe('setServerErrors', () => {
  it('maps nested paths onto controls and returns unmatched messages', () => {
    const form = new FormGroup({
      firstName: new FormControl(''),
      birth: new FormGroup({ year: new FormControl(0) })
    });
    const unmatched = setServerErrors(form, { status: 400, errors: { 'firstName': ['Required.'], 'birth.year': ['Too early.'], 'ghost': ['?'] } });
    expect(form.get('firstName')!.errors).toEqual({ server: 'Required.' });
    expect(form.get(['birth', 'year'])!.errors).toEqual({ server: 'Too early.' });
    expect(unmatched).toEqual(['?']);
  });
});

describe('FormErrorsPipe', () => {
  it('prefers server text, then translates built-in validators', () => {
    TestBed.configureTestingModule({ providers: [{ provide: I18nService, useValue: { t: (k: string) => k } }] });
    const pipe = TestBed.runInInjectionContext(() => new FormErrorsPipe());
    expect(pipe.transform({ server: 'Taken', required: true })).toBe('Taken');
    expect(pipe.transform({ required: true })).toBe('form.required');
    expect(pipe.transform({ minlength: { requiredLength: 8, actualLength: 3 } })).toBe('form.minlength'.replace('{n}', '8'));
    const c = new FormControl('', Validators.required);
    expect(pipe.transform(c.errors)).toBe('form.required');
    expect(pipe.transform(null)).toBe('');
  });
});
```

- [ ] **Step 9: Person helpers + spec**

`frontend/src/app/core/models/person-helpers.ts`:
```ts
import { PartialDate, Sex } from '../api/generated';

export interface PersonLike {
  firstName: string;
  lastName: string;
  maidenName?: string | null;
  birth?: PartialDate | null;
  death?: PartialDate | null;
  sex?: Sex | null;
}

export function fullName(p: PersonLike): string {
  return `${p.firstName} ${p.lastName}`.trim();
}

export function initials(p: PersonLike): string {
  return ((p.firstName?.[0] ?? '') + (p.lastName?.[0] ?? '')).toUpperCase();
}

/** "1843 – 1909", "* 1843", "† 1909" or "" when nothing is known. */
export function lifespan(p: PersonLike): string {
  const b = p.birth?.year, d = p.death?.year;
  if (b && d) return `${b} – ${d}`;
  if (b) return `* ${b}`;
  if (d) return `† ${d}`;
  return '';
}

export function sexClass(sex: Sex | null | undefined): 'male' | 'female' | 'unknown' {
  return sex === 'Male' ? 'male' : sex === 'Female' ? 'female' : 'unknown';
}
```

`frontend/src/app/core/models/person-helpers.spec.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { fullName, initials, lifespan, sexClass } from './person-helpers';

describe('person helpers', () => {
  const p = { firstName: 'Konrad', lastName: 'Smith', birth: { year: 1843 }, death: { year: 1909 }, sex: 'Male' as const };
  it('fullName / initials', () => {
    expect(fullName(p)).toBe('Konrad Smith');
    expect(initials(p)).toBe('KS');
    expect(initials({ firstName: '', lastName: 'x' })).toBe('X');
  });
  it('lifespan variants', () => {
    expect(lifespan(p)).toBe('1843 – 1909');
    expect(lifespan({ ...p, death: null })).toBe('* 1843');
    expect(lifespan({ ...p, birth: undefined })).toBe('† 1909');
    expect(lifespan({ firstName: 'a', lastName: 'b' })).toBe('');
  });
  it('sexClass', () => {
    expect(sexClass('Female')).toBe('female');
    expect(sexClass(undefined)).toBe('unknown');
  });
});
```

- [ ] **Step 10: Register the pending interceptor**

In `frontend/src/app/app.config.ts`: import `pendingInterceptor` from `'./core/ui/pending.interceptor'` and change the HTTP provider to
```ts
    provideHttpClient(withInterceptors([pendingInterceptor, authInterceptor, errorInterceptor])),
```

- [ ] **Step 11: Run everything**

Run: `timeout 180 npx --prefix frontend ng test --watch=false 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "Tests |Test Files|error TS|×"`
Expected: `Test Files  14 passed (14)` / `Tests  62 passed (62)`. No `×`.

Run: `npx --prefix frontend ng build --configuration production 2>&1 | grep -E "complete|error"`
Expected: `Application bundle generation complete`.

- [ ] **Step 12: Commit**

```bash
git add frontend
git commit -m "feat(core): layout/theme/toast/confirm/pending services, ProblemDetails-aware error interceptor, form helpers"
```

---

### Task 7: App shell

**Files:**
- Create: `frontend/src/app/core/ui/breadcrumb.service.ts` + spec
- Modify: `frontend/src/app/app.routes.ts` (route `data.layout`, `data.title`)
- Modify: `frontend/src/app/app.ts` (rewrite)
- Create: `frontend/src/app/app.spec.ts`
- Modify: `frontend/src/app/core/auth/auth.guard.ts` (returnUrl)

**Interfaces:**
- `BreadcrumbService { crumbs: Signal<Crumb[]>; set(crumbs: Crumb[]) }` with `Crumb { label: string; link?: unknown[] }`. Screens call `set([...])` in `ngOnInit`; the shell renders them. Reset to `[]` on every navigation start.
- Route data: `{ layout: 'auth' | 'app' }`; default `'app'`.

- [ ] **Step 1: BreadcrumbService spec + implementation**

`frontend/src/app/core/ui/breadcrumb.service.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { BreadcrumbService } from './breadcrumb.service';

describe('BreadcrumbService', () => {
  it('holds crumbs and clears them when navigation starts', () => {
    const events = new Subject<unknown>();
    TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: { events } }] });
    const svc = TestBed.inject(BreadcrumbService);
    svc.set([{ label: 'Trees', link: ['/trees'] }, { label: 'Familie' }]);
    expect(svc.crumbs().map(c => c.label)).toEqual(['Trees', 'Familie']);
    events.next(new NavigationStart(1, '/x'));
    expect(svc.crumbs()).toEqual([]);
  });
});
```

`frontend/src/app/core/ui/breadcrumb.service.ts`:
```ts
import { Injectable, inject, signal } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';

export interface Crumb { label: string; link?: unknown[]; }

@Injectable({ providedIn: 'root' })
export class BreadcrumbService {
  private readonly _crumbs = signal<Crumb[]>([]);
  readonly crumbs = this._crumbs.asReadonly();

  constructor() {
    inject(Router).events.pipe(filter(e => e instanceof NavigationStart)).subscribe(() => this._crumbs.set([]));
  }

  set(crumbs: Crumb[]) { this._crumbs.set(crumbs); }
}
```

- [ ] **Step 2: Routes with layout data**

`frontend/src/app/app.routes.ts`:
```ts
import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/trees', pathMatch: 'full' },
  { path: 'login',    data: { layout: 'auth' }, loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent) },
  { path: 'register', data: { layout: 'auth' }, loadComponent: () => import('./features/auth/register.component').then(m => m.RegisterComponent) },
  { path: 'trees', canActivate: [authGuard],
    loadComponent: () => import('./features/trees/tree-list.component').then(m => m.TreeListComponent) },
  { path: 'trees/:treeId', canActivate: [authGuard], data: { fullBleed: true },
    loadComponent: () => import('./features/trees/tree-view/tree-view.component').then(m => m.TreeViewComponent) },
  { path: 'trees/:treeId/persons/new', canActivate: [authGuard],
    loadComponent: () => import('./features/persons/person-edit.component').then(m => m.PersonEditComponent) },
  { path: 'trees/:treeId/import', canActivate: [authGuard],
    loadComponent: () => import('./features/import/import-text.component').then(m => m.ImportTextComponent) },
  { path: 'trees/:treeId/search', canActivate: [authGuard],
    loadComponent: () => import('./features/trees/tree-search.component').then(m => m.TreeSearchComponent) },
  { path: 'persons/:id', canActivate: [authGuard],
    loadComponent: () => import('./features/persons/person-detail.component').then(m => m.PersonDetailComponent) },
  { path: 'persons/:id/edit', canActivate: [authGuard],
    loadComponent: () => import('./features/persons/person-edit.component').then(m => m.PersonEditComponent) },
  { path: 'settings', canActivate: [authGuard],
    loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent) },
  { path: 'admin/users', canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/admin-users.component').then(m => m.AdminUsersComponent) },
  { path: '**', redirectTo: '/trees' }
];
```

- [ ] **Step 3: Guard keeps the return url**

`frontend/src/app/core/auth/auth.guard.ts`:
```ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated()) return true;
  return inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated() && auth.isAdmin()) return true;
  const router = inject(Router);
  return auth.isAuthenticated()
    ? router.createUrlTree(['/trees'])
    : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
```

- [ ] **Step 4: Rewrite the shell**

`frontend/src/app/app.ts`:
```ts
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterLink, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter } from 'rxjs';
import { AuthService } from './core/auth/auth.service';
import { ThemeService } from './core/theme/theme.service';
import { I18nService, Lang } from './core/i18n/i18n.service';
import { TranslatePipe } from './core/i18n/translate.pipe';
import { PendingRequestsService } from './core/ui/pending-requests.service';
import { BreadcrumbService } from './core/ui/breadcrumb.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, MatToolbarModule, MatButtonModule, MatIconModule, MatMenuModule,
            MatProgressBarModule, MatDividerModule, MatTooltipModule, TranslatePipe],
  template: `
    <a class="qs-skip-link" href="#main">{{ 'nav.skip' | translate }}</a>

    @if (layout() === 'app') {
      <mat-toolbar class="qs-toolbar">
        <a class="qs-brand" routerLink="/trees" aria-label="Qseng">
          <mat-icon aria-hidden="true">park</mat-icon>
          <span class="qs-display">Qseng</span>
        </a>

        <nav class="qs-crumbs" aria-label="Breadcrumb">
          @for (c of crumbs.crumbs(); track $index; let last = $last) {
            <mat-icon class="qs-crumbs__sep" aria-hidden="true">chevron_right</mat-icon>
            @if (c.link && !last) {
              <a [routerLink]="c.link" class="qs-crumbs__item">{{ c.label }}</a>
            } @else {
              <span class="qs-crumbs__item qs-crumbs__item--current" aria-current="page">{{ c.label }}</span>
            }
          }
        </nav>

        <span class="qs-spacer"></span>

        <button matIconButton (click)="theme.cycle()" [matTooltip]="themeLabel()" [attr.aria-label]="themeLabel()">
          <mat-icon>{{ themeIcon() }}</mat-icon>
        </button>

        <button matButton [matMenuTriggerFor]="userMenu" class="qs-user" aria-haspopup="menu">
          <span class="qs-user__avatar" aria-hidden="true">{{ initials() }}</span>
          <span class="qs-user__name">{{ auth.displayName() }}</span>
          <mat-icon aria-hidden="true">expand_more</mat-icon>
        </button>
        <mat-menu #userMenu="matMenu" xPosition="before">
          <div class="qs-menu-header">
            <div class="qs-menu-header__name">{{ auth.displayName() }}</div>
            <div class="qs-muted">&#64;{{ auth.username() }}</div>
          </div>
          <mat-divider />
          <a mat-menu-item routerLink="/settings"><mat-icon>settings</mat-icon>{{ 'nav.settings' | translate }}</a>
          @if (auth.isAdmin()) {
            <a mat-menu-item routerLink="/admin/users"><mat-icon>group</mat-icon>{{ 'nav.users' | translate }}</a>
          }
          <mat-divider />
          <button mat-menu-item (click)="setLang('de')" [disabled]="i18n.lang() === 'de'"><mat-icon>{{ i18n.lang() === 'de' ? 'check' : '' }}</mat-icon>Deutsch</button>
          <button mat-menu-item (click)="setLang('en')" [disabled]="i18n.lang() === 'en'"><mat-icon>{{ i18n.lang() === 'en' ? 'check' : '' }}</mat-icon>English</button>
          <mat-divider />
          <button mat-menu-item (click)="logout()"><mat-icon>logout</mat-icon>{{ 'nav.logout' | translate }}</button>
        </mat-menu>
      </mat-toolbar>
      <mat-progress-bar class="qs-progress" mode="indeterminate" [class.qs-progress--on]="busy()" aria-hidden="true" />
    }

    <main id="main" tabindex="-1" [class.qs-main--app]="layout() === 'app'">
      <router-outlet />
    </main>
  `,
  styles: [`
    :host { display: block; min-height: 100%; }
    .qs-toolbar { position: sticky; top: 0; z-index: 100; height: var(--qs-toolbar-h); gap: 8px; background: var(--mat-sys-surface-container); border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .qs-brand { display: inline-flex; align-items: center; gap: 6px; color: var(--mat-sys-on-surface); font-size: 1.25rem; text-decoration: none; }
    .qs-brand mat-icon { color: var(--mat-sys-primary); }
    .qs-crumbs { display: flex; align-items: center; min-width: 0; font-size: .95rem; }
    .qs-crumbs__sep { color: var(--mat-sys-outline); }
    .qs-crumbs__item { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 32vw; color: var(--mat-sys-on-surface-variant); }
    .qs-crumbs__item--current { color: var(--mat-sys-on-surface); font-weight: 500; }
    .qs-spacer { flex: 1; }
    .qs-user { display: inline-flex; align-items: center; gap: 8px; }
    .qs-user__avatar { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: var(--mat-sys-primary); color: var(--mat-sys-on-primary); font-size: .75rem; font-weight: 600; }
    .qs-menu-header { padding: 8px 16px; }
    .qs-menu-header__name { font-weight: 500; }
    .qs-progress { position: sticky; top: var(--qs-toolbar-h); z-index: 99; opacity: 0; transition: opacity .15s; }
    .qs-progress--on { opacity: 1; }
    main:focus { outline: none; }
    @media (max-width: 599.98px) { .qs-user__name, .qs-crumbs { display: none; } }
  `]
})
export class App {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly i18n = inject(I18nService);
  readonly crumbs = inject(BreadcrumbService);
  private readonly pending = inject(PendingRequestsService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly navigating = signal(false);
  readonly layout = signal<'auth' | 'app'>('app');
  readonly busy = computed(() => this.navigating() || this.pending.busy());

  readonly themeIcon = computed(() => ({ auto: 'brightness_auto', light: 'light_mode', dark: 'dark_mode' })[this.theme.mode()]);
  readonly themeLabel = computed(() => this.i18n.t(({ auto: 'nav.theme.auto', light: 'nav.theme.light', dark: 'nav.theme.dark' } as const)[this.theme.mode()]));

  constructor() {
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(e => {
      if (e instanceof NavigationStart) this.navigating.set(true);
      if (e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError) {
        this.navigating.set(false);
        this.layout.set(this.deepestData()['layout'] === 'auth' ? 'auth' : 'app');
        queueMicrotask(() => (document.querySelector('main h1') as HTMLElement | null)?.focus?.());
      }
    });
  }

  private deepestData(): Record<string, unknown> {
    let route: ActivatedRoute | null = this.router.routerState.root;
    while (route?.firstChild) route = route.firstChild;
    return route?.snapshot.data ?? {};
  }

  initials(): string {
    const name = this.auth.displayName() ?? this.auth.username() ?? '?';
    return name.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();
  }

  setLang(lang: Lang) { this.i18n.setLang(lang); }

  logout() {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
```

Add keys (en / de) and rerun `npm run gen:i18n --prefix frontend`:
```json
"nav.skip": "Skip to content",
"nav.theme.auto": "Theme: follow system"
```
```json
"nav.skip": "Zum Inhalt springen",
"nav.theme.auto": "Design: wie System"
```
(`nav.theme.light` / `nav.theme.dark` already exist; their English strings currently read "Dark mode"/"Light mode" as toggle targets. Change them to describe the current state: en `"nav.theme.light": "Theme: light"`, `"nav.theme.dark": "Theme: dark"`; de `"Design: hell"`, `"Design: dunkel"`.)

Focusing an `h1` programmatically requires `tabindex="-1"` in some browsers. Legacy screens are left as they are; every new screen in P1b+ sets `tabindex="-1"` on its `h1`. Add to `frontend/src/styles/_base.scss`:
```scss
main h1 { outline: none; }
```

- [ ] **Step 5: Shell spec**

`frontend/src/app/app.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Component } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { AuthService } from './core/auth/auth.service';
import { I18nService } from './core/i18n/i18n.service';

@Component({ template: '<h1>page</h1>' }) class Dummy {}

function setup(authenticated: boolean) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'login', component: Dummy, data: { layout: 'auth' } },
        { path: 'trees', component: Dummy }
      ]),
      { provide: AuthService, useValue: { isAuthenticated: () => authenticated, isAdmin: () => false, displayName: () => 'Demo Admin', username: () => 'demo', logout: vi.fn() } },
      { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k, lang: () => 'en', setLang: vi.fn() } }
    ]
  });
  return TestBed.createComponent(App);
}

describe('App shell', () => {
  it('hides the toolbar on auth-layout routes even when a session exists', async () => {
    const fixture = setup(true);
    await TestBed.inject(Router).navigateByUrl('/login');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('mat-toolbar')).toBeNull();
  });

  it('shows toolbar, brand and user initials on app routes', async () => {
    const fixture = setup(true);
    await TestBed.inject(Router).navigateByUrl('/trees');
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('mat-toolbar')).not.toBeNull();
    expect(el.querySelector('.qs-user__avatar')?.textContent?.trim()).toBe('DA');
  });
});
```

- [ ] **Step 6: Run tests, build, visual check**

Run: `timeout 180 npx --prefix frontend ng test --watch=false 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "Tests |Test Files|×|error TS"`
Expected: `Test Files  16 passed (16)` / `Tests  65 passed (65)`, no `×`.

Run: `npx --prefix frontend ng build --configuration production 2>&1 | grep -E "complete|error|exceeded"`
Expected: `Application bundle generation complete`, no `exceeded`.

Start API + frontend as in Task 3 Step 11, log in as `demo` / `Demo123!` via Playwright, screenshot `/trees`, `/trees/<id>`, `/login` (after logout) at 1400px and 400px to the scratchpad. Expected: toolbar with wordmark, theme icon and avatar menu on app routes; no toolbar on `/login`; progress bar flashes during navigation; legacy screens still render below the toolbar. Stop both processes.

- [ ] **Step 7: Commit**

```bash
git add frontend
git commit -m "feat(shell): Material toolbar with breadcrumbs, theme cycle, user menu, progress bar; auth routes without chrome"
```

---

### Task 8: Lint baseline

**Files:**
- Create: `frontend/eslint.config.js` (via schematic)
- Modify: `frontend/angular.json` (lint target), `frontend/package.json`

- [ ] **Step 1: Add angular-eslint**

```bash
npx --prefix frontend ng add angular-eslint@21 --skip-confirmation
```
Expected: `frontend/eslint.config.js` created, `lint` target in `angular.json`, `"lint": "ng lint"` script.

- [ ] **Step 2: Ignore generated code**

In `frontend/eslint.config.js` add at the top of the exported array:
```js
  { ignores: ['src/app/core/api/generated/**', 'dist/**', '.angular/**'] },
```

- [ ] **Step 3: Run lint and fix only new code**

Run: `npx --prefix frontend ng lint 2>&1 | tail -20`
Expected: zero errors in `core/**`, `app.ts`, `app.config.ts`, `app.routes.ts`, `test-setup.ts`, `styles/**`. Warnings/errors confined to `features/**` are acceptable in this plan (those files are rewritten in P1b–P1d); if any error is in a file outside `features/**`, fix it.

- [ ] **Step 4: Commit**

```bash
git add frontend
git commit -m "chore(frontend): angular-eslint baseline"
```

---

## Verification before hand-off

- `dotnet test backend/Qseng.slnx` green (Domain 13, Application 49, Api 8).
- `contracts/openapi.json` committed and `npm run gen:api --prefix frontend` reproduces the client without diff in the spec.
- `timeout 180 npx --prefix frontend ng test --watch=false` green.
- `ng build --configuration production` under budget.
- App boots, login works, legacy screens render under the new toolbar in light and dark.
- Screenshots in scratchpad reviewed at 1400 and 400 px.

## Next plans (written after this one lands)

- P1b: auth, trees, settings, admin screens on Material (uses `AuthApi`, `TreesApi`, `UserApi`, `AdminApi`, `ConfirmDialogService`, `ToastService`, typed forms).
- P1c: person detail, edit, timeline, media, relationship dialog, `PartialDateInput` CVA, `PersonStore`.
- P1d: tree view + graph (`TreeStore`, node SVG renderer, sidenav/bottom-sheet layout, context menu).
- P1e: delete `ApiClient`, `_legacy.scss`, old components; grep gates; Lighthouse; screenshots; budget check.
