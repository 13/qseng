namespace Qseng.Domain.Common;

/// <summary>Rows are stamped instead of removed; a batch id groups the rows one delete stamped.</summary>
public interface ISoftDeletable
{
    DateTime? DeletedAt { get; set; }
    Guid? DeletionBatchId { get; set; }
}
