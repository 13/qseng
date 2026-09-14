using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Qseng.Api.Health;

/// <summary>Confirms the uploads directory exists and is writable by creating and deleting a probe file.</summary>
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
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy($"Uploads path '{_path}' is not writable.", ex);
        }
    }
}
