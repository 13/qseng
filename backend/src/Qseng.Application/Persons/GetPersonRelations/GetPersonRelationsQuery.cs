using MediatR;
using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;
using Qseng.Domain.Enums;

namespace Qseng.Application.Persons.GetPersonRelations;

public record PersonRelationDto(
    Guid RelationshipId,
    RelationshipType Type,
    string Direction,
    Guid RelatedPersonId,
    string RelatedFirstName,
    string RelatedLastName,
    string? RelatedMaidenName,
    int? StartYear, int? StartMonth, int? StartDay,
    int? EndYear, int? EndMonth, int? EndDay,
    string? Notes);

public record GetPersonRelationsQuery(Guid PersonId) : IRequest<Result<IReadOnlyList<PersonRelationDto>>>;

public class GetPersonRelationsHandler : IRequestHandler<GetPersonRelationsQuery, Result<IReadOnlyList<PersonRelationDto>>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _currentUser;

    public GetPersonRelationsHandler(IQsengDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<Result<IReadOnlyList<PersonRelationDto>>> Handle(GetPersonRelationsQuery q, CancellationToken ct)
    {
        var person = await _db.Persons.FirstOrDefaultAsync(p => p.Id == q.PersonId, ct);
        if (person is null) return Result<IReadOnlyList<PersonRelationDto>>.NotFound("Person not found.");

        var tree = await _db.Trees.FindAsync([person.TreeId], ct);
        if (tree is null) return Result<IReadOnlyList<PersonRelationDto>>.NotFound("Person not found.");
        if (tree.OwnerId != _currentUser.UserId) return Result<IReadOnlyList<PersonRelationDto>>.Fail("Forbidden.", 403);

        var asFrom = await _db.Relationships
            .Where(r => r.FromPersonId == q.PersonId)
            .Join(_db.Persons, r => r.ToPersonId, p => p.Id, (r, p) => new PersonRelationDto(
                r.Id, r.Type, "from",
                p.Id, p.FirstName, p.LastName, p.MaidenName,
                r.StartYear, r.StartMonth, r.StartDay,
                r.EndYear, r.EndMonth, r.EndDay, r.Notes))
            .ToListAsync(ct);

        var asTo = await _db.Relationships
            .Where(r => r.ToPersonId == q.PersonId)
            .Join(_db.Persons, r => r.FromPersonId, p => p.Id, (r, p) => new PersonRelationDto(
                r.Id, r.Type, "to",
                p.Id, p.FirstName, p.LastName, p.MaidenName,
                r.StartYear, r.StartMonth, r.StartDay,
                r.EndYear, r.EndMonth, r.EndDay, r.Notes))
            .ToListAsync(ct);

        return Result<IReadOnlyList<PersonRelationDto>>.Ok(asFrom.Concat(asTo).ToList());
    }
}
