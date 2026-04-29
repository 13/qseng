using MediatR;
using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;
using Qseng.Domain.Entities;
using Qseng.Domain.Enums;

namespace Qseng.Application.Import;

public record ImportTextCommand(Guid TreeId, string Text, bool DryRun = true) : IRequest<Result<ImportReport>>;

public record ImportReport(
    int PersonsCreated, int RelationshipsCreated,
    IReadOnlyList<string> Warnings, bool IsDryRun);

public class ImportTextHandler : IRequestHandler<ImportTextCommand, Result<ImportReport>>
{
    private readonly IQsengDbContext _db;
    private readonly IGenealogyParser _parser;
    private readonly ICurrentUser _currentUser;

    public ImportTextHandler(IQsengDbContext db, IGenealogyParser parser, ICurrentUser currentUser)
    { _db = db; _parser = parser; _currentUser = currentUser; }

    public async Task<Result<ImportReport>> Handle(ImportTextCommand cmd, CancellationToken ct)
    {
        var tree = await _db.Trees.FindAsync([cmd.TreeId], ct);
        if (tree is null) return Result<ImportReport>.NotFound("Tree not found.");
        if (tree.OwnerId != _currentUser.UserId) return Result<ImportReport>.Fail("Forbidden.", 403);

        var parsed = _parser.Parse(cmd.Text);
        var warnings = new List<string>(parsed.Warnings);
        var personsCreated = 0;
        var relsCreated = 0;

        var existingPersons = await _db.Persons
            .Where(p => p.TreeId == cmd.TreeId)
            .ToListAsync(ct);

        var personMap = new Dictionary<string, Person>();

        foreach (var pp in parsed.Persons)
        {
            var key = $"{pp.FirstName} {pp.LastName}".ToLowerInvariant();
            var existing = existingPersons.FirstOrDefault(e =>
                e.FirstName.Equals(pp.FirstName, StringComparison.OrdinalIgnoreCase) &&
                e.LastName.Equals(pp.LastName, StringComparison.OrdinalIgnoreCase) &&
                (pp.Birth is null || e.Birth?.Year == pp.Birth.Year));

            if (existing is not null)
            {
                personMap[key] = existing;
                warnings.Add($"Skipped (already exists): {pp.FirstName} {pp.LastName}");
                continue;
            }

            var person = new Person
            {
                TreeId = cmd.TreeId,
                FirstName = pp.FirstName, LastName = pp.LastName,
                MaidenName = pp.MaidenName,
                Birth = pp.Birth, Death = pp.Death,
                BirthPlace = pp.BirthPlace, DeathPlace = pp.DeathPlace
            };
            personMap[key] = person;
            personsCreated++;

            if (!cmd.DryRun) _db.Persons.Add(person);
        }

        foreach (var pm in parsed.Marriages)
        {
            var aKey = pm.SpouseAName.ToLowerInvariant();
            var bKey = pm.SpouseBName.ToLowerInvariant();
            if (!personMap.TryGetValue(aKey, out var a) || !personMap.TryGetValue(bKey, out var b))
            {
                warnings.Add($"Could not link marriage: {pm.SpouseAName} oo {pm.SpouseBName}");
                continue;
            }
            relsCreated++;
            if (!cmd.DryRun)
            {
                _db.Relationships.Add(new Relationship
                {
                    TreeId = cmd.TreeId,
                    FromPersonId = a.Id, ToPersonId = b.Id,
                    Type = RelationshipType.Spouse,
                    StartYear = pm.Date?.Year, StartMonth = pm.Date?.Month, StartDay = pm.Date?.Day
                });
            }
        }

        if (!cmd.DryRun) await _db.SaveChangesAsync(ct);

        return Result<ImportReport>.Ok(new ImportReport(personsCreated, relsCreated, warnings, cmd.DryRun));
    }
}
