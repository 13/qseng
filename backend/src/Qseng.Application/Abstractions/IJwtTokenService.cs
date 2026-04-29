using Qseng.Domain.Entities;

namespace Qseng.Application.Abstractions;

public interface IJwtTokenService
{
    string GenerateAccessToken(User user);
}
