using MediatR;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;

namespace Qseng.Application.Trees.DeleteTree;

public record DeleteTreeCommand(Guid Id) : IRequest<Result<bool>>;

public class DeleteTreeHandler : IRequestHandler<DeleteTreeCommand, Result<bool>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _currentUser;

    public DeleteTreeHandler(IQsengDbContext db, ICurrentUser currentUser)
    { _db = db; _currentUser = currentUser; }

    public async Task<Result<bool>> Handle(DeleteTreeCommand cmd, CancellationToken ct)
    {
        var tree = await _db.Trees.FindAsync([cmd.Id], ct);
        if (tree is null) return Result<bool>.NotFound("Tree not found.");
        if (tree.OwnerId != _currentUser.UserId) return Result<bool>.Fail("Forbidden.", 403);

        _db.Trees.Remove(tree);
        await _db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}
