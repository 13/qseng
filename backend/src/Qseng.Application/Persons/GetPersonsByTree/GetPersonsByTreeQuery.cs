using MediatR;
using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;
using Qseng.Application.Persons.CreatePerson;
using Qseng.Domain.Enums;

namespace Qseng.Application.Persons.GetPersonsByTree;

public record GetPersonsByTreeQuery(Guid TreeId, string? Search = null) : IRequest<Result<IReadOnlyList<PersonDto>>>;

public class GetPersonsByTreeHandler : IRequestHandler<GetPersonsByTreeQuery, Result<IReadOnlyList<PersonDto>>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _currentUser;

    public GetPersonsByTreeHandler(IQsengDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<Result<IReadOnlyList<PersonDto>>> Handle(GetPersonsByTreeQuery q, CancellationToken ct)
    {
        var tree = await _db.Trees.FindAsync([q.TreeId], ct);
        if (tree is null) return Result<IReadOnlyList<PersonDto>>.NotFound("Tree not found.");
        if (tree.OwnerId != _currentUser.UserId) return Result<IReadOnlyList<PersonDto>>.Fail("Forbidden.", 403);

        var query = _db.Persons.Where(p => p.TreeId == q.TreeId);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.ToLowerInvariant();
            var year = int.TryParse(s, out var parsedYear) ? parsedYear : (int?)null;
            query = query.Where(p =>
                p.FirstName.ToLower().Contains(s) ||
                p.LastName.ToLower().Contains(s) ||
                (p.MaidenName != null && p.MaidenName.ToLower().Contains(s)) ||
                (p.BirthPlace != null && p.BirthPlace.ToLower().Contains(s)) ||
                (p.DeathPlace != null && p.DeathPlace.ToLower().Contains(s)) ||
                (year != null && p.Birth != null && p.Birth.Year == year) ||
                (year != null && p.Death != null && p.Death.Year == year));
        }
        var persons = await query
            .OrderBy(p => p.LastName).ThenBy(p => p.FirstName)
            .ToListAsync(ct);

        var personIds = persons.Select(p => p.Id).ToList();
        var rawAvatars = await _db.Media
            .Where(m => personIds.Contains(m.PersonId) && m.Kind == MediaKind.Photo)
            .Select(m => new { m.PersonId, m.Url, m.CreatedAt })
            .ToListAsync(ct);
        var avatars = rawAvatars
            .GroupBy(m => m.PersonId)
            .ToDictionary(g => g.Key, g => g.OrderBy(m => m.CreatedAt).First().Url);

        return Result<IReadOnlyList<PersonDto>>.Ok(
            persons.Select(p => CreatePersonHandler.ToDto(p, avatars.GetValueOrDefault(p.Id))).ToList());
    }
}
