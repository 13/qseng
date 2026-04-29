using MediatR;
using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;
using Qseng.Application.Persons.CreatePerson;

namespace Qseng.Application.Persons.GetPersonsByTree;

public record GetPersonsByTreeQuery(Guid TreeId, string? Search = null) : IRequest<Result<IReadOnlyList<PersonDto>>>;

public class GetPersonsByTreeHandler : IRequestHandler<GetPersonsByTreeQuery, Result<IReadOnlyList<PersonDto>>>
{
    private readonly IQsengDbContext _db;
    public GetPersonsByTreeHandler(IQsengDbContext db) => _db = db;

    public async Task<Result<IReadOnlyList<PersonDto>>> Handle(GetPersonsByTreeQuery q, CancellationToken ct)
    {
        var query = _db.Persons.Where(p => p.TreeId == q.TreeId);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.ToLowerInvariant();
            query = query.Where(p =>
                p.FirstName.ToLower().Contains(s) ||
                p.LastName.ToLower().Contains(s));
        }
        var persons = await query
            .OrderBy(p => p.LastName).ThenBy(p => p.FirstName)
            .ToListAsync(ct);
        return Result<IReadOnlyList<PersonDto>>.Ok(persons.Select(CreatePersonHandler.ToDto).ToList());
    }
}
