using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Qseng.Application.Admin;

namespace Qseng.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/admin")]
public class AdminController : ControllerBase
{
    private readonly ISender _mediator;
    public AdminController(ISender mediator) => _mediator = mediator;

    [HttpGet("users")]
    public async Task<IActionResult> ListUsers(CancellationToken ct) =>
        (await _mediator.Send(new ListUsersQuery(), ct)).ToActionResult();

    [HttpPost("users")]
    public async Task<IActionResult> CreateUser([FromBody] AdminCreateUserRequest r, CancellationToken ct) =>
        (await _mediator.Send(new AdminCreateUserCommand(r.Username, r.Password, r.DisplayName, r.Email, r.IsAdmin), ct))
            .ToActionResult();

    [HttpPatch("users/{id:guid}/active")]
    public async Task<IActionResult> SetActive(Guid id, [FromBody] SetActiveRequest r, CancellationToken ct) =>
        (await _mediator.Send(new SetUserActiveCommand(id, r.Active), ct)).ToActionResult();

    [HttpPatch("users/{id:guid}/admin")]
    public async Task<IActionResult> SetAdmin(Guid id, [FromBody] SetAdminRequest r, CancellationToken ct) =>
        (await _mediator.Send(new SetUserAdminCommand(id, r.Admin), ct)).ToActionResult();

    [HttpPatch("users/{id:guid}/password")]
    public async Task<IActionResult> ChangePassword(Guid id, [FromBody] AdminChangePasswordRequest r, CancellationToken ct) =>
        (await _mediator.Send(new AdminChangeUserPasswordCommand(id, r.NewPassword), ct)).ToActionResult();

    [HttpDelete("users/{id:guid}")]
    public async Task<IActionResult> DeleteUser(Guid id, CancellationToken ct) =>
        (await _mediator.Send(new AdminDeleteUserCommand(id), ct)).ToActionResult();

    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings(CancellationToken ct) =>
        (await _mediator.Send(new GetSiteSettingsQuery(), ct)).ToActionResult();

    [HttpPatch("settings/registration")]
    public async Task<IActionResult> SetRegistration([FromBody] SetRegistrationRequest r, CancellationToken ct) =>
        (await _mediator.Send(new SetRegistrationEnabledCommand(r.Enabled), ct)).ToActionResult();
}

public record SetActiveRequest(bool Active);
public record SetAdminRequest(bool Admin);
public record AdminCreateUserRequest(string Username, string Password, string? DisplayName, string? Email, bool IsAdmin);
public record AdminChangePasswordRequest(string NewPassword);
public record SetRegistrationRequest(bool Enabled);
