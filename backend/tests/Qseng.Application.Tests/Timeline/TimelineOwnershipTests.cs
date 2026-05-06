using FluentAssertions;
using NSubstitute;
using Xunit;
using Qseng.Application.Abstractions;
using Qseng.Application.Timeline.DeleteTimelineEvent;
using Qseng.Application.Timeline.UpdateTimelineEvent;
using Qseng.Domain.Entities;
using Qseng.Domain.Enums;

namespace Qseng.Application.Tests.Timeline;

public class TimelineOwnershipTests
{
    private static ICurrentUser FakeUser(Guid userId)
    {
        var u = Substitute.For<ICurrentUser>();
        u.UserId.Returns(userId);
        return u;
    }

    private static async Task<(IQsengDbContext db, TimelineEvent ev, Guid ownerId)> SetupAsync()
    {
        var db = TestDb.Create();
        var ownerId = Guid.NewGuid();
        var tree = new Tree { OwnerId = ownerId, Name = "T" };
        db.Trees.Add(tree);
        var person = new Person { TreeId = tree.Id, FirstName = "A", LastName = "B" };
        db.Persons.Add(person);
        var ev = new TimelineEvent { PersonId = person.Id, Type = TimelineEventType.Custom, Title = "Test event" };
        db.TimelineEvents.Add(ev);
        await db.SaveChangesAsync();
        return (db, ev, ownerId);
    }

    // --- UpdateTimelineEvent ---

    [Fact]
    public async Task UpdateTimelineEvent_owner_succeeds()
    {
        var (db, ev, ownerId) = await SetupAsync();
        var handler = new UpdateTimelineEventHandler(db, FakeUser(ownerId));
        var cmd = new UpdateTimelineEventCommand(ev.Id, TimelineEventType.Move, "Updated", null, null, null, null, null);

        var result = await handler.Handle(cmd, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Title.Should().Be("Updated");
    }

    [Fact]
    public async Task UpdateTimelineEvent_non_owner_gets_403()
    {
        var (db, ev, _) = await SetupAsync();
        var handler = new UpdateTimelineEventHandler(db, FakeUser(Guid.NewGuid()));
        var cmd = new UpdateTimelineEventCommand(ev.Id, TimelineEventType.Move, "X", null, null, null, null, null);

        var result = await handler.Handle(cmd, CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.StatusCode.Should().Be(403);
    }

    // --- DeleteTimelineEvent ---

    [Fact]
    public async Task DeleteTimelineEvent_owner_succeeds()
    {
        var (db, ev, ownerId) = await SetupAsync();
        var handler = new DeleteTimelineEventHandler(db, FakeUser(ownerId));

        var result = await handler.Handle(new DeleteTimelineEventCommand(ev.Id), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteTimelineEvent_non_owner_gets_403()
    {
        var (db, ev, _) = await SetupAsync();
        var handler = new DeleteTimelineEventHandler(db, FakeUser(Guid.NewGuid()));

        var result = await handler.Handle(new DeleteTimelineEventCommand(ev.Id), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.StatusCode.Should().Be(403);
    }
}
