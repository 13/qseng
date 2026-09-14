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
