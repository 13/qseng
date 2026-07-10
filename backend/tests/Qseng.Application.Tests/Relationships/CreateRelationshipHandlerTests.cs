using FluentAssertions;
using NSubstitute;
using Xunit;
using Qseng.Application.Abstractions;
using Qseng.Application.Relationships.CreateRelationship;
using Qseng.Domain.Entities;
using Qseng.Domain.Enums;

namespace Qseng.Application.Tests.Relationships;

public class CreateRelationshipHandlerTests
{
    private static readonly Guid OwnerId = Guid.NewGuid();

    private static CreateRelationshipHandler MakeHandler(IQsengDbContext db, Guid? userId = null)
    {
        var cu = Substitute.For<ICurrentUser>();
        cu.UserId.Returns(userId ?? OwnerId);
        return new(db, cu);
    }

    // Creates a tree owned by a fixed user and adds persons to it.
    private static async Task<(IQsengDbContext db, Guid treeId, Person[] persons)>
        SetupTreeAsync(int personCount = 3)
    {
        var db = TestDb.Create();
        var tree = new Tree { OwnerId = OwnerId, Name = "Test" };
        db.Trees.Add(tree);

        var persons = Enumerable.Range(0, personCount)
            .Select(_ => new Person { TreeId = tree.Id, FirstName = "A", LastName = "B" })
            .ToArray();
        db.Persons.AddRange(persons);
        await db.SaveChangesAsync();
        return (db, tree.Id, persons);
    }

    [Fact]
    public async Task Parent_relationship_with_no_existing_tree_is_created()
    {
        var (db, treeId, persons) = await SetupTreeAsync(2);
        var handler = MakeHandler(db);
        var cmd = new CreateRelationshipCommand(
            treeId, persons[0].Id, persons[1].Id, RelationshipType.Parent,
            null, null, null, null, null, null, null);

        var result = await handler.Handle(cmd, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task Direct_cycle_is_rejected()
    {
        // A is parent of B; now try to make B parent of A → cycle
        var (db, treeId, persons) = await SetupTreeAsync(2);
        var (a, b) = (persons[0], persons[1]);

        db.Relationships.Add(new Relationship
        {
            TreeId = treeId, FromPersonId = a.Id, ToPersonId = b.Id,
            Type = RelationshipType.Parent
        });
        await db.SaveChangesAsync();

        var handler = MakeHandler(db);
        var cmd = new CreateRelationshipCommand(
            treeId, b.Id, a.Id, RelationshipType.Parent,
            null, null, null, null, null, null, null);

        var result = await handler.Handle(cmd, CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task Transitive_cycle_is_rejected()
    {
        // A → B → C (parent chain); now try to make C parent of A
        var (db, treeId, persons) = await SetupTreeAsync(3);
        var (a, b, c) = (persons[0], persons[1], persons[2]);

        db.Relationships.AddRange(
            new Relationship { TreeId = treeId, FromPersonId = a.Id, ToPersonId = b.Id, Type = RelationshipType.Parent },
            new Relationship { TreeId = treeId, FromPersonId = b.Id, ToPersonId = c.Id, Type = RelationshipType.Parent }
        );
        await db.SaveChangesAsync();

        var handler = MakeHandler(db);
        var cmd = new CreateRelationshipCommand(
            treeId, c.Id, a.Id, RelationshipType.Parent,
            null, null, null, null, null, null, null);

        var result = await handler.Handle(cmd, CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task Spouse_relationship_is_not_subject_to_cycle_check()
    {
        // Two people already linked as parent/child should still be able to get a Spouse link
        // (odd genealogically, but the constraint only applies to Parent type)
        var (db, treeId, persons) = await SetupTreeAsync(2);
        var (a, b) = (persons[0], persons[1]);

        db.Relationships.Add(new Relationship
        {
            TreeId = treeId, FromPersonId = a.Id, ToPersonId = b.Id,
            Type = RelationshipType.Parent
        });
        await db.SaveChangesAsync();

        var handler = MakeHandler(db);
        var cmd = new CreateRelationshipCommand(
            treeId, b.Id, a.Id, RelationshipType.Spouse,
            null, null, null, null, null, null, null);

        var result = await handler.Handle(cmd, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task Duplicate_relationship_is_rejected()
    {
        var (db, treeId, persons) = await SetupTreeAsync(2);
        db.Relationships.Add(new Relationship
        {
            TreeId = treeId, FromPersonId = persons[0].Id, ToPersonId = persons[1].Id,
            Type = RelationshipType.Spouse
        });
        await db.SaveChangesAsync();

        var handler = MakeHandler(db);
        var cmd = new CreateRelationshipCommand(
            treeId, persons[0].Id, persons[1].Id, RelationshipType.Spouse,
            null, null, null, null, null, null, null);

        var result = await handler.Handle(cmd, CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task Non_owner_gets_403()
    {
        var (db, treeId, persons) = await SetupTreeAsync(2);
        var handler = MakeHandler(db, Guid.NewGuid());
        var cmd = new CreateRelationshipCommand(
            treeId, persons[0].Id, persons[1].Id, RelationshipType.Parent,
            null, null, null, null, null, null, null);

        var result = await handler.Handle(cmd, CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task Person_from_another_tree_is_rejected()
    {
        var (db, treeId, persons) = await SetupTreeAsync(1);
        var otherTree = new Tree { OwnerId = OwnerId, Name = "Other" };
        db.Trees.Add(otherTree);
        var outsider = new Person { TreeId = otherTree.Id, FirstName = "X", LastName = "Y" };
        db.Persons.Add(outsider);
        await db.SaveChangesAsync();

        var handler = MakeHandler(db);
        var cmd = new CreateRelationshipCommand(
            treeId, persons[0].Id, outsider.Id, RelationshipType.Parent,
            null, null, null, null, null, null, null);

        var result = await handler.Handle(cmd, CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.StatusCode.Should().Be(404);
    }
}
