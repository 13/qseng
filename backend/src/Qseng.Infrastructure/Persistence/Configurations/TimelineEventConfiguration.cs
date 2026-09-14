using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Qseng.Domain.Entities;

namespace Qseng.Infrastructure.Persistence.Configurations;

public class TimelineEventConfiguration : IEntityTypeConfiguration<TimelineEvent>
{
    public void Configure(EntityTypeBuilder<TimelineEvent> e)
    {
        e.ToTable("timeline_events");
        e.HasKey(x => x.Id);
        e.Property(x => x.Title).HasMaxLength(300).IsRequired();
        e.Property(x => x.Location).HasMaxLength(300);
        e.Property(x => x.MetadataJson);

        e.OwnsOne(x => x.Start, p =>
        {
            p.Property(x => x.Year).HasColumnName("start_year");
            p.Property(x => x.Month).HasColumnName("start_month");
            p.Property(x => x.Day).HasColumnName("start_day");
            p.Property(x => x.Approx).HasColumnName("start_approx");
        });
        e.OwnsOne(x => x.End, p =>
        {
            p.Property(x => x.Year).HasColumnName("end_year");
            p.Property(x => x.Month).HasColumnName("end_month");
            p.Property(x => x.Day).HasColumnName("end_day");
            p.Property(x => x.Approx).HasColumnName("end_approx");
        });

        e.Property(x => x.StartSortKey).HasDefaultValue(0).IsRequired();

        e.HasIndex(x => x.PersonId);
        // Covers the timeline query: filter by person, order by date descending.
        e.HasIndex(x => new { x.PersonId, x.StartSortKey })
            .HasDatabaseName("ix_timeline_events_person_sort");
        e.HasIndex(x => x.DeletedAt);

        e.Ignore(x => x.SortableDate);

        e.HasOne<Relationship>()
            .WithMany()
            .HasForeignKey(x => x.SourceRelationshipId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
