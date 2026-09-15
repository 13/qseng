using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Qseng.Api.Health;

/// <summary>Confirms the uploads directory exists and is writable by creating and deleting a probe
/// file. Deliberately does not create the directory itself — <c>Program.cs</c> already does that
/// once at startup; if a mounted uploads volume then goes missing (unmounted, deleted), silently
/// recreating it here would put it back on the container's writable layer and report Healthy
/// instead of surfacing the real problem.</summary>
public sealed class UploadsWritableCheck : IHealthCheck
{
    private readonly string _path;
    public UploadsWritableCheck(string path) => _path = path;

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct = default)
    {
        try
        {
            var probe = Path.Combine(_path, $".probe-{Guid.NewGuid():N}");
            await File.WriteAllTextAsync(probe, "ok", ct);
            File.Delete(probe);
            return HealthCheckResult.Healthy();
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy($"Uploads path '{_path}' is not writable.", ex);
        }
    }
}
