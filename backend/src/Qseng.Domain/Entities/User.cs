using Qseng.Domain.Common;

namespace Qseng.Domain.Entities;

public class User : Entity
{
    public string Username { get; set; } = "";
    public string? Email { get; set; }
    public string PasswordHash { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public bool IsAdmin { get; set; }
    public bool IsActive { get; set; } = true;
    public string Language { get; set; } = "de";
}
