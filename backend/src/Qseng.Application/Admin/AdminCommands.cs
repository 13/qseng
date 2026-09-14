using MediatR;
using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Application.Auth;
using Qseng.Application.Common;
using Qseng.Domain.Entities;

namespace Qseng.Application.Admin;

// ── DTOs ──────────────────────────────────────────────────────────────────────

public record UserSummaryDto(
    Guid Id, string Username, string? Email, string DisplayName,
    bool IsAdmin, bool IsActive, string Language, DateTime CreatedAt);

public record SiteSettingsDto(bool RegistrationEnabled);

// ── List users ────────────────────────────────────────────────────────────────

public record ListUsersQuery : IRequest<Result<IReadOnlyList<UserSummaryDto>>>;

public class ListUsersHandler : IRequestHandler<ListUsersQuery, Result<IReadOnlyList<UserSummaryDto>>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _cu;
    public ListUsersHandler(IQsengDbContext db, ICurrentUser cu) { _db = db; _cu = cu; }

    public async Task<Result<IReadOnlyList<UserSummaryDto>>> Handle(ListUsersQuery _, CancellationToken ct)
    {
        if (!_cu.IsAdmin) return Result<IReadOnlyList<UserSummaryDto>>.Fail("Forbidden.", 403);
        var users = await _db.Users
            .OrderBy(u => u.Username)
            .Select(u => new UserSummaryDto(u.Id, u.Username, u.Email, u.DisplayName,
                                            u.IsAdmin, u.IsActive, u.Language, u.CreatedAt))
            .ToListAsync(ct);
        return Result<IReadOnlyList<UserSummaryDto>>.Ok(users);
    }
}

// ── Set active ────────────────────────────────────────────────────────────────

public record SetUserActiveCommand(Guid TargetId, bool Active) : IRequest<Result<bool>>;

public class SetUserActiveHandler : IRequestHandler<SetUserActiveCommand, Result<bool>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _cu;
    public SetUserActiveHandler(IQsengDbContext db, ICurrentUser cu) { _db = db; _cu = cu; }

    public async Task<Result<bool>> Handle(SetUserActiveCommand cmd, CancellationToken ct)
    {
        if (!_cu.IsAdmin) return Result<bool>.Fail("Forbidden.", 403);
        var user = await _db.Users.FindAsync([cmd.TargetId], ct);
        if (user is null) return Result<bool>.NotFound("User not found.");
        if (user.Id == _cu.UserId && !cmd.Active)
            return Result<bool>.Fail("Cannot deactivate your own account.", 400);

        user.IsActive = cmd.Active;
        // Deactivation must take effect now, not whenever their access token expires.
        if (!cmd.Active) await AuthSessions.RevokeAllSessionsAsync(_db, user, ct);

        await _db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}

// ── Set admin ─────────────────────────────────────────────────────────────────

public record SetUserAdminCommand(Guid TargetId, bool Admin) : IRequest<Result<bool>>;

public class SetUserAdminHandler : IRequestHandler<SetUserAdminCommand, Result<bool>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _cu;
    public SetUserAdminHandler(IQsengDbContext db, ICurrentUser cu) { _db = db; _cu = cu; }

    public async Task<Result<bool>> Handle(SetUserAdminCommand cmd, CancellationToken ct)
    {
        if (!_cu.IsAdmin) return Result<bool>.Fail("Forbidden.", 403);
        var user = await _db.Users.FindAsync([cmd.TargetId], ct);
        if (user is null) return Result<bool>.NotFound("User not found.");
        if (user.Id == _cu.UserId && !cmd.Admin)
            return Result<bool>.Fail("Cannot remove your own admin rights.", 400);

        user.IsAdmin = cmd.Admin;
        // Their access token carries a stale isAdmin claim; invalidate it. Their
        // refresh token still works, so the client silently picks up the new role.
        AuthSessions.BumpTokenVersion(user);

        await _db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}

// ── Delete user ───────────────────────────────────────────────────────────────

public record AdminDeleteUserCommand(Guid TargetId) : IRequest<Result<bool>>;

public class AdminDeleteUserHandler : IRequestHandler<AdminDeleteUserCommand, Result<bool>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _cu;
    public AdminDeleteUserHandler(IQsengDbContext db, ICurrentUser cu) { _db = db; _cu = cu; }

    public async Task<Result<bool>> Handle(AdminDeleteUserCommand cmd, CancellationToken ct)
    {
        if (!_cu.IsAdmin) return Result<bool>.Fail("Forbidden.", 403);
        if (cmd.TargetId == _cu.UserId) return Result<bool>.Fail("Cannot delete your own account here.", 400);
        var user = await _db.Users.FindAsync([cmd.TargetId], ct);
        if (user is null) return Result<bool>.NotFound("User not found.");
        var trees = await _db.Trees.Where(t => t.OwnerId == cmd.TargetId).ToListAsync(ct);
        _db.Trees.RemoveRange(trees);
        _db.Users.Remove(user);
        await _db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}

// ── Create user (admin) ───────────────────────────────────────────────────────

