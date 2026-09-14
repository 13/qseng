using Qseng.Domain.Common;

namespace Qseng.Domain.Entities;

/// <summary>
/// Only the SHA-256 hash of the token is persisted, so a database leak does not
/// hand out usable sessions.
/// </summary>
public class RefreshToken : Entity
{
    public Guid UserId { get; set; }
    public string TokenHash { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }

    public bool IsActive(DateTime utcNow) => RevokedAt is null && utcNow < ExpiresAt;
}
