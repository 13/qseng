using MediatR;
using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;

namespace Qseng.Application.Media.GetPersonMedia;

public record GetPersonMediaQuery(Guid PersonId) : IRequest<Result<List<MediaDto>>>;

public class GetPersonMediaHandler : IRequestHandler<GetPersonMediaQuery, Result<List<MediaDto>>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _currentUser;

    public GetPersonMediaHandler(IQsengDbContext db, ICurrentUser currentUser)
    { _db = db; _currentUser = currentUser; }

    public async Task<Result<List<MediaDto>>> Handle(GetPersonMediaQuery q, CancellationToken ct)
    {
        var person = await _db.Persons.FindAsync([q.PersonId], ct);
        if (person is null) return Result<List<MediaDto>>.NotFound("Person not found.");

        var tree = await _db.Trees.FindAsync([person.TreeId], ct);
        if (tree is null || tree.OwnerId != _currentUser.UserId)
            return Result<List<MediaDto>>.Fail("Forbidden.", 403);

        var media = await _db.Media
            .Where(m => m.PersonId == q.PersonId)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new MediaDto(m.Id, m.PersonId, m.Url, m.Caption, m.Kind.ToString(), m.CreatedAt))
            .ToListAsync(ct);

        return Result<List<MediaDto>>.Ok(media);
    }
}
