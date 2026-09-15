using System.Diagnostics;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;
using Qseng.Application.Abstractions;
using Qseng.Application.Trash;
using Qseng.Domain.Entities;
using Qseng.Infrastructure.Trash;
using Xunit;

namespace Qseng.Application.Tests.Trash;

public class TrashPurgeServiceTests
{
    private static readonly DateTimeOffset Start = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);

    private static ServiceProvider BuildProvider(IQsengDbContext db, FakeTimeProvider clock)
    {
        var services = new ServiceCollection();
        // The db context is a single real SQLite ":memory:" connection (see TestDb.Create), so
        // every scope must resolve the same instance rather than getting its own context.
        services.AddSingleton<IQsengDbContext>(db);
        services.AddSingleton<IFileStorage>(Substitute.For<IFileStorage>());
        services.AddSingleton<ILogger<TrashPurger>>(NullLogger<TrashPurger>.Instance);
        services.AddScoped<TrashPurger>();
        services.AddSingleton(Options.Create(new TrashOptions { RetentionDays = 30 }));
        services.AddSingleton<TimeProvider>(clock);
        services.AddSingleton<ILogger<TrashPurgeService>>(NullLogger<TrashPurgeService>.Instance);
        services.AddSingleton<TrashPurgeService>();
        return services.BuildServiceProvider();
    }

    /// <summary>Polls <paramref name="condition"/> on a short real-time cadence, rather than
    /// sleeping for a fixed guess, until it is true or <paramref name="timeout"/> elapses.</summary>
    private static async Task<bool> PollUntilAsync(Func<Task<bool>> condition, TimeSpan timeout)
    {
        var sw = Stopwatch.StartNew();
        while (true)
        {
            if (await condition()) return true;
            if (sw.Elapsed >= timeout) return false;
            await Task.Delay(20);
        }
    }

    [Fact]
    public async Task StartAsync_PurgesOnFirstRun_RemovingOnlyRowsPastRetention()
    {
        var db = TestDb.Create();
        var owner = TestDb.AddOwner(db).Id;
        var tree = new Tree { OwnerId = owner, Name = "T" };
        db.Trees.Add(tree);
        var old = new Person { TreeId = tree.Id, FirstName = "Old", LastName = "P", DeletedAt = Start.UtcDateTime.AddDays(-31), DeletionBatchId = Guid.NewGuid() };
        var recent = new Person { TreeId = tree.Id, FirstName = "Recent", LastName = "P", DeletedAt = Start.UtcDateTime.AddDays(-1), DeletionBatchId = Guid.NewGuid() };
        db.Persons.AddRange(old, recent);
        await db.SaveChangesAsync();

        var clock = new FakeTimeProvider(Start);
        await using var provider = BuildProvider(db, clock);
        var service = provider.GetRequiredService<TrashPurgeService>();

        await service.StartAsync(CancellationToken.None);
        try
        {
            var purged = await PollUntilAsync(
                async () => !await db.Persons.IgnoreQueryFilters().AnyAsync(p => p.Id == old.Id),
                TimeSpan.FromSeconds(2));

            purged.Should().BeTrue("the service purges once, immediately, when it starts");
            (await db.Persons.IgnoreQueryFilters().AnyAsync(p => p.Id == recent.Id)).Should().BeTrue();
        }
        finally
        {
            await service.StopAsync(CancellationToken.None);
        }
    }

    [Fact]
    public async Task ScheduledRun_PurgesARowThatAgedPastRetentionSinceStartup()
    {
        var db = TestDb.Create();
        var owner = TestDb.AddOwner(db).Id;
        var tree = new Tree { OwnerId = owner, Name = "T" };
        db.Trees.Add(tree);
        // 1 day old at startup: survives the immediate first run, then ages past the 30-day
        // retention as the fake clock advances, so it must be gone by the next scheduled run.
        var recent = new Person { TreeId = tree.Id, FirstName = "Recent", LastName = "P", DeletedAt = Start.UtcDateTime.AddDays(-1), DeletionBatchId = Guid.NewGuid() };
        db.Persons.Add(recent);
        await db.SaveChangesAsync();

        var clock = new FakeTimeProvider(Start);
        await using var provider = BuildProvider(db, clock);
        var service = provider.GetRequiredService<TrashPurgeService>();

        await service.StartAsync(CancellationToken.None);
        try
        {
            // Let the immediate first run finish; the row is not old enough yet, so it must survive it.
            var survivedFirstRun = await PollUntilAsync(
                async () => await db.Persons.IgnoreQueryFilters().AnyAsync(p => p.Id == recent.Id),
                TimeSpan.FromSeconds(2));
            survivedFirstRun.Should().BeTrue();

            // Drive the fake clock forward by Interval-sized steps: each step both ages the row
            // (well past the 30-day retention within a couple of steps) and, once the loop's
            // Task.Delay(Interval, clock, ...) has actually been registered, satisfies it so the
            // next scheduled run fires. A short real-time gap between steps gives the background
            // loop's continuation a chance to run and (re-)register that delay before the next
            // Advance — looping this way, instead of a single Advance call, avoids a race against
            // exactly when the delay gets registered.
            var purged = await PollUntilAsync(async () =>
            {
                clock.Advance(TrashPurgeService.Interval);
                await Task.Delay(20);
                return !await db.Persons.IgnoreQueryFilters().AnyAsync(p => p.Id == recent.Id);
            }, TimeSpan.FromSeconds(2));

            purged.Should().BeTrue("a scheduled run after the row aged past retention must purge it");
        }
        finally
        {
            await service.StopAsync(CancellationToken.None);
        }
    }
}
