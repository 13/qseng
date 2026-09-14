using Qseng.Domain.Common;
using Qseng.Domain.Enums;

namespace Qseng.Domain.Entities;

public class Media : Entity, ISoftDeletable
{
    public Guid PersonId { get; set; }
    public string Url { get; set; } = "";
    public string? Caption { get; set; }
    public MediaKind Kind { get; set; }

    /// <summary>At most one per person; enforced by a filtered unique index.</summary>
    public bool IsAvatar { get; set; }
    public DateTime? DeletedAt { get; set; }
    public Guid? DeletionBatchId { get; set; }
}
