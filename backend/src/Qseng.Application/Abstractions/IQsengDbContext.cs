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
    Task<ITransactionScope> BeginTransactionAsync(CancellationToken ct = default);
}

/// <summary>
/// A database transaction spanning more than one <c>SaveChangesAsync</c> call.
/// Disposing without calling <see cref="CompleteAsync"/> rolls back — the same
/// "throw inside the using block" pattern as any other scope guard, so a
/// handler that wraps a multi-save sequence in this and lets an exception
/// propagate gets an automatic rollback for free.
/// </summary>
public interface ITransactionScope : IAsyncDisposable
{
    Task CompleteAsync(CancellationToken ct = default);
}
