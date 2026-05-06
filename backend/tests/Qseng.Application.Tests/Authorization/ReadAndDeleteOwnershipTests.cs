using FluentAssertions;
using NSubstitute;
using Xunit;
using Qseng.Application.Abstractions;
using Qseng.Application.Persons.GetPersonById;
using Qseng.Application.Persons.GetPersonsByTree;
using Qseng.Application.Relationships.DeleteRelationship;
using Qseng.Domain.Entities;
using Qseng.Domain.Enums;
using Qseng.Domain.ValueObjects;

namespace Qseng.Application.Tests.Authorization;

public class ReadAndDeleteOwnershipTests
{
    private static ICurrentUser FakeUser(Guid userId)
    {
        var user = Substitute.For<ICurrentUser>();
        user.UserId.Returns(userId);
        return user;
    }

    private static async Task<(IQsengDbContext db, Tree tree, Person person, Relationship relationship, Guid ownerId)> SetupAsync()
    {
        var db = TestDb.Create();
        var ownerId = Guid.NewGuid();
        var tree = new Tree { OwnerId = ownerId, Name = "T" };
        db.Trees.Add(tree);

        var person = new Person
        {
            TreeId = tree.Id,
            FirstName = "Anna",
            LastName = "Muster",
            MaidenName = "Meyer",
            Birth = new PartialDate(1900, null, null),
            Death = new PartialDate(1980, null, null)
        };
        var related = new Person
        {
            TreeId = tree.Id,
            FirstName = "Paul",
            LastName = "Muster"
        };
        db.Persons.AddRange(person, related);

        var relationship = new Relationship
        {
            TreeId = tree.Id,
            FromPersonId = person.Id,
            ToPersonId = related.Id,
            Type = RelationshipType.Spouse
        };
        db.Relationships.Add(relationship);

        await db.SaveChangesAsync();
        return (db, tree, person, relationship, ownerId);
    }

    [Fact]
    public async Task GetPersonById_non_owner_is_forbidden()
    {
        var (db, _, person, _, _) = await SetupAsync();
        var handler = new GetPersonByIdHandler(db, FakeUser(Guid.NewGuid()));

        var result = await handler.Handle(new GetPersonByIdQuery(person.Id), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task GetPersonsByTree_search_matches_maiden_name_and_birth_year()
    {
        var (db, tree, person, _, ownerId) = await SetupAsync();
        var handler = new GetPersonsByTreeHandler(db, FakeUser(ownerId));

        var maidenSearch = await handler.Handle(new GetPersonsByTreeQuery(tree.Id, "meyer"), CancellationToken.None);
        maidenSearch.IsSuccess.Should().BeTrue();
        maidenSearch.Value.Should().ContainSingle(p => p.Id == person.Id);

        var yearSearch = await handler.Handle(new GetPersonsByTreeQuery(tree.Id, "1900"), CancellationToken.None);
        yearSearch.IsSuccess.Should().BeTrue();
        yearSearch.Value.Should().ContainSingle(p => p.Id == person.Id);
    }

    [Fact]
    public async Task DeleteRelationship_non_owner_is_forbidden()
    {
        var (db, _, _, relationship, _) = await SetupAsync();
        var handler = new DeleteRelationshipHandler(db, FakeUser(Guid.NewGuid()));

        var result = await handler.Handle(new DeleteRelationshipCommand(relationship.Id), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.StatusCode.Should().Be(403);
    }
}