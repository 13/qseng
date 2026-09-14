using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Domain.Entities;

namespace Qseng.Infrastructure.Persistence;

public abstract class QsengDbContext : DbContext, IQsengDbContext
{
    protected QsengDbContext(DbContextOptions options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Tree> Trees => Set<Tree>();
    public DbSet<Person> Persons => Set<Person>();
    public DbSet<Relationship> Relationships => Set<Relationship>();
    public DbSet<TimelineEvent> TimelineEvents => Set<TimelineEvent>();
    public DbSet<Media> Media => Set<Media>();
    public DbSet<ImportJob> ImportJobs => Set<ImportJob>();
    public DbSet<SiteSettings> SiteSettings => Set<SiteSettings>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.ApplyConfigurationsFromAssembly(typeof(QsengDbContext).Assembly);

        // Trash: one filter per soft-deletable type so no read path can forget it.
        // Handlers that need trashed rows call IgnoreQueryFilters() explicitly.
        b.Entity<Person>().HasQueryFilter(p => p.DeletedAt == null);
        b.Entity<Relationship>().HasQueryFilter(r => r.DeletedAt == null);
        b.Entity<TimelineEvent>().HasQueryFilter(e => e.DeletedAt == null);
        b.Entity<Media>().HasQueryFilter(m => m.DeletedAt == null);

        // "At most one avatar per person", enforced by the database instead of
        // trusting every write path to clear the previous one. SQLite stores
        // booleans as 0/1, Postgres as a real boolean, so the filter differs.
        b.Entity<Media>()
            .HasIndex(m => m.PersonId)
            .IsUnique()
            .HasFilter(AvatarIndexFilter)
            .HasDatabaseName("ix_media_person_avatar");
    }

    protected abstract string AvatarIndexFilter { get; }

    public override Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        SyncTimelineSortKeys();
        return base.SaveChangesAsync(ct);
    }

    public override int SaveChanges()
    {
        SyncTimelineSortKeys();
        return base.SaveChanges();
    }

    /// <summary>
    /// Keeps <see cref="TimelineEvent.StartSortKey"/> in step with the owned
    /// <c>Start</c> date. Mutating an owned type does not reliably mark the owner
    /// Modified, so every tracked event is recomputed rather than only the ones
    /// EF currently considers dirty.
    /// </summary>
    private void SyncTimelineSortKeys()
    {
        foreach (var entry in ChangeTracker.Entries<TimelineEvent>())
        {
            if (entry.State is EntityState.Deleted or EntityState.Detached) continue;
            entry.Entity.RecomputeSortKey();
        }
    }
}

/// <summary>
/// Provider-specific contexts exist so each database keeps its own migration
/// chain: EF migrations bake in provider column types and cannot be shared.
/// </summary>
public sealed class SqliteQsengDbContext : QsengDbContext
{
    public SqliteQsengDbContext(DbContextOptions<SqliteQsengDbContext> options) : base(options) { }
    protected override string AvatarIndexFilter => "\"IsAvatar\" = 1";
}

public sealed class PostgresQsengDbContext : QsengDbContext
{
    public PostgresQsengDbContext(DbContextOptions<PostgresQsengDbContext> options) : base(options) { }
    protected override string AvatarIndexFilter => "\"IsAvatar\"";
}
