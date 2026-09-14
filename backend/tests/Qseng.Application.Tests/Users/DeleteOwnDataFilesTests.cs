using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Qseng.Application.Abstractions;
using Qseng.Application.Tests.Trash;
using Qseng.Application.Users;
using Qseng.Domain.Enums;
using Xunit;
using MediaEntity = Qseng.Domain.Entities.Media;

namespace Qseng.Application.Tests.Users;

public class DeleteOwnDataFilesTests
{
    [Fact]
    public async Task DeleteOwnData_deletes_the_live_and_trashed_media_files()
    {
        var (db, owner, a, _, _, _, _) = await TrashFixtures.SeedFamilyAsync(); // media is /u/a.jpg, live
        var old = new MediaEntity
        {
            PersonId = a.Id, Url = "/u/old.jpg", Kind = MediaKind.Photo,
            DeletedAt = DateTime.UtcNow, DeletionBatchId = Guid.NewGuid()
        };
        db.Media.Add(old);
        await db.SaveChangesAsync();

        var user = TrashFixtures.FakeUser(owner);
        var hasher = Substitute.For<IPasswordHasher>();
        hasher.Verify(Arg.Any<string>(), Arg.Any<string>()).Returns(true);
        var storage = Substitute.For<IFileStorage>();

        var result = await new DeleteOwnDataHandler(db, user, hasher, storage, NullLogger<DeleteOwnDataHandler>.Instance)
            .Handle(new DeleteOwnDataCommand("pw"), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        await storage.Received(1).DeleteAsync("/u/a.jpg", Arg.Any<CancellationToken>());
        await storage.Received(1).DeleteAsync("/u/old.jpg", Arg.Any<CancellationToken>());
        (await db.Trees.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task DeleteOwnAccount_deletes_the_live_and_trashed_media_files()
    {
        var (db, owner, a, _, _, _, _) = await TrashFixtures.SeedFamilyAsync(); // media is /u/a.jpg, live
        var old = new MediaEntity
        {
            PersonId = a.Id, Url = "/u/old.jpg", Kind = MediaKind.Photo,
            DeletedAt = DateTime.UtcNow, DeletionBatchId = Guid.NewGuid()
        };
        db.Media.Add(old);
        await db.SaveChangesAsync();

        var user = TrashFixtures.FakeUser(owner);
        var hasher = Substitute.For<IPasswordHasher>();
        hasher.Verify(Arg.Any<string>(), Arg.Any<string>()).Returns(true);
        var storage = Substitute.For<IFileStorage>();

        var result = await new DeleteOwnAccountHandler(db, user, hasher, storage, NullLogger<DeleteOwnAccountHandler>.Instance)
            .Handle(new DeleteOwnAccountCommand("pw"), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        await storage.Received(1).DeleteAsync("/u/a.jpg", Arg.Any<CancellationToken>());
        await storage.Received(1).DeleteAsync("/u/old.jpg", Arg.Any<CancellationToken>());
        (await db.Trees.CountAsync()).Should().Be(0);
    }
}
