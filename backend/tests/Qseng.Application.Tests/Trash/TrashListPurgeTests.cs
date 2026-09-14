using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using NSubstitute;
using Qseng.Application.Abstractions;
using Qseng.Application.Persons.DeletePerson;
using Qseng.Application.Timeline.DeleteTimelineEvent;
using Qseng.Application.Trash;
using Qseng.Application.Trash.ListTrash;
using Qseng.Application.Trash.PurgeTrashItem;
using Qseng.Domain.Entities;
using Qseng.Domain.Enums;
using Xunit;

namespace Qseng.Application.Tests.Trash;

public class TrashListPurgeTests
{
    [Fact]
    public async Task List_returns_only_the_callers_trashed_persons_newest_first_with_purge_date()
    {
        var (db, owner, a, b, _, _, _) = await TrashFixtures.SeedFamilyAsync();
        var user = TrashFixtures.FakeUser(owner);
        var storage = Substitute.For<IFileStorage>();
        await new DeletePersonHandler(db, user, storage).Handle(new DeletePersonCommand(a.Id), CancellationToken.None);
        await Task.Delay(5);
        await new DeletePersonHandler(db, user, storage).Handle(new DeletePersonCommand(b.Id), CancellationToken.None);
        // another owner's trashed person must not show
        var other = TestDb.AddOwner(db).Id; var otherTree = new Tree { OwnerId = other, Name = "O" }; db.Trees.Add(otherTree);
        db.Persons.Add(new Person { TreeId = otherTree.Id, FirstName = "X", LastName = "Y", DeletedAt = DateTime.UtcNow, DeletionBatchId = Guid.NewGuid() });
        await db.SaveChangesAsync();

        var result = await new ListTrashHandler(db, user, Options.Create(new TrashOptions { RetentionDays = 30 })).Handle(new ListTrashQuery(), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.RetentionDays.Should().Be(30);
        result.Value.Items.Select(i => i.Id).Should().Equal(b.Id, a.Id);
        result.Value.Items[0].TreeName.Should().Be("T");
        result.Value.Items[0].PurgeAt.Should().BeCloseTo(result.Value.Items[0].DeletedAt.AddDays(30), TimeSpan.FromSeconds(1));
    }

    [Fact]
    public async Task Purge_removes_exactly_the_batch_and_its_files()
    {
        var (db, owner, a, b, rel, ev, media) = await TrashFixtures.SeedFamilyAsync();
        var user = TrashFixtures.FakeUser(owner);
        await new DeletePersonHandler(db, user, Substitute.For<IFileStorage>()).Handle(new DeletePersonCommand(a.Id), CancellationToken.None);
        var storage = Substitute.For<IFileStorage>();
        var result = await new PurgeTrashItemHandler(db, user, new TrashPurger(db, storage, NullLogger<TrashPurger>.Instance)).Handle(new PurgeTrashItemCommand(a.Id), CancellationToken.None);
        result.IsSuccess.Should().BeTrue();
        await storage.Received(1).DeleteAsync("/u/a.jpg", Arg.Any<CancellationToken>());
        (await db.Persons.IgnoreQueryFilters().CountAsync()).Should().Be(1);
        (await db.Relationships.IgnoreQueryFilters().CountAsync()).Should().Be(0);
        (await db.Persons.CountAsync(p => p.Id == b.Id)).Should().Be(1);
    }

    [Fact]
    public async Task Purge_of_a_live_person_is_404_and_of_someone_elses_is_403()
    {
        var (db, owner, a, _, _, _, _) = await TrashFixtures.SeedFamilyAsync();
        var storage = Substitute.For<IFileStorage>();
        var purger = new TrashPurger(db, storage, NullLogger<TrashPurger>.Instance);
        (await new PurgeTrashItemHandler(db, TrashFixtures.FakeUser(owner), purger).Handle(new PurgeTrashItemCommand(a.Id), CancellationToken.None)).StatusCode.Should().Be(404);
        await new DeletePersonHandler(db, TrashFixtures.FakeUser(owner), Substitute.For<IFileStorage>()).Handle(new DeletePersonCommand(a.Id), CancellationToken.None);
        (await new PurgeTrashItemHandler(db, TrashFixtures.FakeUser(Guid.NewGuid()), purger).Handle(new PurgeTrashItemCommand(a.Id), CancellationToken.None)).StatusCode.Should().Be(403);
        await storage.DidNotReceive().DeleteAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task PurgeBatch_of_a_person_with_no_deletion_batch_does_not_delete_other_owners_live_events()
    {
        var (db, owner, a, b, _, _, _) = await TrashFixtures.SeedFamilyAsync();
        // Trashed directly (not via DeletePersonHandler), so DeletionBatchId stays null —
        // the same shape a hand-seeded or legacy row would have.
        var trashed = await db.Persons.FirstAsync(p => p.Id == a.Id);
        trashed.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        // A live event that belongs to a different person and, like every untouched row,
        // also has a null DeletionBatchId — the buggy `e.DeletionBatchId == person.DeletionBatchId`
        // comparison would match this row and delete it too.
        var otherEvent = new TimelineEvent { PersonId = b.Id, Type = TimelineEventType.Birth, Title = "Born" };
        db.TimelineEvents.Add(otherEvent);
        await db.SaveChangesAsync();

        await new TrashPurger(db, Substitute.For<IFileStorage>(), NullLogger<TrashPurger>.Instance)
            .PurgeBatchAsync(trashed, CancellationToken.None);

        (await db.TimelineEvents.IgnoreQueryFilters().AnyAsync(e => e.Id == otherEvent.Id)).Should().BeTrue();
    }

    [Fact]
    public async Task PurgeBatch_nulls_the_source_relationship_on_a_live_event_of_the_other_person()
    {
        var (db, owner, a, b, rel, _, _) = await TrashFixtures.SeedFamilyAsync();
        // Live event of B, sourced from the A-B relationship, untouched by any earlier soft-delete.
        var bEvent = new TimelineEvent
        {
            PersonId = b.Id, Type = TimelineEventType.Marriage, Title = "Wedding",
            IsAutoGenerated = true, SourceRelationshipId = rel.Id
        };
        db.TimelineEvents.Add(bEvent);
        await db.SaveChangesAsync();

        // Trash A directly (not via DeletePersonHandler, which would also stamp bEvent since it
        // hangs off A's relationship) so the relationship itself is still live going into the purge.
        var trashed = await db.Persons.FirstAsync(p => p.Id == a.Id);
        trashed.DeletedAt = DateTime.UtcNow;
        trashed.DeletionBatchId = Guid.NewGuid();
        await db.SaveChangesAsync();

        await new TrashPurger(db, Substitute.For<IFileStorage>(), NullLogger<TrashPurger>.Instance)
            .PurgeBatchAsync(trashed, CancellationToken.None);

        // Purging A hard-deletes the A-B relationship (it touches A); bEvent must survive with
        // its reference set to null rather than being dropped or left dangling.
        var survivor = await db.TimelineEvents.SingleAsync(e => e.Id == bEvent.Id);
        survivor.SourceRelationshipId.Should().BeNull();
        (await db.Relationships.IgnoreQueryFilters().AnyAsync(r => r.Id == rel.Id)).Should().BeFalse();
    }

    [Fact]
    public async Task Timeline_delete_is_scoped_to_the_person()
    {
        var (db, owner, a, b, _, ev, _) = await TrashFixtures.SeedFamilyAsync();
        var h = new DeleteTimelineEventHandler(db, TrashFixtures.FakeUser(owner));
        (await h.Handle(new DeleteTimelineEventCommand(b.Id, ev.Id), CancellationToken.None)).StatusCode.Should().Be(404);
        (await h.Handle(new DeleteTimelineEventCommand(a.Id, ev.Id), CancellationToken.None)).IsSuccess.Should().BeTrue();
    }
}
