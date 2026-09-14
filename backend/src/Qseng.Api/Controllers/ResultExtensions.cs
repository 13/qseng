using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Qseng.Application.Common;

namespace Qseng.Api.Controllers;

public static class ResultExtensions
{
    public static IActionResult ToActionResult<T>(this Result<T> result)
    {
        if (result.IsSuccess) return new OkObjectResult(result.Value);
        return Problem(result.StatusCode, result.Error);
    }

    /// <summary>RFC 7807 body for any failure status.</summary>
    public static ObjectResult Problem(int status, string? detail)
    {
        var problem = new ProblemDetails
        {
            Status = status,
            Title = ReasonPhrases.GetReasonPhrase(status),
            Detail = detail
        };
        return new ObjectResult(problem)
        {
            StatusCode = status,
            ContentTypes = { "application/problem+json" }
        };
    }
}
