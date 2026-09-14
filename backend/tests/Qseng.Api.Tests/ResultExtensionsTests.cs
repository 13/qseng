using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Qseng.Api.Controllers;
using Qseng.Application.Common;
using Xunit;

namespace Qseng.Api.Tests;

public class ResultExtensionsTests
{
    [Fact]
    public void Success_returns_200_with_value()
    {
        var action = Result.Ok("hello").ToActionResult();

        var ok = action.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be("hello");
    }

    [Theory]
    [InlineData(400, "Bad Request")]
    [InlineData(401, "Unauthorized")]
    [InlineData(403, "Forbidden")]
    [InlineData(404, "Not Found")]
    [InlineData(409, "Conflict")]
    public void Failure_returns_problem_details_with_status_title_and_detail(int status, string title)
    {
        var action = Result.Fail<string>("it broke", status).ToActionResult();

        var obj = action.Should().BeOfType<ObjectResult>().Subject;
        obj.StatusCode.Should().Be(status);
        obj.ContentTypes.Should().Contain("application/problem+json");

        var problem = obj.Value.Should().BeOfType<ProblemDetails>().Subject;
        problem.Status.Should().Be(status);
        problem.Title.Should().Be(title);
        problem.Detail.Should().Be("it broke");
    }
}
