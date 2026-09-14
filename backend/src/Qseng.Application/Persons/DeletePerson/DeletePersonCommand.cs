using MediatR;
using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;
using Qseng.Domain.Common;

namespace Qseng.Application.Persons.DeletePerson;

public record DeletePersonCommand(Guid Id) : IRequest<Result<bool>>;

public class DeletePersonHandler : IRequestHandler<DeletePersonCommand, Result<bool>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _currentUser;
    private readonly IFileStorage _fileStorage;

    public DeletePersonHandler(IQsengDbContext db, ICurrentUser currentUser, IFileStorage fileStorage)
    { _db = db; _currentUser = currentUser; _fileStorage = fileStorage; }

    public async Task<Result<bool>> Handle(DeletePersonCommand cmd, CancellationToken ct)
    {
        var person = await _db.Persons.FirstOrDefaultAsync(p => p.Id == cmd.Id, ct);
        if (person is null) return Result<bool>.NotFound("Person not found.");
        var tree = await _db.Trees.FindAsync([person.TreeId], ct);
        if (tree is null || tree.OwnerId != _currentUser.UserId) return Result<bool>.Fail("Forbidden.", 403);

        var now = DateTime.UtcNow;
        var batch = Guid.NewGuid();
        void Stamp(ISoftDeletable row) { row.DeletedAt = now; row.DeletionBatchId = batch; }

        Stamp(person);
        var rels = await _db.Relationships.Where(r => r.FromPersonId == cmd.Id || r.ToPersonId == cmd.Id).ToListAsync(ct);
        foreach (var r in rels) Stamp(r);
        var relIds = rels.Select(r => r.Id).ToList();
        var events = await _db.TimelineEvents
            .Where(e => e.PersonId == cmd.Id || (e.SourceRelationshipId != null && relIds.Contains(e.SourceRelationshipId.Value)))
            .ToListAsync(ct);
        foreach (var e in events) Stamp(e);
        foreach (var m in await _db.Media.Where(m => m.PersonId == cmd.Id).ToListAsync(ct)) Stamp(m);

        await _db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}
