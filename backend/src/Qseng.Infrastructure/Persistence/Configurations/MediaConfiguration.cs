using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Qseng.Domain.Entities;

namespace Qseng.Infrastructure.Persistence.Configurations;

public class MediaConfiguration : IEntityTypeConfiguration<Media>
{
    public void Configure(EntityTypeBuilder<Media> e)
    {
        e.ToTable("media");
        e.HasKey(x => x.Id);
        e.Property(x => x.Url).HasMaxLength(2048).IsRequired();
        e.Property(x => x.Caption).HasMaxLength(500);
        e.Property(x => x.IsAvatar).HasDefaultValue(false).IsRequired();
        e.HasIndex(x => x.PersonId);

        // The "at most one avatar per person" unique index needs a provider-specific
        // filter (booleans differ), so QsengDbContext.OnModelCreating adds it.
        e.HasOne<Person>()
         .WithMany()
         .HasForeignKey(x => x.PersonId)
         .OnDelete(DeleteBehavior.Cascade);
    }
}
