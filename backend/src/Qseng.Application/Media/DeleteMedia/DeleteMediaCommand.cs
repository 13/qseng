using MediatR;
using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;
using Qseng.Domain.Enums;

namespace Qseng.Application.Media.DeleteMedia;

public record DeleteMediaCommand(Guid PersonId, Guid MediaId) : IRequest<Result<bool>>;

public class DeleteMediaHandler : IRequestHandler<DeleteMediaCommand, Result<bool>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _currentUser;
    private readonly IFileStorage _fileStorage;

    public DeleteMediaHandler(IQsengDbContext db, ICurrentUser currentUser, IFileStorage fileStorage)
    { _db = db; _currentUser = currentUser; _fileStorage = fileStorage; }

    public async Task<Result<bool>> Handle(DeleteMediaCommand cmd, CancellationToken ct)
    {
        var person = await _db.Persons.FirstOrDefaultAsync(p => p.Id == cmd.PersonId, ct);
        if (person is null) return Result<bool>.NotFound("Person not found.");

        var tree = await _db.Trees.FindAsync([person.TreeId], ct);
        if (tree is null || tree.OwnerId != _currentUser.UserId)
            return Result<bool>.Fail("Forbidden.", 403);

        var media = await _db.Media.FirstOrDefaultAsync(m => m.Id == cmd.MediaId, ct);
        if (media is null || media.PersonId != cmd.PersonId)
            return Result<bool>.NotFound("Media not found.");

        // The file itself is kept; the purge job deletes it once the trash retention
        // window elapses.
        media.DeletedAt = DateTime.UtcNow;
        media.DeletionBatchId = Guid.NewGuid();

        // Deleting the avatar promotes the next-oldest photo rather than leaving
        // the person without one. The filtered unique avatar index counts trashed
        // rows, so the trashed media must give up IsAvatar before we set the
        // replacement — and that clear is saved on its own first: SQLite's unique
        // index check is per-statement, not per-transaction, so the two changes
        // going out in the same SaveChanges could have both rows briefly carrying
        // IsAvatar = true, in whichever order EF happens to send the UPDATEs.
        var wasAvatar = media.IsAvatar;
        media.IsAvatar = false;
        if (wasAvatar)
        {
            await _db.SaveChangesAsync(ct);

            var replacement = await _db.Media
                .Where(m => m.PersonId == cmd.PersonId && m.Id != media.Id && m.Kind == MediaKind.Photo)
                .OrderBy(m => m.CreatedAt)
                .FirstOrDefaultAsync(ct);
            if (replacement is not null) replacement.IsAvatar = true;
        }

        await _db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}
