using MediatR;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;

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
        var person = await _db.Persons.FindAsync([cmd.PersonId], ct);
        if (person is null) return Result<bool>.NotFound("Person not found.");

        var tree = await _db.Trees.FindAsync([person.TreeId], ct);
        if (tree is null || tree.OwnerId != _currentUser.UserId)
            return Result<bool>.Fail("Forbidden.", 403);

        var media = await _db.Media.FindAsync([cmd.MediaId], ct);
        if (media is null || media.PersonId != cmd.PersonId)
            return Result<bool>.NotFound("Media not found.");

        await _fileStorage.DeleteAsync(media.Url, ct);
        _db.Media.Remove(media);
        await _db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}
