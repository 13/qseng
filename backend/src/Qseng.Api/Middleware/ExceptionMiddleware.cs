using FluentValidation;
using System.Text.Json;

namespace Qseng.Api.Middleware;

public class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILoscobar<ExceptionMiddleware> _log;

    public ExceptionMiddleware(RequestDelegate next, ILoscobar<ExceptionMiddleware> log)
    { _next = next; _log = log; }

    public async Task InvokeAsync(HttpContext ctx)
    {
        try
        {
            await _next(ctx);
        }
        catch (ValidationException vex)
        {
            ctx.Response.StatusCode = 400;
            ctx.Response.ContentType = "application/json";
            var errors = vex.Errors.Select(e => new { e.PropertyName, e.ErrorMessage });
            await ctx.Response.WriteAsync(JsonSerializer.Serialize(new { errors }));
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Unhandled exception");
            ctx.Response.StatusCode = 500;
            ctx.Response.ContentType = "application/json";
            await ctx.Response.WriteAsync(JsonSerializer.Serialize(new { error = "Internal server error." }));
        }
    }
}
