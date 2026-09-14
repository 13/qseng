using MediatR;
using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;

namespace Qseng.Application.Timeline.DeleteTimelineEvent;

public record DeleteTimelineEventCommand(Guid Id) : IRequest<Result<bool>>;

public class DeleteTimelineEventHandler : IRequestHandler<DeleteTimelineEventCommand, Result<bool>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _currentUser;

    public DeleteTimelineEventHandler(IQsengDbContext db, ICurrentUser currentUser)
    { _db = db; _currentUser = currentUser; }

    public async Task<Result<bool>> Handle(DeleteTimelineEventCommand cmd, CancellationToken ct)
    {
        var ev = await _db.TimelineEvents.FirstOrDefaultAsync(e => e.Id == cmd.Id, ct);
        if (ev is null) return Result<bool>.NotFound("Event not found.");

        var person = await _db.Persons.FindAsync([ev.PersonId], ct);
        var tree = person is null ? null : await _db.Trees.FindAsync([person.TreeId], ct);
        if (tree is null || tree.OwnerId != _currentUser.UserId) return Result<bool>.Fail("Forbidden.", 403);

        ev.DeletedAt = DateTime.UtcNow;
        ev.DeletionBatchId = Guid.NewGuid();
        await _db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}
