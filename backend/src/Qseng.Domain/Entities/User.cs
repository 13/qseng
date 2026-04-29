using Qseng.Domain.Common;

namespace Qseng.Domain.Entities;

public class User : Entity
{
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiry { get; set; }
}
