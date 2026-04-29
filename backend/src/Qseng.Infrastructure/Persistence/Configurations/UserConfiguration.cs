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
        e.Property(x => x.Email).HasMaxLength(256).IsRequired();
        e.HasIndex(x => x.Email).IsUnique();
        e.Property(x => x.PasswordHash).IsRequired();
        e.Property(x => x.DisplayName).HasMaxLength(100).IsRequired();
    }
}
