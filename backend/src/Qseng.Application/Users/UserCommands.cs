using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Qseng.Application.Abstractions;
using Qseng.Application.Auth;
using Qseng.Application.Auth.Register;
using Qseng.Application.Common;

namespace Qseng.Application.Users;

// ── Change password ───────────────────────────────────────────────────────────

public record ChangePasswordCommand(string CurrentPassword, string NewPassword)
    : IRequest<Result<AuthResponse>>;

public class ChangePasswordHandler : IRequestHandler<ChangePasswordCommand, Result<AuthResponse>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _cu;
    private readonly IPasswordHasher _hasher;
    private readonly IJwtTokenService _jwt;

    public ChangePasswordHandler(IQsengDbContext db, ICurrentUser cu, IPasswordHasher hasher, IJwtTokenService jwt)
    { _db = db; _cu = cu; _hasher = hasher; _jwt = jwt; }

    public async Task<Result<AuthResponse>> Handle(ChangePasswordCommand cmd, CancellationToken ct)
    {
        var user = await _db.Users.FindAsync([_cu.UserId], ct);
        if (user is null) return Result<AuthResponse>.NotFound("User not found.");
        if (!_hasher.Verify(cmd.CurrentPassword, user.PasswordHash))
            return Result<AuthResponse>.Fail("Current password is incorrect.");
        if (cmd.NewPassword.Length < 8)
            return Result<AuthResponse>.Fail("New password must be at least 8 characters.");

        user.PasswordHash = _hasher.Hash(cmd.NewPassword);

        // Every existing session dies, including this one; the caller is then
        // handed a fresh session so only *other* devices are signed out.
        await AuthSessions.RevokeAllSessionsAsync(_db, user, ct);
        await _db.SaveChangesAsync(ct);

        return Result<AuthResponse>.Ok(await AuthSessions.IssueAsync(_db, _jwt, user, ct));
    }
}

// ── Change language ───────────────────────────────────────────────────────────

public record ChangeLanguageCommand(string Language) : IRequest<Result<bool>>;

public class ChangeLanguageHandler : IRequestHandler<ChangeLanguageCommand, Result<bool>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _cu;
    public ChangeLanguageHandler(IQsengDbContext db, ICurrentUser cu) { _db = db; _cu = cu; }

    public async Task<Result<bool>> Handle(ChangeLanguageCommand cmd, CancellationToken ct)
    {
        var allowed = new[] { "de", "en" };
        if (!allowed.Contains(cmd.Language))
            return Result<bool>.Fail("Unsupported language. Supported: de, en.");
        var user = await _db.Users.FindAsync([_cu.UserId], ct);
        if (user is null) return Result<bool>.NotFound("User not found.");
        user.Language = cmd.Language;
        await _db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}

// ── Get own profile ───────────────────────────────────────────────────────────

public record GetProfileQuery : IRequest<Result<UserProfileDto>>;

public record UserProfileDto(Guid Id, string Username, string? Email, string DisplayName,
    bool IsAdmin, string Language, DateTime CreatedAt);

public class GetProfileHandler : IRequestHandler<GetProfileQuery, Result<UserProfileDto>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _cu;
    public GetProfileHandler(IQsengDbContext db, ICurrentUser cu) { _db = db; _cu = cu; }

    public async Task<Result<UserProfileDto>> Handle(GetProfileQuery _, CancellationToken ct)
    {
        var user = await _db.Users.FindAsync([_cu.UserId], ct);
        if (user is null) return Result<UserProfileDto>.NotFound("User not found.");
        return Result<UserProfileDto>.Ok(new UserProfileDto(
            user.Id, user.Username, user.Email, user.DisplayName,
            user.IsAdmin, user.Language, user.CreatedAt));
    }
}

// ── Delete own data (keep account) ───────────────────────────────────────────

public record DeleteOwnDataCommand(string Password) : IRequest<Result<bool>>;

public class DeleteOwnDataHandler : IRequestHandler<DeleteOwnDataCommand, Result<bool>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _cu;
    private readonly IPasswordHasher _hasher;
    private readonly IFileStorage _fileStorage;
    private readonly ILogger<DeleteOwnDataHandler> _logger;

    public DeleteOwnDataHandler(IQsengDbContext db, ICurrentUser cu, IPasswordHasher hasher,
        IFileStorage fileStorage, ILogger<DeleteOwnDataHandler> logger)
    { _db = db; _cu = cu; _hasher = hasher; _fileStorage = fileStorage; _logger = logger; }

    public async Task<Result<bool>> Handle(DeleteOwnDataCommand cmd, CancellationToken ct)
    {
        var user = await _db.Users.FindAsync([_cu.UserId], ct);
        if (user is null) return Result<bool>.NotFound("User not found.");
        if (!_hasher.Verify(cmd.Password, user.PasswordHash))
            return Result<bool>.Fail("Password is incorrect.");

        // Collected before the delete so the trees (and the FK cascade that
        // takes their media rows with them) don't take the file list with them
        // too. IgnoreQueryFilters so trashed media is cleaned up along with live.
        var urls = await (from m in _db.Media.IgnoreQueryFilters()
                           join p in _db.Persons.IgnoreQueryFilters() on m.PersonId equals p.Id
                           join t in _db.Trees on p.TreeId equals t.Id
                           where t.OwnerId == _cu.UserId
                           select m.Url).ToListAsync(ct);

        var trees = await _db.Trees.Where(t => t.OwnerId == _cu.UserId).ToListAsync(ct);
        _db.Trees.RemoveRange(trees);
        await _db.SaveChangesAsync(ct);

        foreach (var url in urls)
        {
            try { await _fileStorage.DeleteAsync(url, ct); }
            catch (Exception ex) { _logger.LogWarning(ex, "Failed to delete media file {Url} during own-data deletion.", url); }
        }

        return Result<bool>.Ok(true);
    }
}

