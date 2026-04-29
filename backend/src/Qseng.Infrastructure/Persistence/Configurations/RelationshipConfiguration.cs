using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Qseng.Domain.Entities;

namespace Qseng.Infrastructure.Persistence.Configurations;

public class RelationshipConfiguration : IEntityTypeConfiguration<Relationship>
{
    public void Configure(EntityTypeBuilder<Relationship> e)
    {
        e.ToTable("relationships");
        e.HasKey(x => x.Id);
        e.HasIndex(x => new { x.TreeId, x.FromPersonId });
        e.HasIndex(x => new { x.TreeId, x.ToPersonId });
        e.HasIndex(x => new { x.TreeId, x.FromPersonId, x.ToPersonId, x.Type }).IsUnique();
    }
}
