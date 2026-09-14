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

        var person = await _db.Persons.FirstOrDefaultAsync(p => p.Id == cmd.PersonId, ct);
        if (person is null) return Result<TimelineEventDto>.Conflict("Restore the person first.");

        var tree = await _db.Trees.FindAsync([person.TreeId], ct);
        if (tree is null || tree.OwnerId != _currentUser.UserId) return Result<TimelineEventDto>.Fail("Forbidden.", 403);

        ev.DeletedAt = null;
        ev.DeletionBatchId = null;
        await _db.SaveChangesAsync(ct);
        return Result<TimelineEventDto>.Ok(AddTimelineEventHandler.ToDto(ev));
    }
}
