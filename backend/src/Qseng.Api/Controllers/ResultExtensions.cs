using Microsoft.AspNetCore.Mvc;
using Qseng.Application.Common;

namespace Qseng.Api.Controllers;

public static class ResultExtensions
{
    public static IActionResult ToActionResult<T>(this Result<T> result)
    {
        if (result.IsSuccess) return new OkObjectResult(result.Value);
        return result.StatusCode switch
        {
            404 => new NotFoundObjectResult(new { error = result.Error }),
            401 => new UnauthorizedObjectResult(new { error = result.Error }),
            409 => new ConflictObjectResult(new { error = result.Error }),
            403 => new ObjectResult(new { error = result.Error }) { StatusCode = 403 },
            _   => new BadRequestObjectResult(new { error = result.Error })
        };
    }
}
