using MediatR;
using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;
using Qseng.Application.Timeline.AddTimelineEvent;

namespace Qseng.Application.Timeline.RestoreTimelineEvent;

public record RestoreTimelineEventCommand(Guid PersonId, Guid Id) : IRequest<Result<TimelineEventDto>>;

public class RestoreTimelineEventHandler : IRequestHandler<RestoreTimelineEventCommand, Result<TimelineEventDto>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _currentUser;
    public RestoreTimelineEventHandler(IQsengDbContext db, ICurrentUser currentUser) { _db = db; _currentUser = currentUser; }

    public async Task<Result<TimelineEventDto>> Handle(RestoreTimelineEventCommand cmd, CancellationToken ct)
    {
        var ev = await _db.TimelineEvents.IgnoreQueryFilters()
            .FirstOrDefaultAsync(e => e.Id == cmd.Id && e.PersonId == cmd.PersonId && e.DeletedAt != null, ct);
        if (ev is null) return Result<TimelineEventDto>.NotFound("Event not found in the trash.");

        // The owner check must run before the "person is trashed" conflict: an
        // outsider probing this endpoint should get 403, not learn the person's
        // trash state via a 409.
        var person = await _db.Persons.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == cmd.PersonId, ct);
        if (person is null) return Result<TimelineEventDto>.NotFound("Person not found.");

        var tree = await _db.Trees.FindAsync([person.TreeId], ct);
        if (tree is null || tree.OwnerId != _currentUser.UserId) return Result<TimelineEventDto>.Fail("Forbidden.", 403);

        if (person.DeletedAt is not null) return Result<TimelineEventDto>.Conflict("Restore the person first.");

        ev.DeletedAt = null;
        ev.DeletionBatchId = null;
        await _db.SaveChangesAsync(ct);
        return Result<TimelineEventDto>.Ok(AddTimelineEventHandler.ToDto(ev));
    }
}
