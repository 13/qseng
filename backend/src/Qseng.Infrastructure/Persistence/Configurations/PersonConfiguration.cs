using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Qseng.Domain.Entities;

namespace Qseng.Infrastructure.Persistence.Configurations;

public class PersonConfiguration : IEntityTypeConfiguration<Person>
{
    public void Configure(EntityTypeBuilder<Person> e)
    {
        e.ToTable("persons");
        e.HasKey(x => x.Id);
        e.Property(x => x.FirstName).HasMaxLength(200).IsRequired();
        e.Property(x => x.LastName).HasMaxLength(200).IsRequired();
        e.Property(x => x.MaidenName).HasMaxLength(200);
        e.Property(x => x.Notes);
        e.Property(x => x.CauseOfDeath);

        e.OwnsOne(x => x.Birth, p =>
        {
            p.Property(x => x.Year).HasColumnName("birth_year");
            p.Property(x => x.Month).HasColumnName("birth_month");
            p.Property(x => x.Day).HasColumnName("birth_day");
            p.Property(x => x.Approx).HasColumnName("birth_approx");
        });
        e.OwnsOne(x => x.Death, p =>
        {
            p.Property(x => x.Year).HasColumnName("death_year");
            p.Property(x => x.Month).HasColumnName("death_month");
            p.Property(x => x.Day).HasColumnName("death_day");
            p.Property(x => x.Approx).HasColumnName("death_approx");
        });

        e.HasIndex(x => x.TreeId);
        e.HasIndex(x => new { x.TreeId, x.LastName, x.FirstName });
        e.HasIndex(x => x.DeletedAt);

        e.HasOne<Tree>()
            .WithMany()
            .HasForeignKey(x => x.TreeId)
            .OnDelete(DeleteBehavior.Cascade);

        e.HasMany(x => x.Timeline)
         .WithOne()
         .HasForeignKey(t => t.PersonId)
         .OnDelete(DeleteBehavior.Cascade);
    }
}
