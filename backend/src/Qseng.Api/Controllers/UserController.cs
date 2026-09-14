using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Qseng.Application.Auth.Register;
using Qseng.Application.Users;

namespace Qseng.Api.Controllers;

[ApiController]
[Authorize]
[Produces("application/json")]
[Route("api/v1/user")]
public class UserController : ControllerBase
{
    private readonly ISender _mediator;
    public UserController(ISender mediator) => _mediator = mediator;

    [HttpGet("profile")]
    [ProducesResponseType(typeof(UserProfileDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetProfile(CancellationToken ct) =>
        (await _mediator.Send(new GetProfileQuery(), ct)).ToActionResult();

    [HttpPatch("password")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest r, CancellationToken ct) =>
        (await _mediator.Send(new ChangePasswordCommand(r.CurrentPassword, r.NewPassword), ct)).ToActionResult();

    [HttpPatch("language")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> ChangeLanguage(ChangeLanguageRequest r, CancellationToken ct) =>
        (await _mediator.Send(new ChangeLanguageCommand(r.Language), ct)).ToActionResult();

    [HttpGet("export")]
    [ProducesResponseType(typeof(ExportDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Export(CancellationToken ct) =>
        (await _mediator.Send(new ExportDataQuery(), ct)).ToActionResult();

    [HttpDelete("data")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> DeleteData(DeleteDataRequest r, CancellationToken ct) =>
        (await _mediator.Send(new DeleteOwnDataCommand(r.Password), ct)).ToActionResult();

    [HttpDelete("account")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> DeleteAccount(DeleteAccountRequest r, CancellationToken ct) =>
        (await _mediator.Send(new DeleteOwnAccountCommand(r.Password), ct)).ToActionResult();
}

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public record ChangeLanguageRequest(string Language);
public record DeleteDataRequest(string Password);
public record DeleteAccountRequest(string Password);
