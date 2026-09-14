using MediatR;
using Microsoft.AspNetCore.Mvc;
using Qseng.Application.Auth.Login;
using Qseng.Application.Auth.Refresh;
using Qseng.Application.Auth.Register;

namespace Qseng.Api.Controllers;

[ApiController]
[Produces("application/json")]
[Route("api/v1/auth")]
public class AuthController : ControllerBase
{
    private readonly ISender _mediator;
    public AuthController(ISender mediator) => _mediator = mediator;

    [HttpPost("register")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Register(RegisterRequest r, CancellationToken ct) =>
        (await _mediator.Send(new RegisterCommand(r.Username, r.Password, r.DisplayName, r.Email), ct)).ToActionResult();

    [HttpPost("login")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Login(LoginRequest r, CancellationToken ct) =>
        (await _mediator.Send(new LoginCommand(r.Username, r.Password), ct)).ToActionResult();

    [HttpPost("refresh")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Refresh(RefreshRequest r, CancellationToken ct) =>
        (await _mediator.Send(new RefreshCommand(r.RefreshToken), ct)).ToActionResult();

    [HttpPost("logout")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Logout(RefreshRequest r, CancellationToken ct) =>
        (await _mediator.Send(new LogoutCommand(r.RefreshToken), ct)).ToActionResult();
}

public record RegisterRequest(string Username, string Password, string? DisplayName, string? Email);
public record LoginRequest(string Username, string Password);
public record RefreshRequest(string RefreshToken);
