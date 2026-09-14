using MediatR;
using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;
using Qseng.Application.Relationships.CreateRelationship;
using Qseng.Domain.Common;

namespace Qseng.Application.Relationships.RestoreRelationship;

public record RestoreRelationshipCommand(Guid TreeId, Guid Id) : IRequest<Result<RelationshipDto>>;

public class RestoreRelationshipHandler : IRequestHandler<RestoreRelationshipCommand, Result<RelationshipDto>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _currentUser;
    public RestoreRelationshipHandler(IQsengDbContext db, ICurrentUser currentUser) { _db = db; _currentUser = currentUser; }

    public async Task<Result<RelationshipDto>> Handle(RestoreRelationshipCommand cmd, CancellationToken ct)
    {
        var rel = await _db.Relationships.IgnoreQueryFilters()
            .FirstOrDefaultAsync(r => r.Id == cmd.Id && r.TreeId == cmd.TreeId && r.DeletedAt != null, ct);
        if (rel is null) return Result<RelationshipDto>.NotFound("Relationship not found in the trash.");

        var tree = await _db.Trees.FindAsync([rel.TreeId], ct);
        if (tree is null || tree.OwnerId != _currentUser.UserId) return Result<RelationshipDto>.Fail("Forbidden.", 403);

        if (!await _db.Persons.AnyAsync(p => p.Id == rel.FromPersonId, ct) ||
            !await _db.Persons.AnyAsync(p => p.Id == rel.ToPersonId, ct))
            return Result<RelationshipDto>.Conflict("Restore the person first.");

        var batch = rel.DeletionBatchId;
        static void Revive(ISoftDeletable row) { row.DeletedAt = null; row.DeletionBatchId = null; }
        Revive(rel);
        if (batch is not null)
            foreach (var e in await _db.TimelineEvents.IgnoreQueryFilters().Where(e => e.DeletionBatchId == batch).ToListAsync(ct)) Revive(e);

        await _db.SaveChangesAsync(ct);
        return Result<RelationshipDto>.Ok(CreateRelationshipHandler.ToDto(rel));
    }
}
