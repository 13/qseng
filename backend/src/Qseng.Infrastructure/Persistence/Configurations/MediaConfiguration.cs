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
        e.HasIndex(x => x.PersonId);
    }
}
