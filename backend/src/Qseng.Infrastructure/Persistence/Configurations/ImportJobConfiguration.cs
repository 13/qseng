using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Qseng.Domain.Entities;

namespace Qseng.Infrastructure.Persistence.Configurations;

public class ImportJobConfiguration : IEntityTypeConfiguration<ImportJob>
{
    public void Configure(EntityTypeBuilder<ImportJob> e)
    {
        e.ToTable("import_jobs");
        e.HasKey(x => x.Id);
        e.Property(x => x.Status).HasMaxLength(50).IsRequired();
        e.HasIndex(x => x.UserId);
    }
}
