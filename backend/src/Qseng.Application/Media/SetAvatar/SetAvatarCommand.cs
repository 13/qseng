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
        var person = await _db.Persons.FindAsync([cmd.PersonId], ct);
        if (person is null) return Result<bool>.NotFound("Person not found.");

        var tree = await _db.Trees.FindAsync([person.TreeId], ct);
        if (tree is null || tree.OwnerId != _currentUser.UserId)
            return Result<bool>.Fail("Forbidden.", 403);

        var media = await _db.Media.FindAsync([cmd.MediaId], ct);
        if (media is null || media.PersonId != cmd.PersonId)
            return Result<bool>.NotFound("Media not found.");

        if (media.Kind != MediaKind.Photo)
            return Result<bool>.Fail("Only photos can be used as a profile picture.");

        // A person has at most one avatar (unique filtered index), so clear the
        // previous one in the same transaction.
        var current = await _db.Media
            .Where(m => m.PersonId == cmd.PersonId && m.IsAvatar)
            .ToListAsync(ct);
        foreach (var m in current) m.IsAvatar = false;

        media.IsAvatar = true;
        await _db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}
