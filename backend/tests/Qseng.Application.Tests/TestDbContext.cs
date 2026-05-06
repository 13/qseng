using Microsoft.EntityFrameworkCore;
using Qseng.Infrastructure.Persistence;

namespace Qseng.Application.Tests;

internal static class TestDb
{
    public static QsengDbContext Create()
    {
        var opts = new DbContextOptionsBuilder<QsengDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new QsengDbContext(opts);
    }
}
