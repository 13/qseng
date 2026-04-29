using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;
using Qseng.Domain.Entities;

namespace Qseng.Application.Auth.Register;

public record RegisterCommand(string Email, string Password, string DisplayName)
    : IRequest<Result<AuthResponse>>;

public record AuthResponse(string AccessToken, Guid UserId, string DisplayName);

public class RegisterValidator : AbstractValidator<RegisterCommand>
{
    public RegisterValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8).MaximumLength(128);
        RuleFor(x => x.DisplayName).NotEmpty().MaximumLength(100);
    }
}

public class RegisterHandler : IRequestHandler<RegisterCommand, Result<AuthResponse>>
{
    private readonly IQsengDbContext _db;
    private readonly IPasswordHasher _hasher;
    private readonly IJwtTokenService _jwt;

    public RegisterHandler(IQsengDbContext db, IPasswordHasher hasher, IJwtTokenService jwt)
    {
        _db = db; _hasher = hasher; _jwt = jwt;
    }

    public async Task<Result<AuthResponse>> Handle(RegisterCommand cmd, CancellationToken ct)
    {
        var exists = await _db.Users.AnyAsync(u => u.Email == cmd.Email.ToLowerInvariant(), ct);
        if (exists) return Result<AuthResponse>.Conflict("Email already registered.");

        var user = new User
        {
            Email = cmd.Email.ToLowerInvariant(),
            PasswordHash = _hasher.Hash(cmd.Password),
            DisplayName = cmd.DisplayName
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);

        return Result<AuthResponse>.Ok(new AuthResponse(_jwt.GenerateAccessToken(user), user.Id, user.DisplayName));
    }
}
