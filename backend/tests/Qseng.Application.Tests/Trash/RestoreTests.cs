using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Qseng.Application.Abstractions;
using Qseng.Application.Media.DeleteMedia;
using Qseng.Application.Media.RestoreMedia;
using Qseng.Application.Persons.DeletePerson;
using Qseng.Application.Persons.RestorePerson;
using Qseng.Application.Relationships.RestoreRelationship;
using Qseng.Application.Timeline.DeleteTimelineEvent;
using Qseng.Application.Timeline.RestoreTimelineEvent;
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
        await new DeleteTimelineEventHandler(db, user).Handle(new DeleteTimelineEventCommand(ev.Id), CancellationToken.None);
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
}
