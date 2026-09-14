using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Xunit;
using Qseng.Application.Abstractions;
using Qseng.Application.Media.DeleteMedia;
using Qseng.Application.Media.RestoreMedia;
using Qseng.Application.Media.SetAvatar;
using Qseng.Domain.Entities;
using Qseng.Domain.Enums;
using MediaEntity = Qseng.Domain.Entities.Media;

namespace Qseng.Application.Tests.Media;

public class AvatarTests
{
    private static ICurrentUser FakeUser(Guid userId)
    {
        var u = Substitute.For<ICurrentUser>();
        u.UserId.Returns(userId);
        return u;
    }

    private static IFileStorage NoopStorage()
    {
        var fs = Substitute.For<IFileStorage>();
        fs.DeleteAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);
        return fs;
    }

    private static async Task<(IQsengDbContext db, Person person, Guid ownerId, MediaEntity[] photos)>
        SetupAsync(int photoCount = 2)
    {
        var db = TestDb.Create();
        var ownerId = TestDb.AddOwner(db).Id;
        var tree = new Tree { OwnerId = ownerId, Name = "T" };
        db.Trees.Add(tree);
        var person = new Person { TreeId = tree.Id, FirstName = "A", LastName = "B" };
        db.Persons.Add(person);

        var photos = Enumerable.Range(0, photoCount)
            .Select(i => new MediaEntity
            {
                PersonId = person.Id,
                Url = $"/uploads/{i}.jpg",
                Kind = MediaKind.Photo,
                CreatedAt = DateTime.UtcNow.AddMinutes(i),
                IsAvatar = i == 0
            })
            .ToArray();
        db.Media.AddRange(photos);
        await db.SaveChangesAsync();
        return (db, person, ownerId, photos);
    }

    [Fact]
    public async Task Set_avatar_moves_the_flag_and_leaves_exactly_one()
    {
        var (db, person, ownerId, photos) = await SetupAsync();
        var handler = new SetAvatarHandler(db, FakeUser(ownerId));

        var result = await handler.Handle(new SetAvatarCommand(person.Id, photos[1].Id), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        var avatars = await db.Media.Where(m => m.PersonId == person.Id && m.IsAvatar).ToListAsync();
        avatars.Should().ContainSingle().Which.Id.Should().Be(photos[1].Id);
    }

    [Fact]
    public async Task Set_avatar_is_forbidden_for_a_non_owner()
    {
        var (db, person, _, photos) = await SetupAsync();
        var handler = new SetAvatarHandler(db, FakeUser(Guid.NewGuid()));

        var result = await handler.Handle(new SetAvatarCommand(person.Id, photos[1].Id), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task A_document_cannot_be_used_as_an_avatar()
    {
        var (db, person, ownerId, _) = await SetupAsync();
        var doc = new MediaEntity { PersonId = person.Id, Url = "/uploads/scan.pdf", Kind = MediaKind.Document };
        db.Media.Add(doc);
        await db.SaveChangesAsync();

        var result = await new SetAvatarHandler(db, FakeUser(ownerId))
            .Handle(new SetAvatarCommand(person.Id, doc.Id), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Media_from_another_person_is_not_found()
    {
        var (db, person, ownerId, _) = await SetupAsync();
        var other = new Person { TreeId = person.TreeId, FirstName = "C", LastName = "D" };
        db.Persons.Add(other);
        var otherPhoto = new MediaEntity { PersonId = other.Id, Url = "/uploads/x.jpg", Kind = MediaKind.Photo };
        db.Media.Add(otherPhoto);
        await db.SaveChangesAsync();

        var result = await new SetAvatarHandler(db, FakeUser(ownerId))
            .Handle(new SetAvatarCommand(person.Id, otherPhoto.Id), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task Deleting_the_avatar_promotes_the_next_photo()
    {
        var (db, person, ownerId, photos) = await SetupAsync();
        var handler = new DeleteMediaHandler(db, FakeUser(ownerId), NoopStorage());

        var result = await handler.Handle(new DeleteMediaCommand(person.Id, photos[0].Id), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        var remaining = await db.Media.Where(m => m.PersonId == person.Id).ToListAsync();
        remaining.Should().ContainSingle().Which.IsAvatar.Should().BeTrue();
    }

    [Fact]
    public async Task Deleting_a_non_avatar_photo_leaves_the_avatar_alone()
    {
        var (db, person, ownerId, photos) = await SetupAsync();
        var handler = new DeleteMediaHandler(db, FakeUser(ownerId), NoopStorage());

        await handler.Handle(new DeleteMediaCommand(person.Id, photos[1].Id), CancellationToken.None);

        var remaining = await db.Media.Where(m => m.PersonId == person.Id).ToListAsync();
        remaining.Should().ContainSingle().Which.Id.Should().Be(photos[0].Id);
        remaining[0].IsAvatar.Should().BeTrue();
    }

    [Fact]
    public async Task Deleting_the_only_photo_leaves_no_avatar()
    {
        var (db, person, ownerId, photos) = await SetupAsync(photoCount: 1);
        var handler = new DeleteMediaHandler(db, FakeUser(ownerId), NoopStorage());

        var result = await handler.Handle(new DeleteMediaCommand(person.Id, photos[0].Id), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        (await db.Media.CountAsync(m => m.PersonId == person.Id)).Should().Be(0);
    }

    [Fact]
    public async Task SetAvatar_after_delete_and_restore_of_the_original_avatar_leaves_exactly_one_live_avatar()
    {
        var (db, person, ownerId, photos) = await SetupAsync();
        var user = FakeUser(ownerId);

        // Deleting the avatar promotes photos[1]; restoring photos[0] afterwards
        // must not resurrect its avatar flag (it would collide with photos[1]'s).
        await new DeleteMediaHandler(db, user, NoopStorage())
            .Handle(new DeleteMediaCommand(person.Id, photos[0].Id), CancellationToken.None);
        var restore = await new RestoreMediaHandler(db, user)
            .Handle(new RestoreMediaCommand(person.Id, photos[0].Id), CancellationToken.None);
        restore.IsSuccess.Should().BeTrue();

        var result = await new SetAvatarHandler(db, user)
            .Handle(new SetAvatarCommand(person.Id, photos[0].Id), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        var live = await db.Media.Where(m => m.PersonId == person.Id && m.IsAvatar).ToListAsync();
        live.Should().ContainSingle().Which.Id.Should().Be(photos[0].Id);
    }
}
