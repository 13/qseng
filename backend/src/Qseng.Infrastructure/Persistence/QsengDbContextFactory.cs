using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Qseng.Infrastructure.Persistence;

public class QsengDbContextFactory : IDesignTimeDbContextFactory<QsengDbContext>
{
    public QsengDbContext CreateDbContext(string[] args)
    {
        var conn = Environment.GetEnvironmentVariable("CONNECTION_STRING")
            ?? "Host=localhost;Database=qseng;Username=qseng;Password=qseng";
        var opt = new DbContextOptionsBuilder<QsengDbContext>()
            .UseNpgsql(conn, b => b.MigrationsAssembly("Qseng.Infrastructure"))
            .Options;
        return new QsengDbContext(opt);
    }
}
