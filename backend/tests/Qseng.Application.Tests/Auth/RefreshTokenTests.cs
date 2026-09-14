using FluentAssertions;
using NSubstitute;
using Xunit;
using Qseng.Application.Abstractions;
using Qseng.Application.Auth;
using Qseng.Application.Auth.Login;
using Qseng.Application.Auth.Refresh;
using Qseng.Domain.Entities;

namespace Qseng.Application.Tests.Auth;

public class RefreshTokenTests
{
    private const string Password = "correct-horse-battery";

    /// <summary>Deterministic stand-in: the raw token is its own hash source.</summary>
    private static IJwtTokenService FakeJwt()
    {
        var jwt = Substitute.For<IJwtTokenService>();
        jwt.AccessTokenLifetimeSeconds.Returns(3600);
        jwt.GenerateAccessToken(Arg.Any<User>())
            .Returns(ci => $"access-for-{ci.Arg<User>().Id}-v{ci.Arg<User>().TokenVersion}");
        jwt.HashRefreshToken(Arg.Any<string>()).Returns(ci => "hash:" + ci.Arg<string>());
        jwt.CreateRefreshToken().Returns(_ =>
        {
            var raw = Guid.NewGuid().ToString();
            return new RefreshTokenPair(raw, "hash:" + raw, DateTime.UtcNow.AddDays(14));
        });
        return jwt;
    }

    private static IPasswordHasher FakeHasher()
    {
        var hasher = Substitute.For<IPasswordHasher>();
        hasher.Hash(Arg.Any<string>()).Returns(ci => "hashed:" + ci.Arg<string>());
        hasher.Verify(Arg.Any<string>(), Arg.Any<string>())
            .Returns(ci => "hashed:" + ci.ArgAt<string>(0) == ci.ArgAt<string>(1));
        return hasher;
    }

    private static async Task<(IQsengDbContext db, User user)> SetupAsync(bool isActive = true)
    {
        var db = TestDb.Create();
        var user = new User
        {
            Username = "demo",
            DisplayName = "Demo",
            PasswordHash = "hashed:" + Password,
            IsActive = isActive
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return (db, user);
    }

    private static async Task<string> LoginAsync(IQsengDbContext db, IJwtTokenService jwt)
    {
        var result = await new LoginHandler(db, FakeHasher(), jwt)
            .Handle(new LoginCommand("demo", Password), CancellationToken.None);
        result.IsSuccess.Should().BeTrue();
        return result.Value!.RefreshToken!;
    }

    [Fact]
    public async Task Login_issues_a_refresh_token()
    {
        var (db, _) = await SetupAsync();
        var jwt = FakeJwt();

        var result = await new LoginHandler(db, FakeHasher(), jwt)
            .Handle(new LoginCommand("demo", Password), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.RefreshToken.Should().NotBeNullOrEmpty();
        result.Value.ExpiresIn.Should().Be(3600);
        db.RefreshTokens.Count().Should().Be(1);
    }

    [Fact]
    public async Task Refresh_rotates_the_token_so_it_cannot_be_replayed()
    {
        var (db, _) = await SetupAsync();
        var jwt = FakeJwt();
        var original = await LoginAsync(db, jwt);

        var first = await new RefreshHandler(db, jwt).Handle(new RefreshCommand(original), CancellationToken.None);
        first.IsSuccess.Should().BeTrue();
        first.Value!.RefreshToken.Should().NotBe(original);

        // Replaying the original must fail: it was revoked on use.
        var replay = await new RefreshHandler(db, jwt).Handle(new RefreshCommand(original), CancellationToken.None);
        replay.IsSuccess.Should().BeFalse();
        replay.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task Refresh_is_rejected_once_the_account_is_deactivated()
    {
        var (db, user) = await SetupAsync();
        var jwt = FakeJwt();
        var token = await LoginAsync(db, jwt);

        user.IsActive = false;
        await db.SaveChangesAsync();

        var result = await new RefreshHandler(db, jwt).Handle(new RefreshCommand(token), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task Refresh_is_rejected_after_sessions_are_revoked()
    {
        var (db, user) = await SetupAsync();
        var jwt = FakeJwt();
        var token = await LoginAsync(db, jwt);

        await AuthSessions.RevokeAllSessionsAsync(db, user, CancellationToken.None);
        await db.SaveChangesAsync();

        var result = await new RefreshHandler(db, jwt).Handle(new RefreshCommand(token), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task Refresh_mints_an_access_token_carrying_the_current_token_version()
    {
        var (db, user) = await SetupAsync();
        var jwt = FakeJwt();
        var token = await LoginAsync(db, jwt);

        // Role change bumps the version but leaves refresh tokens usable, so the
        // client silently upgrades to a token with the new claims.
        AuthSessions.BumpTokenVersion(user);
        await db.SaveChangesAsync();

        var result = await new RefreshHandler(db, jwt).Handle(new RefreshCommand(token), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.AccessToken.Should().Be($"access-for-{user.Id}-v1");
    }

    [Fact]
    public async Task Expired_refresh_token_is_rejected()
    {
        var (db, user) = await SetupAsync();
        var jwt = FakeJwt();

        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = "hash:stale",
            ExpiresAt = DateTime.UtcNow.AddSeconds(-1)
        });
        await db.SaveChangesAsync();

        var result = await new RefreshHandler(db, jwt).Handle(new RefreshCommand("stale"), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task Logout_revokes_the_presented_token()
    {
        var (db, _) = await SetupAsync();
        var jwt = FakeJwt();
        var token = await LoginAsync(db, jwt);

        var logout = await new LogoutHandler(db, jwt).Handle(new LogoutCommand(token), CancellationToken.None);
        logout.IsSuccess.Should().BeTrue();

        var afterLogout = await new RefreshHandler(db, jwt).Handle(new RefreshCommand(token), CancellationToken.None);
        afterLogout.IsSuccess.Should().BeFalse();
    }

    [Fact]
    public async Task Logout_with_an_unknown_token_is_not_an_error()
    {
        var (db, _) = await SetupAsync();

        var result = await new LogoutHandler(db, FakeJwt())
            .Handle(new LogoutCommand("never-issued"), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
    }
}
