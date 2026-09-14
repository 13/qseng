using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Xunit;
using Qseng.Application.Abstractions;
using Qseng.Application.Admin;
using Qseng.Domain.Entities;

namespace Qseng.Application.Tests.Admin;

public class SessionRevocationTests
{
    private static ICurrentUser FakeAdmin(Guid userId)
    {
        var u = Substitute.For<ICurrentUser>();
        u.UserId.Returns(userId);
        u.IsAdmin.Returns(true);
        return u;
    }

    private static IPasswordHasher FakeHasher()
    {
        var hasher = Substitute.For<IPasswordHasher>();
        hasher.Hash(Arg.Any<string>()).Returns(ci => "hashed:" + ci.Arg<string>());
        return hasher;
    }

    private static async Task<(IQsengDbContext db, User admin, User target)> SetupAsync()
    {
        var db = TestDb.Create();
        var admin = new User { Username = "admin", DisplayName = "Admin", IsAdmin = true };
        var target = new User { Username = "target", DisplayName = "Target" };
        db.Users.AddRange(admin, target);
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = target.Id,
            TokenHash = "hash:live",
            ExpiresAt = DateTime.UtcNow.AddDays(7)
        });
        await db.SaveChangesAsync();
        return (db, admin, target);
    }

    [Fact]
    public async Task Deactivating_a_user_revokes_their_sessions_immediately()
    {
        var (db, admin, target) = await SetupAsync();
        var handler = new SetUserActiveHandler(db, FakeAdmin(admin.Id));

        var result = await handler.Handle(new SetUserActiveCommand(target.Id, false), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        target.TokenVersion.Should().Be(1, "outstanding access tokens must stop validating");
        (await db.RefreshTokens.CountAsync(t => t.UserId == target.Id && t.RevokedAt == null))
            .Should().Be(0, "the user must not be able to mint a new access token");
    }

    [Fact]
    public async Task Reactivating_a_user_does_not_touch_sessions()
    {
        var (db, admin, target) = await SetupAsync();
        target.IsActive = false;
        await db.SaveChangesAsync();

        await new SetUserActiveHandler(db, FakeAdmin(admin.Id))
            .Handle(new SetUserActiveCommand(target.Id, true), CancellationToken.None);

        target.TokenVersion.Should().Be(0);
    }

    [Fact]
    public async Task An_admin_cannot_deactivate_themselves()
    {
        var (db, admin, _) = await SetupAsync();

        var result = await new SetUserActiveHandler(db, FakeAdmin(admin.Id))
            .Handle(new SetUserActiveCommand(admin.Id, false), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Granting_admin_invalidates_access_tokens_but_keeps_refresh_tokens()
    {
        var (db, admin, target) = await SetupAsync();

        var result = await new SetUserAdminHandler(db, FakeAdmin(admin.Id))
            .Handle(new SetUserAdminCommand(target.Id, true), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        target.TokenVersion.Should().Be(1, "the stale isAdmin claim must stop being accepted");
        (await db.RefreshTokens.CountAsync(t => t.UserId == target.Id && t.RevokedAt == null))
            .Should().Be(1, "the client should silently refresh rather than be logged out");
    }

    [Fact]
    public async Task An_admin_password_reset_signs_the_user_out_everywhere()
    {
        var (db, admin, target) = await SetupAsync();

        var result = await new AdminChangeUserPasswordHandler(db, FakeAdmin(admin.Id), FakeHasher())
            .Handle(new AdminChangeUserPasswordCommand(target.Id, "a-long-enough-password"), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        target.TokenVersion.Should().Be(1);
        (await db.RefreshTokens.CountAsync(t => t.UserId == target.Id && t.RevokedAt == null)).Should().Be(0);
    }
}
