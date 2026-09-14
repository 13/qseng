using MediatR;
using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;

namespace Qseng.Application.Trash.PurgeTrashItem;

public record PurgeTrashItemCommand(Guid PersonId) : IRequest<Result<bool>>;

public class PurgeTrashItemHandler : IRequestHandler<PurgeTrashItemCommand, Result<bool>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _currentUser;
    private readonly TrashPurger _purger;

    public PurgeTrashItemHandler(IQsengDbContext db, ICurrentUser currentUser, TrashPurger purger)
    { _db = db; _currentUser = currentUser; _purger = purger; }

    public async Task<Result<bool>> Handle(PurgeTrashItemCommand cmd, CancellationToken ct)
    {
        var person = await _db.Persons.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == cmd.PersonId && p.DeletedAt != null, ct);
        if (person is null) return Result<bool>.NotFound("Person not found in the trash.");
        var tree = await _db.Trees.FindAsync([person.TreeId], ct);
        if (tree is null || tree.OwnerId != _currentUser.UserId) return Result<bool>.Fail("Forbidden.", 403);

        await _purger.PurgeBatchAsync(person, ct);
        return Result<bool>.Ok(true);
    }
}
