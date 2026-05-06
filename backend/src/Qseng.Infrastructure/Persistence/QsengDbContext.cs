using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Domain.Entities;

namespace Qseng.Infrastructure.Persistence;

public class QsengDbContext : DbContext, IQsengDbContext
{
    public QsengDbContext(DbContextOptions<QsengDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
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
    }
}
