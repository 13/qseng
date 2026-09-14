using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Qseng.Application.Media;
using Qseng.Application.Media.DeleteMedia;
using Qseng.Application.Media.GetPersonMedia;
using Qseng.Application.Media.RestoreMedia;
using Qseng.Application.Media.SetAvatar;
using Qseng.Application.Media.UploadMedia;
using Qseng.Domain.Enums;

namespace Qseng.Api.Controllers;

[ApiController]
[Authorize]
[Produces("application/json")]
[Route("api/v1")]
public class MediaController : ControllerBase
{
    private readonly ISender _mediator;
    public MediaController(ISender mediator) => _mediator = mediator;

    [HttpGet("persons/{personId:guid}/media")]
    [ProducesResponseType(typeof(List<MediaDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMedia(Guid personId, CancellationToken ct) =>
        (await _mediator.Send(new GetPersonMediaQuery(personId), ct)).ToActionResult();

    [HttpPost("persons/{personId:guid}/media")]
    [RequestSizeLimit(20_971_520)] // 20 MB
    [RequestFormLimits(MultipartBodyLengthLimit = 20_971_520)]
    [ProducesResponseType(typeof(MediaDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Upload(
        Guid personId, IFormFile file,
        [FromForm] string? caption,
        [FromForm] string? kind,
        CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return ResultExtensions.Problem(StatusCodes.Status400BadRequest, "No file provided.");

        var mediaKind = Enum.TryParse<MediaKind>(kind, ignoreCase: true, out var k) ? k : MediaKind.Photo;
        using var stream = file.OpenReadStream();
        var result = await _mediator.Send(new UploadMediaCommand(personId, file.FileName, stream, caption, mediaKind), ct);
        return result.IsSuccess ? StatusCode(201, result.Value) : result.ToActionResult();
    }

    [HttpPut("persons/{personId:guid}/media/{mediaId:guid}/avatar")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> SetAvatar(Guid personId, Guid mediaId, CancellationToken ct) =>
        (await _mediator.Send(new SetAvatarCommand(personId, mediaId), ct)).ToActionResult();

    [HttpDelete("persons/{personId:guid}/media/{mediaId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Delete(Guid personId, Guid mediaId, CancellationToken ct) =>
        (await _mediator.Send(new DeleteMediaCommand(personId, mediaId), ct)).ToActionResult();

    [HttpPost("persons/{personId:guid}/media/{mediaId:guid}/restore")]
    [ProducesResponseType(typeof(MediaDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Restore(Guid personId, Guid mediaId, CancellationToken ct) =>
        (await _mediator.Send(new RestoreMediaCommand(personId, mediaId), ct)).ToActionResult();
}
