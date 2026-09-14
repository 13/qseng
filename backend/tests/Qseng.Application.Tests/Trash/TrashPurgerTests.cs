using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Qseng.Application.Abstractions;
using Qseng.Application.Persons.DeletePerson;
using Qseng.Application.Trash;
using Qseng.Domain.Enums;
using Xunit;

namespace Qseng.Application.Tests.Trash;

public class TrashPurgerTests
{
    [Fact]
    public async Task Purge_removes_rows_older_than_the_cutoff_and_their_files_only()
    {
        var (db, owner, a, b, rel, ev, media) = await TrashFixtures.SeedFamilyAsync();
        var user = TrashFixtures.FakeUser(owner);
        await new DeletePersonHandler(db, user, Substitute.For<IFileStorage>()).Handle(new DeletePersonCommand(a.Id), CancellationToken.None);
        // age the batch by 40 days
        foreach (var row in await db.Persons.IgnoreQueryFilters().Where(p => p.DeletedAt != null).ToListAsync()) row.DeletedAt = DateTime.UtcNow.AddDays(-40);
        foreach (var row in await db.Relationships.IgnoreQueryFilters().Where(p => p.DeletedAt != null).ToListAsync()) row.DeletedAt = DateTime.UtcNow.AddDays(-40);
        foreach (var row in await db.TimelineEvents.IgnoreQueryFilters().Where(p => p.DeletedAt != null).ToListAsync()) row.DeletedAt = DateTime.UtcNow.AddDays(-40);
        foreach (var row in await db.Media.IgnoreQueryFilters().Where(p => p.DeletedAt != null).ToListAsync()) row.DeletedAt = DateTime.UtcNow.AddDays(-40);
        var recent = new Qseng.Domain.Entities.Media { PersonId = b.Id, Url = "/u/recent.jpg", Kind = MediaKind.Photo, DeletedAt = DateTime.UtcNow.AddDays(-1), DeletionBatchId = Guid.NewGuid() };
        db.Media.Add(recent);
        await db.SaveChangesAsync();
        var storage = Substitute.For<IFileStorage>();

        var removed = await new TrashPurger(db, storage, NullLogger<TrashPurger>.Instance).PurgeAsync(DateTime.UtcNow.AddDays(-30), CancellationToken.None);

        removed.Should().Be(4);
        await storage.Received(1).DeleteAsync("/u/a.jpg", Arg.Any<CancellationToken>());
        await storage.DidNotReceive().DeleteAsync("/u/recent.jpg", Arg.Any<CancellationToken>());
        (await db.Persons.IgnoreQueryFilters().CountAsync()).Should().Be(1);
        (await db.Media.IgnoreQueryFilters().CountAsync()).Should().Be(1);
    }
}
