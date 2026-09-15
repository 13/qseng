using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;

namespace Qseng.Application.Trash.ListTrash;

public record ListTrashQuery : IRequest<Result<TrashListDto>>;

public class ListTrashHandler : IRequestHandler<ListTrashQuery, Result<TrashListDto>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _currentUser;
    private readonly IOptions<TrashOptions> _options;

    public ListTrashHandler(IQsengDbContext db, ICurrentUser currentUser, IOptions<TrashOptions> options)
    { _db = db; _currentUser = currentUser; _options = options; }

    public async Task<Result<TrashListDto>> Handle(ListTrashQuery query, CancellationToken ct)
    {
        var user = _currentUser.UserId;
        var days = _options.Value.RetentionDays;

        var items = await (
            from p in _db.Persons.IgnoreQueryFilters()
            join t in _db.Trees on p.TreeId equals t.Id
            where t.OwnerId == user && p.DeletedAt != null
            orderby p.DeletedAt descending
            select new TrashedPersonDto(p.Id, p.FirstName, p.LastName, t.Id, t.Name, p.DeletedAt!.Value, p.DeletedAt.Value.AddDays(days))
        ).ToListAsync(ct);

        return Result<TrashListDto>.Ok(new TrashListDto(days, items));
    }
}
