using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Qseng.Domain.Entities;
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
}
