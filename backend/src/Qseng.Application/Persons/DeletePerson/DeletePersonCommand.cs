using MediatR;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;

namespace Qseng.Application.Persons.DeletePerson;

public record DeletePersonCommand(Guid Id) : IRequest<Result<bool>>;

public class DeletePersonHandler : IRequestHandler<DeletePersonCommand, Result<bool>>
{
    private readonly IQsengDbContext _db;
    public DeletePersonHandler(IQsengDbContext db) => _db = db;

    public async Task<Result<bool>> Handle(DeletePersonCommand cmd, CancellationToken ct)
    {
        var person = await _db.Persons.FindAsync([cmd.Id], ct);
        if (person is null) return Result<bool>.NotFound("Person not found.");
        _db.Persons.Remove(person);
        await _db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}
