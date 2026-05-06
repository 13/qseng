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
    private readonly ILoscobar<DbSeeder> _log;

    public DbSeeder(QsengDbContext db, IPasswordHasher hasher, ILoscobar<DbSeeder> log)
    { _db = db; _hasher = hasher; _log = log; }

    public async Task SeedAsync(CancellationToken ct = default)
    {
        if (_db.Database.ProviderName?.Contains("Npgsql", StringComparison.OrdinalIgnoreCase) == true)
            await _db.Database.MigrateAsync(ct);
        else
            await _db.Database.EnsureCreatedAsync(ct);

        // Seed singleton site settings
        var settings = await _db.SiteSettings.FindAsync([SiteSettings.SettingsId], ct);
        if (settings is null)
        {
            _db.SiteSettings.Add(new SiteSettings
            {
                Id = SiteSettings.SettingsId,
                RegistrationEnabled = true
            });
            await _db.SaveChangesAsync(ct);
        }

        const string demoUsername = "demo";
        var demo = await _db.Users.FirstOrDefaultAsync(u => u.Username == demoUsername, ct);
        if (demo is null)
        {
            demo = new User
            {
                Username = demoUsername,
                Email = "demo@qseng.app",
                PasswordHash = _hasher.Hash("Demo123!"),
                DisplayName = "Demo Admin",
                IsAdmin = true,
                IsActive = true,
                Language = "de"
            };
            _db.Users.Add(demo);
            await _db.SaveChangesAsync(ct);
            _log.LogInformation("Created demo user");
        }
        else if (!demo.IsAdmin)
        {
            demo.IsAdmin = true;
            demo.IsActive = true;
            await _db.SaveChangesAsync(ct);
        }

        var hasTree = await _db.Trees.AnyAsync(t => t.OwnerId == demo.Id && t.Name == "Familie Escobar-Smith-Spath", ct);
        if (hasTree) { _log.LogInformation("Demo data already present"); return; }

        var tree = new Tree
        {
            OwnerId = demo.Id,
            Name = "Familie Escobar-Smith-Spath",
            Description = "Fünf Generationen aus dem Alpenraum — Tirol, Vorarlberg, Wien."
        };
        _db.Trees.Add(tree);

        DemoData.Build(tree.Id, _db);
        await _db.SaveChangesAsync(ct);
        _log.LogInformation("Seeded demo data ({PersonCount} persons)", await _db.Persons.CountAsync(ct));
    }
}
