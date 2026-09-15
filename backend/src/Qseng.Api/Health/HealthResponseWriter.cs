using System.Text.Json;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Qseng.Api.Health;

/// <summary>Writes a <see cref="HealthReport"/> as a small, stable JSON shape for /health/* endpoints.</summary>
public static class HealthResponseWriter
{
    public static Task WriteAsync(HttpContext http, HealthReport report)
    {
        http.Response.ContentType = "application/json";
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
        return http.Response.WriteAsync(JsonSerializer.Serialize(payload));
    }
}
