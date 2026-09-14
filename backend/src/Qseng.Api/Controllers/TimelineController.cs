using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Qseng.Application.Timeline;
using Qseng.Application.Timeline.AddTimelineEvent;
using Qseng.Application.Timeline.DeleteTimelineEvent;
using Qseng.Application.Timeline.GetPersonTimeline;
using Qseng.Application.Timeline.RestoreTimelineEvent;
using Qseng.Application.Timeline.UpdateTimelineEvent;
using Qseng.Domain.Enums;
using Qseng.Domain.ValueObjects;

namespace Qseng.Api.Controllers;

[ApiController]
[Authorize]
[Produces("application/json")]
[Route("api/v1/persons/{personId:guid}/timeline")]
public class TimelineController : ControllerBase
{
    private readonly ISender _mediator;
    public TimelineController(ISender mediator) => _mediator = mediator;

    [HttpGet]
    [ProducesResponseType(typeof(List<TimelineEventDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(Guid personId, CancellationToken ct) =>
        (await _mediator.Send(new GetPersonTimelineQuery(personId), ct)).ToActionResult();

    [HttpPost]
    [ProducesResponseType(typeof(TimelineEventDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Add(Guid personId, TimelineEventRequest r, CancellationToken ct) =>
        (await _mediator.Send(new AddTimelineEventCommand(
            personId, r.Type, r.Title, r.Description, r.Start, r.End, r.Location, r.MetadataJson), ct)).ToActionResult();

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(TimelineEventDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(Guid personId, Guid id, TimelineEventRequest r, CancellationToken ct) =>
        (await _mediator.Send(new UpdateTimelineEventCommand(
            id, r.Type, r.Title, r.Description, r.Start, r.End, r.Location, r.MetadataJson), ct)).ToActionResult();

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Delete(Guid personId, Guid id, CancellationToken ct) =>
        (await _mediator.Send(new DeleteTimelineEventCommand(id), ct)).ToActionResult();

    [HttpPost("{id:guid}/restore")]
    [ProducesResponseType(typeof(TimelineEventDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Restore(Guid personId, Guid id, CancellationToken ct) =>
        (await _mediator.Send(new RestoreTimelineEventCommand(personId, id), ct)).ToActionResult();
}

public record TimelineEventRequest(
    TimelineEventType Type, string Title, string? Description,
    PartialDate? Start, PartialDate? End, string? Location, string? MetadataJson);
