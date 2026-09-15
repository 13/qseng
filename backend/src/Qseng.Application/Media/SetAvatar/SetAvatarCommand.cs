using MediatR;
using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;
using Qseng.Domain.Enums;

namespace Qseng.Application.Media.SetAvatar;

public record SetAvatarCommand(Guid PersonId, Guid MediaId) : IRequest<Result<bool>>;

public class SetAvatarHandler : IRequestHandler<SetAvatarCommand, Result<bool>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _currentUser;

    public SetAvatarHandler(IQsengDbContext db, ICurrentUser currentUser)
    { _db = db; _currentUser = currentUser; }

    public async Task<Result<bool>> Handle(SetAvatarCommand cmd, CancellationToken ct)
    {
        var person = await _db.Persons.FirstOrDefaultAsync(p => p.Id == cmd.PersonId, ct);
        if (person is null) return Result<bool>.NotFound("Person not found.");

        var tree = await _db.Trees.FindAsync([person.TreeId], ct);
        if (tree is null || tree.OwnerId != _currentUser.UserId)
            return Result<bool>.Fail("Forbidden.", 403);

        var media = await _db.Media.FirstOrDefaultAsync(m => m.Id == cmd.MediaId, ct);
        if (media is null || media.PersonId != cmd.PersonId)
            return Result<bool>.NotFound("Media not found.");

        if (media.Kind != MediaKind.Photo)
            return Result<bool>.Fail("Only photos can be used as a profile picture.");

        // A person has at most one avatar (unique filtered index), so clear the
        // previous one before setting the new one. IgnoreQueryFilters because a
        // trashed row still carries IsAvatar = true and would otherwise trip the
        // filtered unique index the moment the new one is set. The clear is saved
        // on its own first: SQLite's unique index check is per-statement, not
        // per-transaction, so if both changes went out in the same SaveChanges the
        // two rows could briefly both carry IsAvatar = true, in whichever order EF
        // happens to send the UPDATEs, and the index would reject that. Both saves
        // still need to land as one all-or-nothing unit, so they run inside an
        // explicit transaction: if the second save fails, disposing the scope
        // without completing it rolls the first one back too.
        await using var scope = await _db.BeginTransactionAsync(ct);

        var current = await _db.Media.IgnoreQueryFilters()
            .Where(m => m.PersonId == cmd.PersonId && m.IsAvatar)
            .ToListAsync(ct);
        if (current.Count > 0)
        {
            foreach (var m in current) m.IsAvatar = false;
            await _db.SaveChangesAsync(ct);
        }

        media.IsAvatar = true;
        await _db.SaveChangesAsync(ct);
        await scope.CompleteAsync(ct);
        return Result<bool>.Ok(true);
    }
}
