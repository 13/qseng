using Microsoft.EntityFrameworkCore;
using Qseng.Domain.Entities;

namespace Qseng.Application.Abstractions;

public interface IQsengDbContext
{
    DbSet<User> Users { get; }
    DbSet<Tree> Trees { get; }
    DbSet<Person> Persons { get; }
    DbSet<Relationship> Relationships { get; }
    DbSet<TimelineEvent> TimelineEvents { get; }
    DbSet<Media> Media { get; }
    DbSet<ImportJob> ImportJobs { get; }
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
