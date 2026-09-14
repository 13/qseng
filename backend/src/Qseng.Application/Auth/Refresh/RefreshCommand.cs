using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Application.Auth.Register;
using Qseng.Application.Common;

namespace Qseng.Application.Auth.Refresh;

public record RefreshCommand(string RefreshToken) : IRequest<Result<AuthResponse>>;

public class RefreshValidator : AbstractValidator<RefreshCommand>
{
    public RefreshValidator() => RuleFor(x => x.RefreshToken).NotEmpty();
}

public class RefreshHandler : IRequestHandler<RefreshCommand, Result<AuthResponse>>
{
    private readonly IQsengDbContext _db;
    private readonly IJwtTokenService _jwt;

    public RefreshHandler(IQsengDbContext db, IJwtTokenService jwt) { _db = db; _jwt = jwt; }

    public async Task<Result<AuthResponse>> Handle(RefreshCommand cmd, CancellationToken ct)
    {
        var hash = _jwt.HashRefreshToken(cmd.RefreshToken);
        var token = await _db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);

        var now = DateTime.UtcNow;
        if (token is null || !token.IsActive(now))
            return Result<AuthResponse>.Unauthorized("Invalid or expired refresh token.");

        var user = await _db.Users.FindAsync([token.UserId], ct);
        if (user is null || !user.IsActive)
        {
            // Deactivated between refreshes: burn the token.
            token.RevokedAt = now;
            await _db.SaveChangesAsync(ct);
            return Result<AuthResponse>.Unauthorized("Account is inactive.");
        }

        // Rotate: the presented token can never be replayed.
        token.RevokedAt = now;

        // The new access token is minted from the current row, so a role change
        // takes effect on the next refresh without forcing a re-login.
        return Result<AuthResponse>.Ok(await AuthSessions.IssueAsync(_db, _jwt, user, ct));
    }
}

public record LogoutCommand(string RefreshToken) : IRequest<Result<bool>>;

public class LogoutHandler : IRequestHandler<LogoutCommand, Result<bool>>
{
    private readonly IQsengDbContext _db;
    private readonly IJwtTokenService _jwt;

    public LogoutHandler(IQsengDbContext db, IJwtTokenService jwt) { _db = db; _jwt = jwt; }

    public async Task<Result<bool>> Handle(LogoutCommand cmd, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(cmd.RefreshToken)) return Result<bool>.Ok(true);

        var hash = _jwt.HashRefreshToken(cmd.RefreshToken);
        var token = await _db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (token is { RevokedAt: null })
        {
            token.RevokedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
        }

        // Always succeeds: logging out with an unknown token is not an error.
        return Result<bool>.Ok(true);
    }
}
