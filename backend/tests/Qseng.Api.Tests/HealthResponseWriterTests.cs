using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Qseng.Api;
using Qseng.Api.Health;
using Xunit;

public class HealthResponseWriterTests
{
    [Fact]
    public async Task Payload_carries_status_checks_version_and_commit()
    {
        var http = new DefaultHttpContext();
        http.Response.Body = new MemoryStream();
        var report = new HealthReport(
            new Dictionary<string, HealthReportEntry>
            {
                ["uploads"] = new(HealthStatus.Healthy, null, TimeSpan.FromMilliseconds(3), null, null)
            },
            TimeSpan.FromMilliseconds(3));

        await HealthResponseWriter.WriteAsync(http, report);

        http.Response.Body.Position = 0;
        using var doc = await JsonDocument.ParseAsync(http.Response.Body);
        var root = doc.RootElement;
        root.GetProperty("status").GetString().Should().Be("Healthy");
        root.GetProperty("version").GetString().Should().Be(AppVersion.Version);
        root.GetProperty("commit").GetString().Should().Be(AppVersion.Commit);
        root.GetProperty("checks").GetArrayLength().Should().Be(1);
        http.Response.ContentType.Should().Be("application/json");
    }
}
