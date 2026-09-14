using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Qseng.Domain.Entities;

namespace Qseng.Infrastructure.Persistence.Configurations;

public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> e)
    {
        e.ToTable("refresh_tokens");
        e.HasKey(x => x.Id);

        // Hex-encoded SHA-256.
        e.Property(x => x.TokenHash).HasMaxLength(64).IsRequired();
        e.HasIndex(x => x.TokenHash).IsUnique();

        // Revoke-all and cleanup sweeps both filter on the owner.
        e.HasIndex(x => x.UserId);

        e.HasOne<User>()
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
