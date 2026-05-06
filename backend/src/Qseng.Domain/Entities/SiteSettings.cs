using Qseng.Domain.Common;

namespace Qseng.Domain.Entities;

public class SiteSettings : Entity
{
    public static readonly Guid SettingsId = new("00000000-0000-0000-0000-000000000001");

    public bool RegistrationEnabled { get; set; } = true;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
