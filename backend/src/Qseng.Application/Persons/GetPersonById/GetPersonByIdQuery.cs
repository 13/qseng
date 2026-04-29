using MediatR;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;
using Qseng.Application.Persons.CreatePerson;

namespace Qseng.Application.Persons.GetPersonById;

public record GetPersonByIdQuery(Guid Id) : IRequest<Result<PersonDto>>;

public class GetPersonByIdHandler : IRequestHandler<GetPersonByIdQuery, Result<PersonDto>>
{
    private readonly IQsengDbContext _db;
    public GetPersonByIdHandler(IQsengDbContext db) => _db = db;

    public async Task<Result<PersonDto>> Handle(GetPersonByIdQuery q, CancellationToken ct)
    {
        var person = await _db.Persons.FindAsync([q.Id], ct);
        if (person is null) return Result<PersonDto>.NotFound("Person not found.");
        return Result<PersonDto>.Ok(CreatePersonHandler.ToDto(person));
    }
}
