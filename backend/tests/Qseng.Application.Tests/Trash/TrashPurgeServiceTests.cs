using System.Diagnostics;
using System.Threading.Channels;
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

    private static ServiceProvider BuildProvider(IQsengDbContext serviceDb, FakeTimeProvider clock, ILogger<TrashPurger>? purgerLogger = null)
    {
        var services = new ServiceCollection();
        // serviceDb is the single context instance TrashPurger uses across every scoped run of
        // the background loop. It must not also be read from concurrently by the test's own
        // polling assertions — DbContext is not thread-safe, and a poll landing while
        // PurgeAsync's SaveChangesAsync is in flight throws. Callers give the assertions their
        // own context over the same underlying SQLite connection instead (see TestDb.CreateOn).
        // That connection itself is also not thread-safe, so callers must additionally never let
        // the assertions' reads run concurrently with the service's writes — see SignalingLogger
        // below for how ScheduledRun_PurgesARowThatAgedPastRetentionSinceStartup serializes that.
        services.AddSingleton<IQsengDbContext>(serviceDb);
        services.AddSingleton<IFileStorage>(Substitute.For<IFileStorage>());
        services.AddSingleton<ILogger<TrashPurger>>(purgerLogger ?? NullLogger<TrashPurger>.Instance);
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

    /// <summary>An <see cref="ILogger{TrashPurger}"/> that writes to <see cref="Runs"/> every time
    /// anything is logged. <see cref="TrashPurger.PurgeAsync"/> logs unconditionally — once per run,
    /// after its <c>SaveChangesAsync</c> has already completed — so reading one item from
    /// <see cref="Runs"/> is a deterministic "a run has finished" signal, unlike polling a row whose
    /// presence is already true before any run starts (which would return true on the very first
    /// poll and prove nothing). Unlike a single-shot <see cref="TaskCompletionSource"/>, an unbounded
    /// <see cref="Channel{T}"/> is re-triggerable: every scheduled run gets its own item, so callers
    /// can await a fresh completion signal before each read that follows it, not just the first.</summary>
    private sealed class SignalingLogger<T> : ILogger<T>
    {
        private readonly Channel<bool> _runs = Channel.CreateUnbounded<bool>();
        public ChannelReader<bool> Runs => _runs.Reader;
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
            => _runs.Writer.TryWrite(true);
    }

    [Fact]
    public async Task StartAsync_PurgesOnFirstRun_RemovingOnlyRowsPastRetention()
    {
        var (db, connection) = TestDb.CreateWithConnection();
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
        // A separate context over the same SQLite connection: the service's own context (db,
        // above) is used exclusively by TrashPurger's background runs, so reads here never race
        // a SaveChangesAsync in flight on the same instance.
        await using var reads = TestDb.CreateOn(connection);

        await service.StartAsync(CancellationToken.None);
        try
        {
            var purged = await PollUntilAsync(
                async () => !await reads.Persons.IgnoreQueryFilters().AnyAsync(p => p.Id == old.Id),
                TimeSpan.FromSeconds(2));

            purged.Should().BeTrue("the service purges once, immediately, when it starts");
            (await reads.Persons.IgnoreQueryFilters().AnyAsync(p => p.Id == recent.Id)).Should().BeTrue();
        }
        finally
        {
            await service.StopAsync(CancellationToken.None);
        }
    }

    [Fact]
    public async Task ScheduledRun_PurgesARowThatAgedPastRetentionSinceStartup()
    {
        var (db, connection) = TestDb.CreateWithConnection();
        var owner = TestDb.AddOwner(db).Id;
        var tree = new Tree { OwnerId = owner, Name = "T" };
        db.Trees.Add(tree);
        // 1 day old at startup: survives the immediate first run, then ages past the 30-day
        // retention as the fake clock advances, so it must be gone by the next scheduled run.
        var recent = new Person { TreeId = tree.Id, FirstName = "Recent", LastName = "P", DeletedAt = Start.UtcDateTime.AddDays(-1), DeletionBatchId = Guid.NewGuid() };
        db.Persons.Add(recent);
        await db.SaveChangesAsync();

        var clock = new FakeTimeProvider(Start);
        var purgerLog = new SignalingLogger<TrashPurger>();
        await using var provider = BuildProvider(db, clock, purgerLog);
        var service = provider.GetRequiredService<TrashPurgeService>();
        // A separate context over the same SQLite connection: the service's own context (db,
        // above) is used exclusively by TrashPurger's background runs, so reads here never race
        // a SaveChangesAsync in flight on the same instance.
        await using var reads = TestDb.CreateOn(connection);

        await service.StartAsync(CancellationToken.None);
        try
        {
            // Wait for the deterministic signal that the first run's PurgeAsync has completed —
            // it logs unconditionally, after its SaveChangesAsync, once per run — instead of
            // polling AnyAsync for the row directly: the row is already present before the run
            // starts, so that poll would return true on its very first iteration and prove
            // nothing about the run having actually happened. The signal only fires after the
            // service's write is done, so the read below never races it on the shared connection.
            var firstRunLogged = false;
            using (var firstRunTimeout = new CancellationTokenSource(TimeSpan.FromSeconds(2)))
            {
                try
                {
                    await purgerLog.Runs.ReadAsync(firstRunTimeout.Token);
                    firstRunLogged = true;
                }
                catch (OperationCanceledException) when (firstRunTimeout.IsCancellationRequested) { }
            }
            firstRunLogged.Should().BeTrue("the first run must complete and log within the timeout");
            var survivedFirstRun = await reads.Persons.IgnoreQueryFilters().AnyAsync(p => p.Id == recent.Id);
            survivedFirstRun.Should().BeTrue("the row is only 1 day old and not yet past the 30-day retention");

            // Drive the fake clock forward by Interval-sized steps until the row is purged. Each
            // step both ages the row (well past the 30-day retention after enough steps) and,
            // once the loop's Task.Delay(Interval, clock, ...) has actually been registered,
            // satisfies it so the next scheduled run fires. Rather than a fixed real-time delay,
            // each step awaits that run's own completion signal on the re-triggerable
            // SignalingLogger — re-registration races are absorbed because a step that lands
            // before the delay is (re-)registered simply produces no run, and the next step's
            // Advance keeps pushing the clock forward until one does — so the read that follows
            // never races a SaveChangesAsync still in flight on the shared connection, for this
            // run or any later one. A single 2-second overall timeout bounds the whole loop.
            var purged = false;
            using (var loopTimeout = new CancellationTokenSource(TimeSpan.FromSeconds(2)))
            {
                try
                {
                    while (!purged)
                    {
                        clock.Advance(TrashPurgeService.Interval);
                        await purgerLog.Runs.ReadAsync(loopTimeout.Token);
                        purged = !await reads.Persons.IgnoreQueryFilters().AnyAsync(p => p.Id == recent.Id);
                    }
                }
                catch (OperationCanceledException) when (loopTimeout.IsCancellationRequested) { }
            }

            purged.Should().BeTrue("a scheduled run after the row aged past retention must purge it");
        }
        finally
        {
            await service.StopAsync(CancellationToken.None);
        }
    }
}
