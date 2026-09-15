using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Qseng.Api.RateLimiting;
using Xunit;

namespace Qseng.Api.Tests;

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
