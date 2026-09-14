using FluentAssertions;
using NSubstitute;
using Xunit;
using Qseng.Application.Abstractions;
using Qseng.Application.Persons.DeletePerson;
using Qseng.Application.Persons.UpdatePerson;
using Qseng.Domain.Entities;
using Qseng.Domain.Enums;

namespace Qseng.Application.Tests.Persons;

public class PersonOwnershipTests
{
    private static ICurrentUser FakeUser(Guid userId)
    {
        var u = Substitute.For<ICurrentUser>();
        u.UserId.Returns(userId);
        return u;
    }

    private static async Task<(IQsengDbContext db, Person person, Guid ownerId)> SetupAsync()
    {
        var db = TestDb.Create();
        var ownerId = TestDb.AddOwner(db).Id;
        var tree = new Tree { OwnerId = ownerId, Name = "T" };
        db.Trees.Add(tree);
        var person = new Person { TreeId = tree.Id, FirstName = "Max", LastName = "M" };
        db.Persons.Add(person);
        await db.SaveChangesAsync();
        return (db, person, ownerId);
    }

    // --- UpdatePerson ---

    [Fact]
    public async Task UpdatePerson_owner_succeeds()
    {
        var (db, person, ownerId) = await SetupAsync();
        var handler = new UpdatePersonHandler(db, FakeUser(ownerId));
        var cmd = new UpdatePersonCommand(person.Id, "New", "Name", null, Sex.Male, null, null, null, null, null, null);

        var result = await handler.Handle(cmd, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.FirstName.Should().Be("New");
    }

    [Fact]
    public async Task UpdatePerson_non_owner_gets_403()
    {
        var (db, person, _) = await SetupAsync();
        var handler = new UpdatePersonHandler(db, FakeUser(Guid.NewGuid()));
        var cmd = new UpdatePersonCommand(person.Id, "X", "Y", null, Sex.Male, null, null, null, null, null, null);

        var result = await handler.Handle(cmd, CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task UpdatePerson_missing_person_returns_404()
    {
        var db = TestDb.Create();
        var handler = new UpdatePersonHandler(db, FakeUser(Guid.NewGuid()));
        var cmd = new UpdatePersonCommand(Guid.NewGuid(), "X", "Y", null, Sex.Male, null, null, null, null, null, null);

        var result = await handler.Handle(cmd, CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.StatusCode.Should().Be(404);
    }

    // --- DeletePerson ---

    private static IFileStorage NoopStorage()
    {
        var fs = Substitute.For<IFileStorage>();
        fs.DeleteAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);
        return fs;
    }

    [Fact]
    public async Task DeletePerson_owner_succeeds()
    {
        var (db, person, ownerId) = await SetupAsync();
        var handler = new DeletePersonHandler(db, FakeUser(ownerId), NoopStorage());

        var result = await handler.Handle(new DeletePersonCommand(person.Id), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task DeletePerson_non_owner_gets_403()
    {
        var (db, person, _) = await SetupAsync();
        var handler = new DeletePersonHandler(db, FakeUser(Guid.NewGuid()), NoopStorage());

        var result = await handler.Handle(new DeletePersonCommand(person.Id), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.StatusCode.Should().Be(403);
    }
}
