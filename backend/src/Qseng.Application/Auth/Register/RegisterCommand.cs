using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;
using Qseng.Domain.Entities;

namespace Qseng.Application.Auth.Register;


public record RegisterCommand(string Username, string Password, string? DisplayName, string? Email)
    : IRequest<Result<AuthResponse>>;

public record AuthResponse(
    string? AccessToken, string? RefreshToken, int ExpiresIn,
    Guid UserId, string DisplayName, string Username, bool IsAdmin,
    bool PendingActivation = false);

public class RegisterValidator : AbstractValidator<RegisterCommand>
{
    public RegisterValidator()
    {
        RuleFor(x => x.Username).NotEmpty().MinimumLength(3).MaximumLength(50)
            .Matches("^[a-zA-Z0-9_.-]+$").WithMessage("Username may only contain letters, digits, _, ., and -.");
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8).MaximumLength(128);
        RuleFor(x => x.Email).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Email));
    }
}

public class RegisterHandler : IRequestHandler<RegisterCommand, Result<AuthResponse>>
{
    private readonly IQsengDbContext _db;
    private readonly IPasswordHasher _hasher;
    private readonly IJwtTokenService _jwt;

    public RegisterHandler(IQsengDbContext db, IPasswordHasher hasher, IJwtTokenService jwt)
    { _db = db; _hasher = hasher; _jwt = jwt; }

    public async Task<Result<AuthResponse>> Handle(RegisterCommand cmd, CancellationToken ct)
    {
        var isFirstUser = !await _db.Users.AnyAsync(ct);

        if (!isFirstUser)
        {
            var s = await _db.SiteSettings.FindAsync([SiteSettings.SettingsId], ct);
            if (s is { RegistrationEnabled: false })
                return Result<AuthResponse>.Fail("Registration is currently disabled.", 403);
        }

        var usernameTaken = await _db.Users.AnyAsync(
            u => u.Username == cmd.Username.ToLowerInvariant(), ct);
        if (usernameTaken) return Result<AuthResponse>.Conflict("Username already taken.");

        if (!string.IsNullOrWhiteSpace(cmd.Email))
        {
            var emailTaken = await _db.Users.AnyAsync(
                u => u.Email == cmd.Email.ToLowerInvariant(), ct);
            if (emailTaken) return Result<AuthResponse>.Conflict("Email already registered.");
        }

        var user = new User
        {
            Username = cmd.Username.ToLowerInvariant(),
            Email = string.IsNullOrWhiteSpace(cmd.Email) ? null : cmd.Email.ToLowerInvariant(),
            PasswordHash = _hasher.Hash(cmd.Password),
            DisplayName = string.IsNullOrWhiteSpace(cmd.DisplayName) ? cmd.Username : cmd.DisplayName,
            IsAdmin = isFirstUser,
            IsActive = isFirstUser,
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);

        // Inactive accounts must not receive a token — they'd bypass the
        // activation gate that LoginHandler enforces.
        if (!user.IsActive)
            return Result<AuthResponse>.Ok(new AuthResponse(
                null, null, 0, user.Id, user.DisplayName, user.Username, user.IsAdmin,
                PendingActivation: true));

        return Result<AuthResponse>.Ok(await AuthSessions.IssueAsync(_db, _jwt, user, ct));
    }
}
