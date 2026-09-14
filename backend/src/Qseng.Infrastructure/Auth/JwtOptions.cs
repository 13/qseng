using System.ComponentModel.DataAnnotations;
using Microsoft.Extensions.Options;

namespace Qseng.Infrastructure.Auth;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    /// <summary>Shipped in appsettings.json so the app runs out of the box; refused outside Development.</summary>
    public const string InsecureDevelopmentKey = "change-me-in-prod-please-32+chars-long-key!";

    public const int MinimumKeyLength = 32;

    [Required] public string Issuer { get; set; } = "";
    [Required] public string Audience { get; set; } = "";
    [Required] public string Key { get; set; } = "";

    /// <summary>Kept short: a revoked or deactivated user stays authorized until it expires.</summary>
    [Range(1, 1440)] public int AccessTokenMinutes { get; set; } = 60;

    [Range(1, 365)] public int RefreshTokenDays { get; set; } = 14;
}

/// <summary>
/// Fails startup rather than letting a deployment run on the placeholder key.
/// </summary>
public sealed class JwtOptionsValidator : IValidateOptions<JwtOptions>
{
    private readonly bool _isDevelopment;

    public JwtOptionsValidator(bool isDevelopment) => _isDevelopment = isDevelopment;

    public ValidateOptionsResult Validate(string? name, JwtOptions o)
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(o.Issuer)) errors.Add("Jwt:Issuer must be set.");
        if (string.IsNullOrWhiteSpace(o.Audience)) errors.Add("Jwt:Audience must be set.");

        if (string.IsNullOrWhiteSpace(o.Key))
        {
            errors.Add("Jwt:Key must be set.");
        }
        else
        {
            if (o.Key.Length < JwtOptions.MinimumKeyLength)
                errors.Add($"Jwt:Key must be at least {JwtOptions.MinimumKeyLength} characters (HS256 key strength).");

            if (o.Key == JwtOptions.InsecureDevelopmentKey && !_isDevelopment)
                errors.Add(
                    "Jwt:Key is still the built-in development placeholder. Set a random 32+ character secret " +
                    "via the Jwt__Key environment variable before running outside Development.");
        }

        if (o.AccessTokenMinutes is < 1 or > 1440) errors.Add("Jwt:AccessTokenMinutes must be between 1 and 1440.");
        if (o.RefreshTokenDays is < 1 or > 365) errors.Add("Jwt:RefreshTokenDays must be between 1 and 365.");

        return errors.Count > 0
            ? ValidateOptionsResult.Fail(errors)
            : ValidateOptionsResult.Success;
    }
}
