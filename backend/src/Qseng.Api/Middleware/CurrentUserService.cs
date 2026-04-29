using System.Security.Claims;
using Qseng.Application.Abstractions;

namespace Qseng.Api.Middleware;

public class CurrentUserService : ICurrentUser
{
    private readonly IHttpContextAccessor _accessor;
    public CurrentUserService(IHttpContextAccessor accessor) => _accessor = accessor;

    public Guid UserId
    {
        get
        {
            var sub = _accessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier)
                   ?? _accessor.HttpContext?.User.FindFirstValue("sub");
            return Guid.TryParse(sub, out var id) ? id : Guid.Empty;
        }
    }

    public bool IsAuthenticated =>
        _accessor.HttpContext?.User.Identity?.IsAuthenticated == true;
}
