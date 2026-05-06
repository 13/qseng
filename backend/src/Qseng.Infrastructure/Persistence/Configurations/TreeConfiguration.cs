using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Qseng.Domain.Entities;

namespace Qseng.Infrastructure.Persistence.Configurations;

public class TreeConfiguration : IEntityTypeConfiguration<Tree>
{
    public void Configure(EntityTypeBuilder<Tree> e)
    {
        e.ToTable("trees");
        e.HasKey(x => x.Id);
        e.Property(x => x.Name).HasMaxLength(200).IsRequired();
        e.Property(x => x.Description).HasMaxLength(1000);
        e.HasIndex(x => x.OwnerId);

        e.HasOne<User>()
            .WithMany()
            .HasForeignKey(x => x.OwnerId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
