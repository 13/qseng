using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Domain.Entities;
using Qseng.Infrastructure.Persistence;

namespace Qseng.Application.Tests;

internal static class TestDb
{
    /// <summary>
    /// A real SQLite database, not the in-memory provider: filtered unique
    /// indexes, FK cascades and SQLite's 0/1 boolean storage all behave the way
    /// they do against the shipped SqliteQsengDbContext, instead of the
    /// InMemory provider's more permissive approximation of them.
    ///
    /// SQLite's own ":memory:" database exists only while its connection is
    /// open, so the connection is opened here and handed to UseSqlite rather
    /// than given as a connection string — EF then reuses this one connection
    /// for the context's lifetime instead of opening (and immediately losing)
    /// a fresh empty database per command. The context holds the connection via
    /// its internal services for as long as it — and therefore the caller's
    /// reference to it — stays reachable, which is the test's lifetime; nothing
    /// in this test project disposes the returned context, so nothing closes
    /// the connection early.
    /// </summary>
    public static QsengDbContext Create()
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();

        var opts = new DbContextOptionsBuilder<SqliteQsengDbContext>()
            .UseSqlite(connection)
            .Options;
        var db = new SqliteQsengDbContext(opts);
        db.Database.EnsureCreated();
        return db;
    }

    /// <summary>
    /// A minimal, valid user row, added to <paramref name="db"/> (not yet saved).
    /// Real SQLite enforces Tree.OwnerId's foreign key (the InMemory provider
    /// used to just ignore it), so a fixture that only cares about the ownership
    /// comparison in a handler still needs a real user for the tree to point at.
    /// </summary>
    public static User AddOwner(IQsengDbContext db, Guid? id = null)
    {
        var user = new User
        {
            Id = id ?? Guid.NewGuid(),
            Username = $"owner-{Guid.NewGuid():N}",
            PasswordHash = "x",
            DisplayName = "Owner"
        };
        db.Users.Add(user);
        return user;
    }
}
