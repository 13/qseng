using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Qseng.Application.Abstractions;
using Qseng.Application.Media.DeleteMedia;
using Qseng.Application.Persons.DeletePerson;
using Qseng.Application.Relationships.DeleteRelationship;
using Qseng.Application.Timeline.DeleteTimelineEvent;
using Qseng.Domain.Entities;
using Qseng.Domain.Enums;
using Xunit;

namespace Qseng.Application.Tests.Trash;

public class SoftDeleteTests
{
    [Fact]
    public async Task Stamped_rows_are_hidden_by_the_query_filter_and_visible_with_IgnoreQueryFilters()
    {
        var db = TestDb.Create();
        var tree = new Tree { OwnerId = Guid.NewGuid(), Name = "T" };
        db.Trees.Add(tree);
        var live = new Person { TreeId = tree.Id, FirstName = "Live", LastName = "P" };
        var gone = new Person { TreeId = tree.Id, FirstName = "Gone", LastName = "P", DeletedAt = DateTime.UtcNow, DeletionBatchId = Guid.NewGuid() };
        db.Persons.AddRange(live, gone);
        await db.SaveChangesAsync();

        (await db.Persons.CountAsync()).Should().Be(1);
        (await db.Persons.IgnoreQueryFilters().CountAsync()).Should().Be(2);
    }

    [Fact]
    public async Task DeletePerson_stamps_person_relationships_events_and_media_with_one_batch()
    {
        var (db, owner, a, b, rel, ev, media) = await TrashFixtures.SeedFamilyAsync();
        var storage = Substitute.For<IFileStorage>();
        var result = await new DeletePersonHandler(db, TrashFixtures.FakeUser(owner), storage).Handle(new DeletePersonCommand(a.Id), CancellationToken.None);
        result.IsSuccess.Should().BeTrue();
        await storage.DidNotReceive().DeleteAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());

        var persons = await db.Persons.IgnoreQueryFilters().ToListAsync();
        var gone = persons.Single(p => p.Id == a.Id);
        gone.DeletedAt.Should().NotBeNull();
        gone.DeletionBatchId.Should().NotBeNull();
        persons.Single(p => p.Id == b.Id).DeletedAt.Should().BeNull();
        (await db.Relationships.IgnoreQueryFilters().SingleAsync(r => r.Id == rel.Id)).DeletionBatchId.Should().Be(gone.DeletionBatchId);
        (await db.TimelineEvents.IgnoreQueryFilters().SingleAsync(e => e.Id == ev.Id)).DeletionBatchId.Should().Be(gone.DeletionBatchId);
        (await db.Media.IgnoreQueryFilters().SingleAsync(m => m.Id == media.Id)).DeletionBatchId.Should().Be(gone.DeletionBatchId);
        (await db.Persons.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task DeleteRelationship_stamps_relationship_and_its_auto_events_only()
    {
        var (db, owner, a, _, rel, ev, _) = await TrashFixtures.SeedFamilyAsync();
        var manual = new TimelineEvent { PersonId = a.Id, Type = TimelineEventType.Custom, Title = "Manual" };
        db.TimelineEvents.Add(manual);
        await db.SaveChangesAsync();
        var result = await new DeleteRelationshipHandler(db, TrashFixtures.FakeUser(owner)).Handle(new DeleteRelationshipCommand(rel.Id), CancellationToken.None);
        result.IsSuccess.Should().BeTrue();
        (await db.Relationships.CountAsync()).Should().Be(0);
        (await db.TimelineEvents.IgnoreQueryFilters().SingleAsync(e => e.Id == ev.Id)).DeletedAt.Should().NotBeNull();
        (await db.TimelineEvents.SingleAsync(e => e.Id == manual.Id)).DeletedAt.Should().BeNull();
    }

    [Fact]
    public async Task DeleteMedia_keeps_the_file_and_promotes_the_next_photo()
    {
        var (db, owner, a, _, _, _, media) = await TrashFixtures.SeedFamilyAsync();
        var other = new Qseng.Domain.Entities.Media { PersonId = a.Id, Url = "/u/b.jpg", Kind = MediaKind.Photo };
        db.Media.Add(other);
        await db.SaveChangesAsync();
        var storage = Substitute.For<IFileStorage>();
        var result = await new DeleteMediaHandler(db, TrashFixtures.FakeUser(owner), storage).Handle(new DeleteMediaCommand(a.Id, media.Id), CancellationToken.None);
        result.IsSuccess.Should().BeTrue();
        await storage.DidNotReceive().DeleteAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
        (await db.Media.SingleAsync(m => m.Id == other.Id)).IsAvatar.Should().BeTrue();
        (await db.Media.IgnoreQueryFilters().SingleAsync(m => m.Id == media.Id)).IsAvatar.Should().BeFalse("the filtered unique avatar index must not see two avatars");
    }

    [Fact]
    public async Task Deleting_an_already_trashed_person_returns_404()
    {
        var (db, owner, a, _, _, _, _) = await TrashFixtures.SeedFamilyAsync();
        var h = new DeletePersonHandler(db, TrashFixtures.FakeUser(owner), Substitute.For<IFileStorage>());
        await h.Handle(new DeletePersonCommand(a.Id), CancellationToken.None);
        var again = await h.Handle(new DeletePersonCommand(a.Id), CancellationToken.None);
        again.StatusCode.Should().Be(404);
    }
}
