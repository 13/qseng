using MediatR;
using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;

namespace Qseng.Application.Media.RestoreMedia;

public record RestoreMediaCommand(Guid PersonId, Guid MediaId) : IRequest<Result<MediaDto>>;

public class RestoreMediaHandler : IRequestHandler<RestoreMediaCommand, Result<MediaDto>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _currentUser;
    public RestoreMediaHandler(IQsengDbContext db, ICurrentUser currentUser) { _db = db; _currentUser = currentUser; }

    public async Task<Result<MediaDto>> Handle(RestoreMediaCommand cmd, CancellationToken ct)
    {
        var media = await _db.Media.IgnoreQueryFilters()
            .FirstOrDefaultAsync(m => m.Id == cmd.MediaId && m.PersonId == cmd.PersonId && m.DeletedAt != null, ct);
        if (media is null) return Result<MediaDto>.NotFound("Media not found in the trash.");

        var person = await _db.Persons.FirstOrDefaultAsync(p => p.Id == cmd.PersonId, ct);
        if (person is null) return Result<MediaDto>.Conflict("Restore the person first.");

        var tree = await _db.Trees.FindAsync([person.TreeId], ct);
        if (tree is null || tree.OwnerId != _currentUser.UserId) return Result<MediaDto>.Fail("Forbidden.", 403);

        // Restoring never steals the avatar back from whatever photo was promoted
        // while this row was in the trash.
        media.DeletedAt = null;
        media.DeletionBatchId = null;
        media.IsAvatar = false;
        await _db.SaveChangesAsync(ct);

        return Result<MediaDto>.Ok(new MediaDto(
            media.Id, media.PersonId, media.Url, media.Caption, media.Kind, media.CreatedAt, media.IsAvatar));
    }
}
