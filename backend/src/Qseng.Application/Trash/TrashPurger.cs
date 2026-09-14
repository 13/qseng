using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Qseng.Application.Abstractions;
using Qseng.Domain.Entities;

namespace Qseng.Application.Trash;

/// <summary>Hard-deletes trashed rows older than a cutoff. Media files are removed first so a crash leaves orphans, never dangling rows.</summary>
public class TrashPurger
{
    private readonly IQsengDbContext _db;
    private readonly IFileStorage _files;
    private readonly ILogger<TrashPurger> _log;
    public TrashPurger(IQsengDbContext db, IFileStorage files, ILogger<TrashPurger> log) { _db = db; _files = files; _log = log; }

    public async Task<int> PurgeAsync(DateTime cutoffUtc, CancellationToken ct)
    {
        var media = await _db.Media.IgnoreQueryFilters().Where(m => m.DeletedAt != null && m.DeletedAt < cutoffUtc).ToListAsync(ct);
        await DeleteFilesAsync(media, ct);
        var events = await _db.TimelineEvents.IgnoreQueryFilters().Where(e => e.DeletedAt != null && e.DeletedAt < cutoffUtc).ToListAsync(ct);
        var rels = await _db.Relationships.IgnoreQueryFilters().Where(r => r.DeletedAt != null && r.DeletedAt < cutoffUtc).ToListAsync(ct);
        var persons = await _db.Persons.IgnoreQueryFilters().Where(p => p.DeletedAt != null && p.DeletedAt < cutoffUtc).ToListAsync(ct);
        _db.Media.RemoveRange(media);
        _db.TimelineEvents.RemoveRange(events);
        _db.Relationships.RemoveRange(rels);
        _db.Persons.RemoveRange(persons);
        await _db.SaveChangesAsync(ct);
        var n = media.Count + events.Count + rels.Count + persons.Count;
        _log.LogInformation("Trash purge removed {Count} rows older than {Cutoff:u}", n, cutoffUtc);
        return n;
    }

    /// <summary>Hard-deletes exactly one trashed person's rows: their media, the events either theirs or stamped
    /// with their deletion batch, the relationships that touch them, and the person row itself.</summary>
    public async Task<int> PurgeBatchAsync(Person person, CancellationToken ct)
    {
        var media = await _db.Media.IgnoreQueryFilters().Where(m => m.PersonId == person.Id).ToListAsync(ct);
        await DeleteFilesAsync(media, ct);
        var events = await _db.TimelineEvents.IgnoreQueryFilters()
            .Where(e => e.PersonId == person.Id || e.DeletionBatchId == person.DeletionBatchId).ToListAsync(ct);
        var rels = await _db.Relationships.IgnoreQueryFilters()
            .Where(r => r.FromPersonId == person.Id || r.ToPersonId == person.Id).ToListAsync(ct);
        _db.Media.RemoveRange(media);
        _db.TimelineEvents.RemoveRange(events);
        _db.Relationships.RemoveRange(rels);
        _db.Persons.Remove(person);
        await _db.SaveChangesAsync(ct);
        var n = media.Count + events.Count + rels.Count + 1;
        _log.LogInformation("Trash purge removed {Count} rows for person {PersonId}", n, person.Id);
        return n;
    }

    private async Task DeleteFilesAsync(IEnumerable<Qseng.Domain.Entities.Media> media, CancellationToken ct)
    {
        foreach (var m in media)
        {
            try { await _files.DeleteAsync(m.Url, ct); }
            catch (Exception ex) { _log.LogWarning(ex, "Could not delete media file {Url}", m.Url); }
        }
    }
}
