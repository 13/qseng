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
}
