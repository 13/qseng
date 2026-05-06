using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Qseng.Domain.Entities;

namespace Qseng.Infrastructure.Persistence.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> e)
    {
        e.ToTable("users");
        e.HasKey(x => x.Id);
        e.Property(x => x.Username).HasMaxLength(50).IsRequired();
        e.HasIndex(x => x.Username).IsUnique();
        e.Property(x => x.Email).HasMaxLength(256);
        e.HasIndex(x => x.Email).IsUnique().HasFilter("\"Email\" IS NOT NULL");
        e.Property(x => x.PasswordHash).IsRequired();
        e.Property(x => x.DisplayName).HasMaxLength(100).IsRequired();
        e.Property(x => x.IsAdmin).HasDefaultValue(false).IsRequired();
        e.Property(x => x.IsActive).HasDefaultValue(true).IsRequired();
        e.Property(x => x.Language).HasMaxLength(10).HasDefaultValue("de").IsRequired();
    }
}
