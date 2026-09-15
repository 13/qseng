using Microsoft.Extensions.Options;

namespace Qseng.Infrastructure.Options;

public class CorsOptions
{
    public const string SectionName = "Cors";
    public string[] AllowedOrigins { get; set; } = [];

    /// <summary>Configured origins, or the Angular dev server when running in Development with none configured.</summary>
    public string[] EffectiveOrigins(bool isDevelopment) =>
        AllowedOrigins.Length == 0 && isDevelopment ? ["http://localhost:4200"] : AllowedOrigins;
}

public sealed class CorsOptionsValidator : IValidateOptions<CorsOptions>
{
    private readonly bool _isDevelopment;
    public CorsOptionsValidator(bool isDevelopment) => _isDevelopment = isDevelopment;

    public ValidateOptionsResult Validate(string? name, CorsOptions o)
    {
        var errors = new List<string>();
        if (o.AllowedOrigins.Length == 0 && !_isDevelopment)
            errors.Add("Cors:AllowedOrigins must list at least one origin outside Development.");
        foreach (var origin in o.AllowedOrigins)
        {
            // The CORS middleware compares the Origin header verbatim; a trailing slash or fragment would never match.
            if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri) || (uri.Scheme != "http" && uri.Scheme != "https") || uri.AbsolutePath != "/" || !string.IsNullOrEmpty(uri.Query) || origin.EndsWith('/') || origin.Contains('#'))
                errors.Add($"Cors:AllowedOrigins entry '{origin}' must be an absolute http(s) origin without a path.");
        }
        return errors.Count == 0 ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(errors);
    }
}