// ── Delete own account ────────────────────────────────────────────────────────

public record DeleteOwnAccountCommand(string Password) : IRequest<Result<bool>>;

public class DeleteOwnAccountHandler : IRequestHandler<DeleteOwnAccountCommand, Result<bool>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _cu;
    private readonly IPasswordHasher _hasher;
    private readonly IFileStorage _fileStorage;
    private readonly ILogger<DeleteOwnAccountHandler> _logger;

    public DeleteOwnAccountHandler(IQsengDbContext db, ICurrentUser cu, IPasswordHasher hasher,
        IFileStorage fileStorage, ILogger<DeleteOwnAccountHandler> logger)
    { _db = db; _cu = cu; _hasher = hasher; _fileStorage = fileStorage; _logger = logger; }

    public async Task<Result<bool>> Handle(DeleteOwnAccountCommand cmd, CancellationToken ct)
    {
        var user = await _db.Users.FindAsync([_cu.UserId], ct);
        if (user is null) return Result<bool>.NotFound("User not found.");
        if (!_hasher.Verify(cmd.Password, user.PasswordHash))
            return Result<bool>.Fail("Password is incorrect.");

        // Collected before the delete so the trees (and the FK cascade that
        // takes their media rows with them) don't take the file list with them
        // too. IgnoreQueryFilters so trashed media is cleaned up along with live.
        var urls = await (from m in _db.Media.IgnoreQueryFilters()
                           join p in _db.Persons.IgnoreQueryFilters() on m.PersonId equals p.Id
                           join t in _db.Trees on p.TreeId equals t.Id
                           where t.OwnerId == _cu.UserId
                           select m.Url).ToListAsync(ct);

        var trees = await _db.Trees.Where(t => t.OwnerId == _cu.UserId).ToListAsync(ct);
        _db.Trees.RemoveRange(trees);
        _db.Users.Remove(user);
        await _db.SaveChangesAsync(ct);

        foreach (var url in urls)
        {
            try { await _fileStorage.DeleteAsync(url, ct); }
            catch (Exception ex) { _logger.LogWarning(ex, "Failed to delete media file {Url} during account deletion.", url); }
        }

        return Result<bool>.Ok(true);
    }
}

// ── Export own data ───────────────────────────────────────────────────────────

public record ExportDataQuery : IRequest<Result<ExportDto>>;

public record ExportPersonDto(Guid Id, string FirstName, string LastName, string? MaidenName,
    string Sex, int? BirthYear, int? BirthMonth, int? BirthDay, string? BirthPlace,
    int? DeathYear, int? DeathMonth, int? DeathDay, string? DeathPlace, string? Notes);

public record ExportRelDto(Guid FromPersonId, Guid ToPersonId, string Type,
    int? StartYear, int? EndYear);

public record ExportTreeDto(Guid Id, string Name, string? Description,
    IReadOnlyList<ExportPersonDto> Persons, IReadOnlyList<ExportRelDto> Relationships);

public record ExportDto(string Username, DateTime ExportedAt, IReadOnlyList<ExportTreeDto> Trees);

public class ExportDataHandler : IRequestHandler<ExportDataQuery, Result<ExportDto>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _cu;

    public ExportDataHandler(IQsengDbContext db, ICurrentUser cu) { _db = db; _cu = cu; }

    public async Task<Result<ExportDto>> Handle(ExportDataQuery _, CancellationToken ct)
    {
        var user = await _db.Users.FindAsync([_cu.UserId], ct);
        if (user is null) return Result<ExportDto>.NotFound("User not found.");

        var trees = await _db.Trees.AsNoTracking()
            .Where(t => t.OwnerId == _cu.UserId)
            .ToListAsync(ct);

        var treeIds = trees.Select(t => t.Id).ToList();

        // Three queries total, regardless of how many trees the user owns.
        var personsByTree = (await _db.Persons.AsNoTracking()
                .Where(p => treeIds.Contains(p.TreeId))
                .ToListAsync(ct))
            .GroupBy(p => p.TreeId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var relsByTree = (await _db.Relationships.AsNoTracking()
                .Where(r => treeIds.Contains(r.TreeId))
                .ToListAsync(ct))
            .GroupBy(r => r.TreeId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var exportTrees = trees.Select(tree => new ExportTreeDto(
            tree.Id, tree.Name, tree.Description,
            (personsByTree.GetValueOrDefault(tree.Id) ?? []).Select(p => new ExportPersonDto(
                p.Id, p.FirstName, p.LastName, p.MaidenName,
                p.Sex.ToString(), p.Birth?.Year, p.Birth?.Month, p.Birth?.Day, p.BirthPlace,
                p.Death?.Year, p.Death?.Month, p.Death?.Day, p.DeathPlace, p.Notes)).ToList(),
            (relsByTree.GetValueOrDefault(tree.Id) ?? []).Select(r => new ExportRelDto(
                r.FromPersonId, r.ToPersonId, r.Type.ToString(), r.StartYear, r.EndYear)).ToList()
        )).ToList();

        return Result<ExportDto>.Ok(new ExportDto(user.Username, DateTime.UtcNow, exportTrees));
    }
}
