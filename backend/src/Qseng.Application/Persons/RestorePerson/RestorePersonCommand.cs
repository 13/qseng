using MediatR;
using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;
using Qseng.Application.Persons.CreatePerson;
using Qseng.Domain.Common;

namespace Qseng.Application.Persons.RestorePerson;

public record RestorePersonCommand(Guid Id) : IRequest<Result<PersonDto>>;

public class RestorePersonHandler : IRequestHandler<RestorePersonCommand, Result<PersonDto>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _currentUser;
    public RestorePersonHandler(IQsengDbContext db, ICurrentUser currentUser) { _db = db; _currentUser = currentUser; }

    public async Task<Result<PersonDto>> Handle(RestorePersonCommand cmd, CancellationToken ct)
    {
        var person = await _db.Persons.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == cmd.Id && p.DeletedAt != null, ct);
        if (person is null) return Result<PersonDto>.NotFound("Person not found in the trash.");
        var tree = await _db.Trees.FindAsync([person.TreeId], ct);
        if (tree is null || tree.OwnerId != _currentUser.UserId) return Result<PersonDto>.Fail("Forbidden.", 403);

        var batch = person.DeletionBatchId;
        static void Revive(ISoftDeletable row) { row.DeletedAt = null; row.DeletionBatchId = null; }
        Revive(person);
        if (batch is not null)
        {
            foreach (var r in await _db.Relationships.IgnoreQueryFilters().Where(r => r.DeletionBatchId == batch).ToListAsync(ct)) Revive(r);
            foreach (var e in await _db.TimelineEvents.IgnoreQueryFilters().Where(e => e.DeletionBatchId == batch).ToListAsync(ct)) Revive(e);
            foreach (var m in await _db.Media.IgnoreQueryFilters().Where(m => m.DeletionBatchId == batch).ToListAsync(ct)) Revive(m);
        }
        await _db.SaveChangesAsync(ct);
        var avatar = await _db.Media.Where(m => m.PersonId == person.Id && m.IsAvatar).Select(m => m.Url).FirstOrDefaultAsync(ct);
        return Result<PersonDto>.Ok(CreatePersonHandler.ToDto(person, avatar));
    }
}
