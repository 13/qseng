using Microsoft.Extensions.Options;

namespace Qseng.Infrastructure.Options;

public class RateLimitingOptions
{
    public const string SectionName = "RateLimiting";
    public AuthLimit Auth { get; set; } = new();

    public class AuthLimit
    {
        public int PermitLimit { get; set; } = 10;
        public int WindowSeconds { get; set; } = 60;
    }
}

/// <summary>
/// Fails startup rather than letting a non-positive limit reach
/// <c>FixedWindowRateLimiterOptions</c>, which throws out of the rate limiter on the first
/// request instead of at startup.
/// </summary>
public sealed class RateLimitingOptionsValidator : IValidateOptions<RateLimitingOptions>
{
    public ValidateOptionsResult Validate(string? name, RateLimitingOptions o)
    {
        var errors = new List<string>();
        if (o.Auth.PermitLimit < 1) errors.Add("RateLimiting:Auth:PermitLimit must be at least 1.");
        if (o.Auth.WindowSeconds < 1) errors.Add("RateLimiting:Auth:WindowSeconds must be at least 1.");
        return errors.Count == 0 ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(errors);
    }
}
