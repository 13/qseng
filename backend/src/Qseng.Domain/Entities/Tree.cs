using Qseng.Domain.Common;

namespace Qseng.Domain.Entities;

public class Tree : Entity
{
    public Guid OwnerId { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
}
