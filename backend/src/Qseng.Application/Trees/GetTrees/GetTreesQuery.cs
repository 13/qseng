using MediatR;
using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;
using Qseng.Application.Trees.CreateTree;

namespace Qseng.Application.Trees.GetTrees;

public record GetTreesQuery : IRequest<Result<IReadOnlyList<TreeDto>>>;

public class GetTreesHandler : IRequestHandler<GetTreesQuery, Result<IReadOnlyList<TreeDto>>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _currentUser;

    public GetTreesHandler(IQsengDbContext db, ICurrentUser currentUser)
    { _db = db; _currentUser = currentUser; }

    public async Task<Result<IReadOnlyList<TreeDto>>> Handle(GetTreesQuery _, CancellationToken ct)
    {
        var trees = await _db.Trees
            .Where(t => t.OwnerId == _currentUser.UserId)
            .OrderBy(t => t.Name)
            .Select(t => new TreeDto(t.Id, t.Name, t.Description, t.CreatedAt))
            .ToListAsync(ct);
        return Result<IReadOnlyList<TreeDto>>.Ok(trees);
    }
}
