using Qseng.Domain.Common;
using Qseng.Domain.Enums;

namespace Qseng.Domain.Entities;

public class Media : Entity
{
    public Guid PersonId { get; set; }
    public string Url { get; set; } = "";
    public string? Caption { get; set; }
    public MediaKind Kind { get; set; }
}
