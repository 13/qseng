using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Domain.Enums;

namespace Qseng.Application.Relationships;

/// <summary>
/// Invariants shared by every path that can bring a Parent-type relationship
/// into existence (create, restore) so they cannot drift apart.
/// </summary>
internal static class RelationshipRules
{
    // BFS from childId downward through descendants; returns true if parentId appears (= cycle).
    public static async Task<bool> WouldCreateCycleAsync(
        IQsengDbContext db, Guid treeId, Guid parentId, Guid childId, CancellationToken ct)
    {
        var edges = await db.Relationships
            .Where(r => r.TreeId == treeId && r.Type == RelationshipType.Parent)
            .Select(r => new { r.FromPersonId, r.ToPersonId })
            .ToListAsync(ct);

        var visited = new HashSet<Guid>();
        var queue = new Queue<Guid>();
        queue.Enqueue(childId);

        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            if (!visited.Add(current)) continue;
            foreach (var e in edges.Where(r => r.FromPersonId == current))
            {
                if (e.ToPersonId == parentId) return true;
                queue.Enqueue(e.ToPersonId);
            }
        }
        return false;
    }
}
