using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Qseng.Infrastructure.Persistence;

/// <summary>
/// Design-time factories for `dotnet ef`. Each provider owns a migration chain,
/// selected with `--context`:
///
///   dotnet ef migrations add Name --context SqliteQsengDbContext   -o Persistence/Migrations/Sqlite
///   dotnet ef migrations add Name --context PostgresQsengDbContext -o Persistence/Migrations/Postgres
/// </summary>
public class SqliteQsengDbContextFactory : IDesignTimeDbContextFactory<SqliteQsengDbContext>
{
    public SqliteQsengDbContext CreateDbContext(string[] args)
    {
        var conn = Environment.GetEnvironmentVariable("CONNECTION_STRING") ?? "Data Source=qseng.db";
        var opt = new DbContextOptionsBuilder<SqliteQsengDbContext>().UseSqlite(conn).Options;
        return new SqliteQsengDbContext(opt);
    }
}

public class PostgresQsengDbContextFactory : IDesignTimeDbContextFactory<PostgresQsengDbContext>
{
    public PostgresQsengDbContext CreateDbContext(string[] args)
    {
        var conn = Environment.GetEnvironmentVariable("CONNECTION_STRING")
            ?? "Host=localhost;Database=qseng;Username=qseng;Password=qseng";
        var opt = new DbContextOptionsBuilder<PostgresQsengDbContext>().UseNpgsql(conn).Options;
        return new PostgresQsengDbContext(opt);
    }
}
