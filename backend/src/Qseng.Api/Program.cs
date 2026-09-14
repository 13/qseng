using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Qseng.Application;
using Qseng.Application.Abstractions;
using Qseng.Api.Health;
using Qseng.Api.Middleware;
using Qseng.Api.Options;
using Qseng.Api.RateLimiting;
using Qseng.Infrastructure;
using Qseng.Infrastructure.Auth;
using Qseng.Infrastructure.Options;
using Qseng.Infrastructure.Persistence;
using Qseng.Infrastructure.Seeding;
using Serilog;
using Serilog.Events;

var builder = WebApplication.CreateBuilder(args);

Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .CreateLogger();

builder.Host.UseSerilog();

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
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "Qseng API", Version = "v1" });
    c.SupportNonNullableReferenceTypes();
    // Only controller actions; minimal endpoints (e.g. /api/v1/health) are not part of the client contract.
    c.DocInclusionPredicate((_, api) => api.ActionDescriptor is Microsoft.AspNetCore.Mvc.Controllers.ControllerActionDescriptor);
    // Stable, unique ids -> readable generated client methods (treesGetAll, personsCreate, ...).
    c.CustomOperationIds(api =>
        $"{api.ActionDescriptor.RouteValues["controller"]}_{api.ActionDescriptor.RouteValues["action"]}");
    c.AddSecurityDefinition("Bearer", new()
    {
        Name = "Authorization", Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "bearer", BearerFormat = "JWT", In = Microsoft.OpenApi.Models.ParameterLocation.Header
    });
    c.AddSecurityRequirement(new()
    {
        { new() { Reference = new() { Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme, Id = "Bearer" } }, [] }
    });
});

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUserService>();

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services
    .AddOptions<JwtOptions>()
    .Bind(builder.Configuration.GetSection(JwtOptions.SectionName))
    .ValidateOnStart();
builder.Services.AddSingleton<IValidateOptions<JwtOptions>>(
    new JwtOptionsValidator(builder.Environment.IsDevelopment()));

var jwt = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();

builder.Services.AddOptions<CorsOptions>().Bind(builder.Configuration.GetSection(CorsOptions.SectionName)).ValidateOnStart();
builder.Services.AddSingleton<IValidateOptions<CorsOptions>>(new CorsOptionsValidator(builder.Environment.IsDevelopment()));
var corsOrigins = (builder.Configuration.GetSection(CorsOptions.SectionName).Get<CorsOptions>() ?? new CorsOptions()).EffectiveOrigins(builder.Environment.IsDevelopment());

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
            ClockSkew = TimeSpan.FromSeconds(30)
        };

        // A valid signature is not authorization: the account may have been
        // deactivated, deleted, or had its sessions revoked since the token was
        // issued. Costs one indexed primary-key lookup per request.
        opt.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var principal = context.Principal!;
                var sub = principal.FindFirstValue(ClaimTypes.NameIdentifier)
                          ?? principal.FindFirstValue(JwtRegisteredClaimNames.Sub);
                if (!Guid.TryParse(sub, out var userId))
                {
                    context.Fail("Malformed subject claim.");
                    return;
                }

                var db = context.HttpContext.RequestServices.GetRequiredService<IQsengDbContext>();
                var user = await db.Users
                    .AsNoTracking()
                    .Where(u => u.Id == userId)
                    .Select(u => new { u.IsActive, u.TokenVersion })
                    .FirstOrDefaultAsync(context.HttpContext.RequestAborted);

                if (user is null || !user.IsActive)
                {
                    context.Fail("Account is inactive or no longer exists.");
                    return;
                }

                var rawVersion = principal.FindFirstValue(JwtTokenService.TokenVersionClaim);
                if (!int.TryParse(rawVersion, out var version) || version != user.TokenVersion)
                    context.Fail("Token has been revoked.");
            }
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddCors(opt => opt.AddDefaultPolicy(p => p.WithOrigins(corsOrigins).AllowAnyHeader().AllowAnyMethod()));

builder.Services.AddOptions<RateLimitingOptions>().Bind(builder.Configuration.GetSection(RateLimitingOptions.SectionName)).ValidateOnStart();
var rateLimiting = builder.Configuration.GetSection(RateLimitingOptions.SectionName).Get<RateLimitingOptions>() ?? new RateLimitingOptions();
builder.Services.AddRateLimiter(o => AuthRateLimitPolicy.Configure(o, rateLimiting.Auth));

// The docker image sits behind nginx, which sets X-Forwarded-For/-Proto; without this the
// per-IP rate limiter and any IP-based logic would only ever see the proxy's own address.
// KnownNetworks defaults to empty, which means only loopback proxies are trusted.
var knownNetworks = builder.Configuration.GetSection("ForwardedHeaders:KnownNetworks").Get<string[]>() ?? [];
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    foreach (var network in ForwardedHeadersSetup.Parse(knownNetworks))
        o.KnownIPNetworks.Add(network);
});

// Rooted once here (against ContentRootPath, same as the static-files block below) so the
// health check and the static file provider always agree on the same directory, however
// Uploads:Path is configured.
var uploadsPath = builder.Configuration["Uploads:Path"];
if (uploadsPath is null || !Path.IsPathRooted(uploadsPath))
    uploadsPath = Path.Combine(builder.Environment.ContentRootPath, uploadsPath ?? "uploads");

builder.Services.AddHealthChecks()
    .AddDbContextCheck<QsengDbContext>("database")
    .AddCheck("uploads", new UploadsWritableCheck(uploadsPath));

var app = builder.Build();

app.UseForwardedHeaders();

app.UseMiddleware<ExceptionMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

Directory.CreateDirectory(uploadsPath);

app.UseCors();
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsPath),
    RequestPath = "/uploads"
});
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.UseSerilogRequestLogging(o =>
{
    o.EnrichDiagnosticContext = (d, http) => d.Set("UserId", http.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "anonymous");
    o.GetLevel = (http, _, ex) => ex is not null || http.Response.StatusCode >= 500
        ? LogEventLevel.Error
        : http.Request.Path.StartsWithSegments("/health") ? LogEventLevel.Verbose : LogEventLevel.Information;
});

app.MapControllers();
app.MapGet("/api/v1/health", () => Results.Ok(new { status = "ok", timestamp = DateTime.UtcNow }));
app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false, ResponseWriter = HealthResponseWriter.WriteAsync }).AllowAnonymous();
app.MapHealthChecks("/health/ready", new HealthCheckOptions { ResponseWriter = HealthResponseWriter.WriteAsync }).AllowAnonymous();

using (var scope = app.Services.CreateScope())
{
    var seeder = scope.ServiceProvider.GetRequiredService<DbSeeder>();
    await seeder.SeedAsync();
}

app.Run();
