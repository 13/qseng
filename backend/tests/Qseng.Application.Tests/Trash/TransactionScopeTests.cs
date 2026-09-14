using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Application.Media.SetAvatar;
using Qseng.Domain.Enums;
using Xunit;
using MediaEntity = Qseng.Domain.Entities.Media;

namespace Qseng.Application.Tests.Trash;

public class TransactionScopeTests
{
    [Fact]
    public async Task SetAvatar_is_all_or_nothing()
    {
        var (db, owner, a, _, _, _, media) = await TrashFixtures.SeedFamilyAsync();   // media is the avatar
        var other = new MediaEntity { PersonId = a.Id, Url = "/u/b.jpg", Kind = MediaKind.Photo };
        db.Media.Add(other); await db.SaveChangesAsync();
        // simulate a failure between the two saves by cancelling after the first
        using var cts = new CancellationTokenSource();
        var failing = new FailingAfterFirstSaveDb(db, cts);
        var act = () => new SetAvatarHandler(failing, TrashFixtures.FakeUser(owner)).Handle(new SetAvatarCommand(a.Id, other.Id), cts.Token);
        await act.Should().ThrowAsync<OperationCanceledException>();
        (await db.Media.CountAsync(m => m.IsAvatar)).Should().Be(1, "the old avatar is kept when the swap fails");
        (await db.Media.SingleAsync(m => m.IsAvatar)).Id.Should().Be(media.Id);
    }
}

/// <summary>
/// Forwards every member to the real context but cancels <paramref name="cts"/>
/// right after the first <see cref="SaveChangesAsync"/> completes, so the second
/// save (called with the now-cancelled token) throws before it can run — the
/// same shape a real mid-transaction failure would take. BeginTransactionAsync
/// delegates to the inner context so the transaction, and therefore the
/// rollback, is real SQLite.
/// </summary>
internal sealed class FailingAfterFirstSaveDb : IQsengDbContext
{
    private readonly IQsengDbContext _inner;
    private readonly CancellationTokenSource _cts;
    private int _saveCount;

    public FailingAfterFirstSaveDb(IQsengDbContext inner, CancellationTokenSource cts)
    { _inner = inner; _cts = cts; }

    public DbSet<Qseng.Domain.Entities.User> Users => _inner.Users;
    public DbSet<Qseng.Domain.Entities.RefreshToken> RefreshTokens => _inner.RefreshTokens;
    public DbSet<Qseng.Domain.Entities.Tree> Trees => _inner.Trees;
    public DbSet<Qseng.Domain.Entities.Person> Persons => _inner.Persons;
    public DbSet<Qseng.Domain.Entities.Relationship> Relationships => _inner.Relationships;
    public DbSet<Qseng.Domain.Entities.TimelineEvent> TimelineEvents => _inner.TimelineEvents;
    public DbSet<MediaEntity> Media => _inner.Media;
    public DbSet<Qseng.Domain.Entities.ImportJob> ImportJobs => _inner.ImportJobs;
    public DbSet<Qseng.Domain.Entities.SiteSettings> SiteSettings => _inner.SiteSettings;

    public async Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        var result = await _inner.SaveChangesAsync(ct);
        _saveCount++;
        if (_saveCount == 1) _cts.Cancel();
        return result;
    }

    public Task<ITransactionScope> BeginTransactionAsync(CancellationToken ct = default) => _inner.BeginTransactionAsync(ct);
}
