using Microsoft.EntityFrameworkCore;
using Qseng.Infrastructure.Persistence;

namespace Qseng.Application.Tests;

internal static class TestDb
{
    /// <summary>
    /// The SQLite context stands in for the abstract base; the in-memory provider
    /// ignores the provider-specific index filters either way.
    /// </summary>
    public static QsengDbContext Create()
    {
        var opts = new DbContextOptionsBuilder<SqliteQsengDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new SqliteQsengDbContext(opts);
    }
}
