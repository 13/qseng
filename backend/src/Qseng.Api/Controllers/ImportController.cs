using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Qseng.Application.Import;

namespace Qseng.Api.Controllers;

[ApiController]
[Authorize]
[Produces("application/json")]
[Route("api/v1/trees/{treeId:guid}/import")]
public class ImportController : ControllerBase
{
    private readonly ISender _mediator;
    public ImportController(ISender mediator) => _mediator = mediator;

    [HttpPost("preview")]
    [ProducesResponseType(typeof(ImportReport), StatusCodes.Status200OK)]
    public async Task<IActionResult> Preview(Guid treeId, ImportRequest r, CancellationToken ct) =>
        (await _mediator.Send(new ImportTextCommand(treeId, r.Text, DryRun: true), ct)).ToActionResult();

    [HttpPost("commit")]
    [ProducesResponseType(typeof(ImportReport), StatusCodes.Status200OK)]
    public async Task<IActionResult> Commit(Guid treeId, ImportRequest r, CancellationToken ct) =>
        (await _mediator.Send(new ImportTextCommand(treeId, r.Text, DryRun: false), ct)).ToActionResult();
}

public record ImportRequest(string Text);
