using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Application.Auth.Register;
using Qseng.Application.Common;

namespace Qseng.Application.Auth.Login;

public record LoginCommand(string Email, string Password) : IRequest<Result<AuthResponse>>;

public class LoginValidator : AbstractValidator<LoginCommand>
{
    public LoginValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty();
    }
}

public class LoginHandler : IRequestHandler<LoginCommand, Result<AuthResponse>>
{
    private readonly IQsengDbContext _db;
    private readonly IPasswordHasher _hasher;
    private readonly IJwtTokenService _jwt;

    public LoginHandler(IQsengDbContext db, IPasswordHasher hasher, IJwtTokenService jwt)
    {
        _db = db; _hasher = hasher; _jwt = jwt;
    }

    public async Task<Result<AuthResponse>> Handle(LoginCommand cmd, CancellationToken ct)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == cmd.Email.ToLowerInvariant(), ct);
        if (user is null || !_hasher.Verify(cmd.Password, user.PasswordHash))
            return Result<AuthResponse>.Unauthorized("Invalid credentials.");

        return Result<AuthResponse>.Ok(new AuthResponse(_jwt.GenerateAccessToken(user), user.Id, user.DisplayName));
    }
}
