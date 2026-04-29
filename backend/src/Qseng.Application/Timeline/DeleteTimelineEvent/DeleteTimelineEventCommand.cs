using MediatR;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;

namespace Qseng.Application.Timeline.DeleteTimelineEvent;

public record DeleteTimelineEventCommand(Guid Id) : IRequest<Result<bool>>;

public class DeleteTimelineEventHandler : IRequestHandler<DeleteTimelineEventCommand, Result<bool>>
{
    private readonly IQsengDbContext _db;
    public DeleteTimelineEventHandler(IQsengDbContext db) => _db = db;

    public async Task<Result<bool>> Handle(DeleteTimelineEventCommand cmd, CancellationToken ct)
    {
        var ev = await _db.TimelineEvents.FindAsync([cmd.Id], ct);
        if (ev is null) return Result<bool>.NotFound("Event not found.");
        _db.TimelineEvents.Remove(ev);
        await _db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}
