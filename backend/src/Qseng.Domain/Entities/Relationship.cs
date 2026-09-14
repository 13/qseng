using Qseng.Domain.Common;
using Qseng.Domain.Enums;

namespace Qseng.Domain.Entities;

public class Relationship : Entity, ISoftDeletable
{
    public Guid TreeId { get; set; }
    public Guid FromPersonId { get; set; }
    public Guid ToPersonId { get; set; }
    public RelationshipType Type { get; set; }
    public int? StartYear { get; set; }
    public int? StartMonth { get; set; }
    public int? StartDay { get; set; }
    public int? EndYear { get; set; }
    public int? EndMonth { get; set; }
    public int? EndDay { get; set; }
    public string? Notes { get; set; }
    public DateTime? DeletedAt { get; set; }
    public Guid? DeletionBatchId { get; set; }
}
