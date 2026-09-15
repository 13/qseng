using FluentAssertions;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Qseng.Api.Health;
using Xunit;

namespace Qseng.Api.Tests;

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

    [Fact]
    public async Task Deleted_directory_is_reported_unhealthy_instead_of_silently_recreated()
    {
        // Minor 12: the check must not call Directory.CreateDirectory — an unmounted/deleted
        // uploads volume should surface as Unhealthy, not get silently recreated on the
        // container's writable layer.
        var dir = Directory.CreateTempSubdirectory().FullName;
        Directory.Delete(dir);

        var result = await new UploadsWritableCheck(dir).CheckHealthAsync(new HealthCheckContext(), CancellationToken.None);

        result.Status.Should().Be(HealthStatus.Unhealthy);
        Directory.Exists(dir).Should().BeFalse("the check must not recreate a missing directory");
    }
}
