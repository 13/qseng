using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Application.Auth.Register;
using Qseng.Domain.Entities;

namespace Qseng.Application.Auth;

/// <summary>
/// Session lifecycle shared by login, register and refresh.
///
/// Access tokens are short-lived and stamped with <see cref="User.TokenVersion"/>;
/// bumping that version invalidates them immediately. Refresh tokens live in the
/// database (hashed) and are rotated on every use, so a stolen token is usable at
/// most once before the legitimate client's next refresh reveals nothing to reuse.
/// </summary>
public static class AuthSessions
{
    public static async Task<AuthResponse> IssueAsync(
        IQsengDbContext db, IJwtTokenService jwt, User user, CancellationToken ct)
    {
        var refresh = jwt.CreateRefreshToken();
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = refresh.Hash,
            ExpiresAt = refresh.ExpiresAt
        });
        await db.SaveChangesAsync(ct);

        return new AuthResponse(
            jwt.GenerateAccessToken(user),
            refresh.Raw,
            jwt.AccessTokenLifetimeSeconds,
            user.Id, user.DisplayName, user.Username, user.IsAdmin);
    }

    /// <summary>Invalidates every outstanding access token for the user.</summary>
    public static void BumpTokenVersion(User user) => user.TokenVersion++;

    /// <summary>Kills every session: outstanding access tokens and all refresh tokens.</summary>
    public static async Task RevokeAllSessionsAsync(IQsengDbContext db, User user, CancellationToken ct)
    {
        BumpTokenVersion(user);
        await RevokeRefreshTokensAsync(db, user.Id, ct);
    }

    public static async Task RevokeRefreshTokensAsync(IQsengDbContext db, Guid userId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var active = await db.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null)
            .ToListAsync(ct);
        foreach (var token in active) token.RevokedAt = now;
    }
}
