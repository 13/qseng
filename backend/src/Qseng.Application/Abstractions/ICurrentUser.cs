namespace Qseng.Application.Abstractions;

public interface ICurrentUser
{
    Guid UserId { get; }
    bool IsAuthenticated { get; }
    bool IsAdmin { get; }
}
