using Qseng.Domain.Common;

namespace Qseng.Domain.Entities;

public class ImportJob : Entity
{
    public Guid UserId { get; set; }
    public Guid TreeId { get; set; }
    public string Status { get; set; } = "pending";
    public string RawText { get; set; } = "";
    public string? ReportJson { get; set; }
}
