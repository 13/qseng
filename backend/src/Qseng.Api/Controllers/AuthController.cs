using MediatR;
using Microsoft.AspNetCore.Mvc;
using Qseng.Application.Auth.Login;
using Qseng.Application.Auth.Register;

namespace Qseng.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public class AuthController : ControllerBase
{
    private readonly ISender _mediator;
    public AuthController(ISender mediator) => _mediator = mediator;

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest r, CancellationToken ct) =>
        (await _mediator.Send(new RegisterCommand(r.Email, r.Password, r.DisplayName), ct)).ToActionResult();

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest r, CancellationToken ct) =>
        (await _mediator.Send(new LoginCommand(r.Email, r.Password), ct)).ToActionResult();
}

public record RegisterRequest(string Email, string Password, string DisplayName);
public record LoginRequest(string Email, string Password);
