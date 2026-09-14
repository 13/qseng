using Qseng.Domain.Entities;

namespace Qseng.Application.Abstractions;

/// <summary>A freshly minted refresh token: the raw value goes to the client, the hash to the database.</summary>
public readonly record struct RefreshTokenPair(string Raw, string Hash, DateTime ExpiresAt);

public interface IJwtTokenService
{
    string GenerateAccessToken(User user);

    /// <summary>Seconds until the access token expires; surfaced to clients so they can refresh proactively.</summary>
    int AccessTokenLifetimeSeconds { get; }

    RefreshTokenPair CreateRefreshToken();

    /// <summary>Hashes a raw refresh token for lookup. Must match <see cref="CreateRefreshToken"/>.</summary>
    string HashRefreshToken(string rawToken);
}
