using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
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
            var partitionKey = ctx.HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            var logger = ctx.HttpContext.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger(typeof(AuthRateLimitPolicy).FullName!);
            logger.LogWarning("Auth rate limit exceeded for {PartitionKey} on {Path}", partitionKey, ctx.HttpContext.Request.Path);
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
