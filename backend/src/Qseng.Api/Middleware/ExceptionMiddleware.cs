using System.Text.Json;
using FluentValidation;
using Microsoft.AspNetCore.Mvc;

namespace Qseng.Api.Middleware;

/// <summary>
/// Turns FluentValidation failures into <see cref="ValidationProblemDetails"/> (400)
/// and anything else into a generic <see cref="ProblemDetails"/> (500).
/// </summary>
public class ExceptionMiddleware
{
    private const string ProblemJson = "application/problem+json";

    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _log;

    public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> log)
    { _next = next; _log = log; }

    public async Task InvokeAsync(HttpContext ctx)
    {
        try
        {
            await _next(ctx);
        }
        catch (ValidationException vex)
        {
            var errors = vex.Errors
                .GroupBy(e => CamelCasePath(e.PropertyName))
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());

            var problem = new ValidationProblemDetails(errors)
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "One or more validation errors occurred."
            };
            await WriteAsync(ctx, problem);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Unhandled exception");
            var problem = new ProblemDetails
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "Internal server error."
            };
            await WriteAsync(ctx, problem);
        }
    }

    /// <summary>"Birth.Year" -> "birth.year" so keys match the JSON the client sent.</summary>
    private static string CamelCasePath(string propertyName) =>
        string.Join('.', propertyName.Split('.').Select(JsonNamingPolicy.CamelCase.ConvertName));

    private static Task WriteAsync(HttpContext ctx, ProblemDetails problem)
    {
        ctx.Response.StatusCode = problem.Status!.Value;
        ctx.Response.ContentType = ProblemJson;
        return ctx.Response.WriteAsJsonAsync(problem, problem.GetType(), options: null, contentType: ProblemJson);
    }
}
