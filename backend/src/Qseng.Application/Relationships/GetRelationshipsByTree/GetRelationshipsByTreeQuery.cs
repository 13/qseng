using MediatR;
using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;
using Qseng.Application.Relationships.CreateRelationship;

namespace Qseng.Application.Relationships.GetRelationshipsByTree;

public record GetRelationshipsByTreeQuery(Guid TreeId) : IRequest<Result<IReadOnlyList<RelationshipDto>>>;

public class GetRelationshipsByTreeHandler : IRequestHandler<GetRelationshipsByTreeQuery, Result<IReadOnlyList<RelationshipDto>>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _currentUser;

    public GetRelationshipsByTreeHandler(IQsengDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<Result<IReadOnlyList<RelationshipDto>>> Handle(GetRelationshipsByTreeQuery q, CancellationToken ct)
    {
        var tree = await _db.Trees.FindAsync([q.TreeId], ct);
        if (tree is null) return Result<IReadOnlyList<RelationshipDto>>.NotFound("Tree not found.");
        if (tree.OwnerId != _currentUser.UserId) return Result<IReadOnlyList<RelationshipDto>>.Fail("Forbidden.", 403);

        var rels = await _db.Relationships
            .Where(r => r.TreeId == q.TreeId)
            .ToListAsync(ct);
        return Result<IReadOnlyList<RelationshipDto>>.Ok(rels.Select(CreateRelationshipHandler.ToDto).ToList());
    }
}
