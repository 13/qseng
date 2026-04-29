using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Qseng.Application.Persons.CreatePerson;
using Qseng.Application.Persons.DeletePerson;
using Qseng.Application.Persons.GetPersonById;
using Qseng.Application.Persons.GetPersonsByTree;
using Qseng.Application.Persons.GetPersonRelations;
using Qseng.Application.Persons.UpdatePerson;
using Qseng.Domain.Enums;
using Qseng.Domain.ValueObjects;

namespace Qseng.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1")]
public class PersonsController : ControllerBase
{
    private readonly ISender _mediator;
    public PersonsController(ISender mediator) => _mediator = mediator;

    [HttpGet("trees/{treeId:guid}/persons")]
    public async Task<IActionResult> GetByTree(Guid treeId, [FromQuery] string? search, CancellationToken ct) =>
        (await _mediator.Send(new GetPersonsByTreeQuery(treeId, search), ct)).ToActionResult();

    [HttpGet("persons/{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct) =>
        (await _mediator.Send(new GetPersonByIdQuery(id), ct)).ToActionResult();

    [HttpPost("trees/{treeId:guid}/persons")]
    public async Task<IActionResult> Create(Guid treeId, PersonRequest r, CancellationToken ct) =>
        (await _mediator.Send(new CreatePersonCommand(
            treeId, r.FirstName, r.LastName, r.MaidenName,
            r.Sex, r.Notes, r.Birth, r.Death, r.BirthPlace, r.DeathPlace), ct)).ToActionResult();

    [HttpPut("persons/{id:guid}")]
    public async Task<IActionResult> Update(Guid id, PersonRequest r, CancellationToken ct) =>
        (await _mediator.Send(new UpdatePersonCommand(
            id, r.FirstName, r.LastName, r.MaidenName,
            r.Sex, r.Notes, r.Birth, r.Death, r.BirthPlace, r.DeathPlace), ct)).ToActionResult();

    [HttpGet("persons/{id:guid}/relations")]
    public async Task<IActionResult> GetRelations(Guid id, CancellationToken ct) =>
        (await _mediator.Send(new GetPersonRelationsQuery(id), ct)).ToActionResult();

    [HttpDelete("persons/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        (await _mediator.Send(new DeletePersonCommand(id), ct)).ToActionResult();
}

public record PersonRequest(
    string FirstName, string LastName, string? MaidenName,
    Sex Sex, string? Notes,
    PartialDate? Birth, PartialDate? Death,
    string? BirthPlace, string? DeathPlace);
