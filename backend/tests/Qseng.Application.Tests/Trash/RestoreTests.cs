using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Qseng.Application.Abstractions;
using Qseng.Application.Media.DeleteMedia;
using Qseng.Application.Media.RestoreMedia;
using Qseng.Application.Persons.DeletePerson;
using Qseng.Application.Persons.RestorePerson;
using Qseng.Application.Relationships.CreateRelationship;
using Qseng.Application.Relationships.DeleteRelationship;
using Qseng.Application.Relationships.RestoreRelationship;
using Qseng.Application.Timeline.DeleteTimelineEvent;
using Qseng.Application.Timeline.RestoreTimelineEvent;
using Qseng.Application.Users;
using Qseng.Domain.Entities;
using Qseng.Domain.Enums;
using Xunit;

namespace Qseng.Application.Tests.Trash;

public class RestoreTests
{
    [Fact]
    public async Task RestorePerson_revives_only_its_batch()
    {
        var (db, owner, a, b, rel, ev, media) = await TrashFixtures.SeedFamilyAsync();
        var user = TrashFixtures.FakeUser(owner);
        // an unrelated earlier delete: a second media row trashed on its own
        var old = new Qseng.Domain.Entities.Media { PersonId = a.Id, Url = "/u/old.jpg", Kind = MediaKind.Document, DeletedAt = DateTime.UtcNow.AddDays(-3), DeletionBatchId = Guid.NewGuid() };
        db.Media.Add(old); await db.SaveChangesAsync();
        await new DeletePersonHandler(db, user, Substitute.For<IFileStorage>()).Handle(new DeletePersonCommand(a.Id), CancellationToken.None);

        var result = await new RestorePersonHandler(db, user).Handle(new RestorePersonCommand(a.Id), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Id.Should().Be(a.Id);
        (await db.Persons.CountAsync()).Should().Be(2);
        (await db.Relationships.CountAsync()).Should().Be(1);
        (await db.TimelineEvents.CountAsync()).Should().Be(1);
        (await db.Media.CountAsync()).Should().Be(1, "the media trashed in an earlier batch stays in the trash");
        (await db.Media.SingleAsync()).IsAvatar.Should().BeTrue("avatar flag restored with the batch");
    }

    [Fact]
    public async Task RestoreRelationship_of_a_trashed_person_returns_409()
    {
        var (db, owner, a, _, rel, _, _) = await TrashFixtures.SeedFamilyAsync();
        var user = TrashFixtures.FakeUser(owner);
        await new DeletePersonHandler(db, user, Substitute.For<IFileStorage>()).Handle(new DeletePersonCommand(a.Id), CancellationToken.None);
        var result = await new RestoreRelationshipHandler(db, user).Handle(new RestoreRelationshipCommand(rel.TreeId, rel.Id), CancellationToken.None);
        result.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task Restore_live_or_unknown_row_returns_404_and_non_owner_403()
    {
        var (db, owner, a, _, _, ev, _) = await TrashFixtures.SeedFamilyAsync();
        var user = TrashFixtures.FakeUser(owner);
        (await new RestoreTimelineEventHandler(db, user).Handle(new RestoreTimelineEventCommand(a.Id, ev.Id), CancellationToken.None)).StatusCode.Should().Be(404);
        (await new RestoreTimelineEventHandler(db, user).Handle(new RestoreTimelineEventCommand(a.Id, Guid.NewGuid()), CancellationToken.None)).StatusCode.Should().Be(404);
        await new DeleteTimelineEventHandler(db, user).Handle(new DeleteTimelineEventCommand(a.Id, ev.Id), CancellationToken.None);
        (await new RestoreTimelineEventHandler(db, TrashFixtures.FakeUser(Guid.NewGuid())).Handle(new RestoreTimelineEventCommand(a.Id, ev.Id), CancellationToken.None)).StatusCode.Should().Be(403);
        (await new RestoreTimelineEventHandler(db, user).Handle(new RestoreTimelineEventCommand(a.Id, ev.Id), CancellationToken.None)).IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task RestoreMedia_revives_the_row_without_reclaiming_the_avatar()
    {
        var (db, owner, a, _, _, _, media) = await TrashFixtures.SeedFamilyAsync();
        var user = TrashFixtures.FakeUser(owner);
        var other = new Qseng.Domain.Entities.Media { PersonId = a.Id, Url = "/u/b.jpg", Kind = MediaKind.Photo };
        db.Media.Add(other); await db.SaveChangesAsync();
        await new DeleteMediaHandler(db, user, Substitute.For<IFileStorage>()).Handle(new DeleteMediaCommand(a.Id, media.Id), CancellationToken.None);
        var result = await new RestoreMediaHandler(db, user).Handle(new RestoreMediaCommand(a.Id, media.Id), CancellationToken.None);
        result.IsSuccess.Should().BeTrue();
        (await db.Media.CountAsync(m => m.IsAvatar)).Should().Be(1, "the promoted photo keeps the avatar");
    }

    // --- C1: live-only unique edge index ---

    [Fact]
    public async Task RestoreRelationship_conflicts_when_a_live_duplicate_already_exists()
    {
        var (db, owner, a, b, rel, _, _) = await TrashFixtures.SeedFamilyAsync();
        var user = TrashFixtures.FakeUser(owner);
        await new DeleteRelationshipHandler(db, user).Handle(new DeleteRelationshipCommand(rel.Id), CancellationToken.None);

        // A live duplicate of the same edge is created while the original sits in the trash.
        var recreated = await new CreateRelationshipHandler(db, user).Handle(
            new CreateRelationshipCommand(rel.TreeId, a.Id, b.Id, rel.Type, null, null, null, null, null, null, null),
            CancellationToken.None);
        recreated.IsSuccess.Should().BeTrue("the filtered unique index must not see the trashed row");

        var result = await new RestoreRelationshipHandler(db, user).Handle(new RestoreRelationshipCommand(rel.TreeId, rel.Id), CancellationToken.None);

        result.StatusCode.Should().Be(409);
    }

    // --- I2: person restore must not revive a relationship whose other endpoint is still trashed ---

    [Fact]
    public async Task RestorePerson_does_not_revive_a_relationship_whose_other_endpoint_is_still_trashed()
    {
        var (db, owner, a, b, rel, _, _) = await TrashFixtures.SeedFamilyAsync();
        var user = TrashFixtures.FakeUser(owner);
        var storage = Substitute.For<IFileStorage>();
        await new DeletePersonHandler(db, user, storage).Handle(new DeletePersonCommand(a.Id), CancellationToken.None);
        await new DeletePersonHandler(db, user, storage).Handle(new DeletePersonCommand(b.Id), CancellationToken.None);

        var restoreA = await new RestorePersonHandler(db, user).Handle(new RestorePersonCommand(a.Id), CancellationToken.None);
        restoreA.IsSuccess.Should().BeTrue();

        (await db.Relationships.CountAsync()).Should().Be(0, "B is still trashed");
        (await db.Relationships.IgnoreQueryFilters().CountAsync()).Should().Be(1);
        (await db.Persons.IgnoreQueryFilters().SingleAsync(p => p.Id == b.Id)).DeletedAt.Should().NotBeNull("B was not restored");

        var restoreB = await new RestorePersonHandler(db, user).Handle(new RestorePersonCommand(b.Id), CancellationToken.None);
        restoreB.IsSuccess.Should().BeTrue();

        var restoreRel = await new RestoreRelationshipHandler(db, user)
            .Handle(new RestoreRelationshipCommand(rel.TreeId, rel.Id), CancellationToken.None);
        restoreRel.IsSuccess.Should().BeTrue("both endpoints are live again, so it is restorable on its own");
    }

    // --- I3: restore relationship runs the cycle check ---

    [Fact]
    public async Task RestoreRelationship_runs_the_cycle_check()
    {
        var (db, owner, a, b, _, _, _) = await TrashFixtures.SeedFamilyAsync();
        var user = TrashFixtures.FakeUser(owner);
        var tree = await db.Trees.SingleAsync();

        var r1 = await new CreateRelationshipHandler(db, user).Handle(
            new CreateRelationshipCommand(tree.Id, a.Id, b.Id, RelationshipType.Parent, null, null, null, null, null, null, null),
            CancellationToken.None);
        r1.IsSuccess.Should().BeTrue();
        var r1Id = r1.Value!.Id;

        await new DeleteRelationshipHandler(db, user).Handle(new DeleteRelationshipCommand(r1Id), CancellationToken.None);

        var r2 = await new CreateRelationshipHandler(db, user).Handle(
            new CreateRelationshipCommand(tree.Id, b.Id, a.Id, RelationshipType.Parent, null, null, null, null, null, null, null),
            CancellationToken.None);
        r2.IsSuccess.Should().BeTrue("R1 is trashed, so B-parent-of-A does not cycle yet");

        var restore = await new RestoreRelationshipHandler(db, user).Handle(new RestoreRelationshipCommand(tree.Id, r1Id), CancellationToken.None);

        restore.StatusCode.Should().Be(409);
    }

    // --- M3: restore relationship only revives its own auto-generated events ---

    [Fact]
    public async Task RestoreRelationship_only_revives_events_sourced_from_itself()
    {
        var (db, owner, a, b, rel, ev, _) = await TrashFixtures.SeedFamilyAsync();
        var user = TrashFixtures.FakeUser(owner);

        // A second relationship and its own auto-generated event, stamped into the
        // same deletion batch as rel/ev — simulating a person-level delete where
        // more than one relationship shares a DeletionBatchId.
        var c = new Person { TreeId = rel.TreeId, FirstName = "C", LastName = "X" };
        db.Persons.Add(c);
        var rel2 = new Relationship { TreeId = rel.TreeId, FromPersonId = a.Id, ToPersonId = c.Id, Type = RelationshipType.Parent };
        db.Relationships.Add(rel2);
        var ev2 = new TimelineEvent { PersonId = a.Id, Type = TimelineEventType.Custom, Title = "Other", IsAutoGenerated = true, SourceRelationshipId = rel2.Id };
        db.TimelineEvents.Add(ev2);
        await db.SaveChangesAsync();

        var batch = Guid.NewGuid();
        rel.DeletedAt = DateTime.UtcNow; rel.DeletionBatchId = batch;
        ev.DeletedAt = DateTime.UtcNow; ev.DeletionBatchId = batch;
        rel2.DeletedAt = DateTime.UtcNow; rel2.DeletionBatchId = batch;
        ev2.DeletedAt = DateTime.UtcNow; ev2.DeletionBatchId = batch;
        await db.SaveChangesAsync();

        var result = await new RestoreRelationshipHandler(db, user).Handle(new RestoreRelationshipCommand(rel.TreeId, rel.Id), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        (await db.TimelineEvents.SingleAsync(e => e.Id == ev.Id)).DeletedAt.Should().BeNull("sourced from the relationship being restored");
        (await db.TimelineEvents.IgnoreQueryFilters().SingleAsync(e => e.Id == ev2.Id)).DeletedAt.Should().NotBeNull("sourced from a different relationship sharing the batch id");
    }

    // --- Task 4 Step 3: DeleteOwnData removes trashed rows too, via the FK cascade ---

    [Fact]
    public async Task DeleteOwnData_removes_trashed_rows_too()
    {
        var (db, owner, a, _, _, _, _) = await TrashFixtures.SeedFamilyAsync();
        var user = TrashFixtures.FakeUser(owner);
        await new DeletePersonHandler(db, user, Substitute.For<IFileStorage>()).Handle(new DeletePersonCommand(a.Id), CancellationToken.None);

        var hasher = Substitute.For<IPasswordHasher>();
        hasher.Verify(Arg.Any<string>(), Arg.Any<string>()).Returns(true);

        var result = await new DeleteOwnDataHandler(db, user, hasher).Handle(new DeleteOwnDataCommand("pw"), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        (await db.Trees.IgnoreQueryFilters().CountAsync()).Should().Be(0);
        (await db.Persons.IgnoreQueryFilters().CountAsync()).Should().Be(0, "the FK cascade removes live and trashed rows alike");
        (await db.Relationships.IgnoreQueryFilters().CountAsync()).Should().Be(0);
        (await db.TimelineEvents.IgnoreQueryFilters().CountAsync()).Should().Be(0);
        (await db.Media.IgnoreQueryFilters().CountAsync()).Should().Be(0);
    }
}
