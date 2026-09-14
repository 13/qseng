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
