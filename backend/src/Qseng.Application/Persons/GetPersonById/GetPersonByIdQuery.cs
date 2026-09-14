using MediatR;
using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;
using Qseng.Application.Persons.CreatePerson;

namespace Qseng.Application.Persons.GetPersonById;

public record GetPersonByIdQuery(Guid Id) : IRequest<Result<PersonDto>>;

public class GetPersonByIdHandler : IRequestHandler<GetPersonByIdQuery, Result<PersonDto>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _currentUser;

    public GetPersonByIdHandler(IQsengDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<Result<PersonDto>> Handle(GetPersonByIdQuery q, CancellationToken ct)
    {
        var person = await _db.Persons.FirstOrDefaultAsync(p => p.Id == q.Id, ct);
        if (person is null) return Result<PersonDto>.NotFound("Person not found.");

        var tree = await _db.Trees.FindAsync([person.TreeId], ct);
        if (tree is null) return Result<PersonDto>.NotFound("Person not found.");
        if (tree.OwnerId != _currentUser.UserId) return Result<PersonDto>.Fail("Forbidden.", 403);

        return Result<PersonDto>.Ok(CreatePersonHandler.ToDto(person));
    }
}
