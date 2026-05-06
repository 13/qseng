using MediatR;
using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;

namespace Qseng.Application.Persons.DeletePerson;

public record DeletePersonCommand(Guid Id) : IRequest<Result<bool>>;

public class DeletePersonHandler : IRequestHandler<DeletePersonCommand, Result<bool>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _currentUser;
    private readonly IFileStorage _fileStorage;

    public DeletePersonHandler(IQsengDbContext db, ICurrentUser currentUser, IFileStorage fileStorage)
    { _db = db; _currentUser = currentUser; _fileStorage = fileStorage; }

    public async Task<Result<bool>> Handle(DeletePersonCommand cmd, CancellationToken ct)
    {
        var person = await _db.Persons.FindAsync([cmd.Id], ct);
        if (person is null) return Result<bool>.NotFound("Person not found.");

        var tree = await _db.Trees.FindAsync([person.TreeId], ct);
        if (tree is null || tree.OwnerId != _currentUser.UserId) return Result<bool>.Fail("Forbidden.", 403);

        var mediaFiles = await _db.Media
            .Where(m => m.PersonId == cmd.Id)
            .Select(m => m.Url)
            .ToListAsync(ct);

        foreach (var url in mediaFiles)
            await _fileStorage.DeleteAsync(url, ct);

        _db.Persons.Remove(person);
        await _db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}