public record AdminCreateUserCommand(string Username, string Password, string? DisplayName,
    string? Email, bool IsAdmin) : IRequest<Result<UserSummaryDto>>;

public class AdminCreateUserHandler : IRequestHandler<AdminCreateUserCommand, Result<UserSummaryDto>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _cu;
    private readonly IPasswordHasher _hasher;

    public AdminCreateUserHandler(IQsengDbContext db, ICurrentUser cu, IPasswordHasher hasher)
    { _db = db; _cu = cu; _hasher = hasher; }

    public async Task<Result<UserSummaryDto>> Handle(AdminCreateUserCommand cmd, CancellationToken ct)
    {
        if (!_cu.IsAdmin) return Result<UserSummaryDto>.Fail("Forbidden.", 403);
        if (string.IsNullOrWhiteSpace(cmd.Username) || cmd.Username.Length < 3)
            return Result<UserSummaryDto>.Fail("Username must be at least 3 characters.");
        if (string.IsNullOrWhiteSpace(cmd.Password) || cmd.Password.Length < 8)
            return Result<UserSummaryDto>.Fail("Password must be at least 8 characters.");

        var taken = await _db.Users.AnyAsync(u => u.Username == cmd.Username.ToLowerInvariant(), ct);
        if (taken) return Result<UserSummaryDto>.Conflict("Username already taken.");

        var user = new User
        {
            Username = cmd.Username.ToLowerInvariant(),
            Email = string.IsNullOrWhiteSpace(cmd.Email) ? null : cmd.Email.ToLowerInvariant(),
            PasswordHash = _hasher.Hash(cmd.Password),
            DisplayName = string.IsNullOrWhiteSpace(cmd.DisplayName) ? cmd.Username : cmd.DisplayName,
            IsAdmin = cmd.IsAdmin,
            IsActive = true,
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);

        return Result<UserSummaryDto>.Ok(new UserSummaryDto(
            user.Id, user.Username, user.Email, user.DisplayName,
            user.IsAdmin, user.IsActive, user.Language, user.CreatedAt));
    }
}

// ── Change user password (admin) ──────────────────────────────────────────────

public record AdminChangeUserPasswordCommand(Guid TargetId, string NewPassword) : IRequest<Result<bool>>;

public class AdminChangeUserPasswordHandler : IRequestHandler<AdminChangeUserPasswordCommand, Result<bool>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _cu;
    private readonly IPasswordHasher _hasher;

    public AdminChangeUserPasswordHandler(IQsengDbContext db, ICurrentUser cu, IPasswordHasher hasher)
    { _db = db; _cu = cu; _hasher = hasher; }

    public async Task<Result<bool>> Handle(AdminChangeUserPasswordCommand cmd, CancellationToken ct)
    {
        if (!_cu.IsAdmin) return Result<bool>.Fail("Forbidden.", 403);
        if (cmd.NewPassword.Length < 8) return Result<bool>.Fail("Password must be at least 8 characters.");
        var user = await _db.Users.FindAsync([cmd.TargetId], ct);
        if (user is null) return Result<bool>.NotFound("User not found.");

        user.PasswordHash = _hasher.Hash(cmd.NewPassword);
        // An admin-forced password reset logs the user out everywhere.
        await AuthSessions.RevokeAllSessionsAsync(_db, user, ct);

        await _db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}

// ── Site settings ─────────────────────────────────────────────────────────────

public record GetSiteSettingsQuery : IRequest<Result<SiteSettingsDto>>;

public class GetSiteSettingsHandler : IRequestHandler<GetSiteSettingsQuery, Result<SiteSettingsDto>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _cu;
    public GetSiteSettingsHandler(IQsengDbContext db, ICurrentUser cu) { _db = db; _cu = cu; }

    public async Task<Result<SiteSettingsDto>> Handle(GetSiteSettingsQuery _, CancellationToken ct)
    {
        if (!_cu.IsAdmin) return Result<SiteSettingsDto>.Fail("Forbidden.", 403);
        var s = await _db.SiteSettings.FindAsync([SiteSettings.SettingsId], ct);
        return Result<SiteSettingsDto>.Ok(new SiteSettingsDto(s?.RegistrationEnabled ?? true));
    }
}

public record SetRegistrationEnabledCommand(bool Enabled) : IRequest<Result<bool>>;

public class SetRegistrationEnabledHandler : IRequestHandler<SetRegistrationEnabledCommand, Result<bool>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _cu;
    public SetRegistrationEnabledHandler(IQsengDbContext db, ICurrentUser cu) { _db = db; _cu = cu; }

    public async Task<Result<bool>> Handle(SetRegistrationEnabledCommand cmd, CancellationToken ct)
    {
        if (!_cu.IsAdmin) return Result<bool>.Fail("Forbidden.", 403);
        var s = await _db.SiteSettings.FindAsync([SiteSettings.SettingsId], ct);
        if (s is null) return Result<bool>.NotFound("Settings not found.");
        s.RegistrationEnabled = cmd.Enabled;
        s.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}
