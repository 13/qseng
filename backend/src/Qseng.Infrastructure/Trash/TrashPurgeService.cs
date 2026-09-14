using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Qseng.Application.Trash;

namespace Qseng.Infrastructure.Trash;

public class TrashPurgeService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(24);
    private readonly IServiceScopeFactory _scopes;
    private readonly IOptions<TrashOptions> _options;
    private readonly TimeProvider _clock;
    private readonly ILogger<TrashPurgeService> _log;
    public TrashPurgeService(IServiceScopeFactory scopes, IOptions<TrashOptions> options, TimeProvider clock, ILogger<TrashPurgeService> log)
    { _scopes = scopes; _options = options; _clock = clock; _log = log; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var purger = scope.ServiceProvider.GetRequiredService<TrashPurger>();
                var cutoff = _clock.GetUtcNow().UtcDateTime.AddDays(-_options.Value.RetentionDays);
                await purger.PurgeAsync(cutoff, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception ex) { _log.LogError(ex, "Trash purge failed"); }
            try { await Task.Delay(Interval, _clock, stoppingToken); } catch (OperationCanceledException) { return; }
        }
    }
}
