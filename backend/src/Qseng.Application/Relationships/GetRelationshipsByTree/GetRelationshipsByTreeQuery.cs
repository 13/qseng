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
    public GetRelationshipsByTreeHandler(IQsengDbContext db) => _db = db;

    public async Task<Result<IReadOnlyList<RelationshipDto>>> Handle(GetRelationshipsByTreeQuery q, CancellationToken ct)
    {
        var rels = await _db.Relationships
            .Where(r => r.TreeId == q.TreeId)
            .ToListAsync(ct);
        return Result<IReadOnlyList<RelationshipDto>>.Ok(rels.Select(CreateRelationshipHandler.ToDto).ToList());
    }
}
