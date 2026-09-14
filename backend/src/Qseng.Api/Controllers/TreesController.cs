using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Qseng.Application.Trees.CreateTree;
using Qseng.Application.Trees.DeleteTree;
using Qseng.Application.Trees.GetTrees;
using Qseng.Application.Trees.UpdateTree;

namespace Qseng.Api.Controllers;

[ApiController]
[Authorize]
[Produces("application/json")]
[Route("api/v1/trees")]
public class TreesController : ControllerBase
{
    private readonly ISender _mediator;
    public TreesController(ISender mediator) => _mediator = mediator;

    [HttpGet]
    [ProducesResponseType(typeof(List<TreeDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(CancellationToken ct) =>
        (await _mediator.Send(new GetTreesQuery(), ct)).ToActionResult();

    [HttpPost]
    [ProducesResponseType(typeof(TreeDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Create(CreateTreeRequest r, CancellationToken ct) =>
        (await _mediator.Send(new CreateTreeCommand(r.Name, r.Description), ct)).ToActionResult();

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(TreeDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(Guid id, UpdateTreeRequest r, CancellationToken ct) =>
        (await _mediator.Send(new UpdateTreeCommand(id, r.Name, r.Description), ct)).ToActionResult();

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        (await _mediator.Send(new DeleteTreeCommand(id), ct)).ToActionResult();
}

public record CreateTreeRequest(string Name, string? Description);
public record UpdateTreeRequest(string Name, string? Description);
