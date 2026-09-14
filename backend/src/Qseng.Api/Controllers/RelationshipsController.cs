using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Qseng.Application.Relationships;
using Qseng.Application.Relationships.CreateRelationship;
using Qseng.Application.Relationships.DeleteRelationship;
using Qseng.Application.Relationships.GetRelationshipsByTree;
using Qseng.Domain.Enums;

namespace Qseng.Api.Controllers;

[ApiController]
[Authorize]
[Produces("application/json")]
[Route("api/v1/trees/{treeId:guid}/relationships")]
public class RelationshipsController : ControllerBase
{
    private readonly ISender _mediator;
    public RelationshipsController(ISender mediator) => _mediator = mediator;

    [HttpGet]
    [ProducesResponseType(typeof(List<RelationshipDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetByTree(Guid treeId, CancellationToken ct) =>
        (await _mediator.Send(new GetRelationshipsByTreeQuery(treeId), ct)).ToActionResult();

    [HttpPost]
    [ProducesResponseType(typeof(RelationshipDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Create(Guid treeId, RelationshipRequest r, CancellationToken ct) =>
        (await _mediator.Send(new CreateRelationshipCommand(
            treeId, r.FromPersonId, r.ToPersonId, r.Type,
            r.StartYear, r.StartMonth, r.StartDay,
            r.EndYear, r.EndMonth, r.EndDay, r.Notes), ct)).ToActionResult();

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Delete(Guid treeId, Guid id, CancellationToken ct) =>
        (await _mediator.Send(new DeleteRelationshipCommand(id), ct)).ToActionResult();
}

public record RelationshipRequest(
    Guid FromPersonId, Guid ToPersonId, RelationshipType Type,
    int? StartYear, int? StartMonth, int? StartDay,
    int? EndYear, int? EndMonth, int? EndDay, string? Notes);
