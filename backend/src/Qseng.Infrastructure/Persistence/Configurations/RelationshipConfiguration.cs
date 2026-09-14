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
        e.HasIndex(x => x.DeletedAt);
        // The live-only unique edge index (TreeId, FromPersonId, ToPersonId, Type)
        // lives in QsengDbContext.OnModelCreating next to ix_media_person_avatar,
        // filtered to DeletedAt IS NULL so a trashed relationship never blocks
        // re-creating the same live edge.

        e.HasOne<Tree>()
            .WithMany()
            .HasForeignKey(x => x.TreeId)
            .OnDelete(DeleteBehavior.Cascade);

        e.HasOne<Person>()
            .WithMany()
            .HasForeignKey(x => x.FromPersonId)
            .OnDelete(DeleteBehavior.Cascade);

        e.HasOne<Person>()
            .WithMany()
            .HasForeignKey(x => x.ToPersonId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
