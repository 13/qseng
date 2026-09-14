using Qseng.Domain.Common;
using Qseng.Domain.Enums;
using Qseng.Domain.ValueObjects;

namespace Qseng.Domain.Entities;

public class Person : Entity, ISoftDeletable
{
    public Guid TreeId { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public string? MaidenName { get; set; }
    public Sex Sex { get; set; } = Sex.Male;
    public string? Notes { get; set; }
    public PartialDate? Birth { get; set; }
    public PartialDate? Death { get; set; }
    public string? BirthPlace { get; set; }
    public string? DeathPlace { get; set; }
    public string? CauseOfDeath { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? DeletedAt { get; set; }
    public Guid? DeletionBatchId { get; set; }

    private readonly List<TimelineEvent> _timeline = [];
    public IReadOnlyCollection<TimelineEvent> Timeline => _timeline;

    public void AddTimelineEvent(TimelineEvent e) => _timeline.Add(e);
}
