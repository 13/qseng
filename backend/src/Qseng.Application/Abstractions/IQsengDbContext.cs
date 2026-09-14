using Microsoft.EntityFrameworkCore;
using Qseng.Domain.Entities;
using MediaEntity = Qseng.Domain.Entities.Media;

namespace Qseng.Application.Abstractions;

public interface IQsengDbContext
{
    DbSet<User> Users { get; }
    DbSet<RefreshToken> RefreshTokens { get; }
    DbSet<Tree> Trees { get; }
    DbSet<Person> Persons { get; }
    DbSet<Relationship> Relationships { get; }
    DbSet<TimelineEvent> TimelineEvents { get; }
    DbSet<MediaEntity> Media { get; }
    DbSet<ImportJob> ImportJobs { get; }
    DbSet<SiteSettings> SiteSettings { get; }
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
