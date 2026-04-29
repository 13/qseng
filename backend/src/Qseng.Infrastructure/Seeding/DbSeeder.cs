using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Qseng.Application.Abstractions;
using Qseng.Domain.Entities;
using Qseng.Infrastructure.Persistence;

namespace Qseng.Infrastructure.Seeding;

public class DbSeeder
{
    private readonly QsengDbContext _db;
    private readonly IPasswordHasher _hasher;
    private readonly ILogger<DbSeeder> _log;

    public DbSeeder(QsengDbContext db, IPasswordHasher hasher, ILogger<DbSeeder> log)
    { _db = db; _hasher = hasher; _log = log; }

    public async Task SeedAsync(CancellationToken ct = default)
    {
        // EnsureCreated for SQLite dev; for postgres prod, run migrations separately
        await _db.Database.EnsureCreatedAsync(ct);

        const string demoEmail = "demo@qseng.app";
        var demo = await _db.Users.FirstOrDefaultAsync(u => u.Email == demoEmail, ct);
        if (demo is null)
        {
            demo = new User
            {
                Email = demoEmail,
                PasswordHash = _hasher.Hash("Demo123!"),
                DisplayName = "Demo User"
            };
            _db.Users.Add(demo);
            await _db.SaveChangesAsync(ct);
            _log.LogInformation("Created demo user");
        }

        var hasTree = await _db.Trees.AnyAsync(t => t.OwnerId == demo.Id && t.Name == "Familie Egger-Sulzer-Spath", ct);
        if (hasTree) { _log.LogInformation("Demo data already present"); return; }

        var tree = new Tree
        {
            OwnerId = demo.Id,
            Name = "Familie Egger-Sulzer-Spath",
            Description = "Drei verwandte Familien aus dem Alpenraum."
        };
        _db.Trees.Add(tree);

        DemoData.Build(tree.Id, _db);
        await _db.SaveChangesAsync(ct);
        _log.LogInformation("Seeded demo data");
    }
}
