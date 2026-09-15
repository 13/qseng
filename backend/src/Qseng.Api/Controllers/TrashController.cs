using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Qseng.Application.Trash;
using Qseng.Application.Trash.ListTrash;
using Qseng.Application.Trash.PurgeTrashItem;

namespace Qseng.Api.Controllers;

[ApiController]
[Authorize]
[Produces("application/json")]
[Route("api/v1/trash")]
public class TrashController : ControllerBase
{
    private readonly ISender _mediator;
    public TrashController(ISender mediator) => _mediator = mediator;

    [HttpGet]
    [ProducesResponseType(typeof(TrashListDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(CancellationToken ct) =>
        (await _mediator.Send(new ListTrashQuery(), ct)).ToActionResult();

    [HttpDelete("{personId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Purge(Guid personId, CancellationToken ct) =>
        (await _mediator.Send(new PurgeTrashItemCommand(personId), ct)).ToActionResult();
}
