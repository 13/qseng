using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;
using Qseng.Application.Trees.CreateTree;

namespace Qseng.Application.Trees.UpdateTree;

public record UpdateTreeCommand(Guid Id, string Name, string? Description) : IRequest<Result<TreeDto>>;

public class UpdateTreeValidator : AbstractValidator<UpdateTreeCommand>
{
    public UpdateTreeValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(1000);
    }
}

public class UpdateTreeHandler : IRequestHandler<UpdateTreeCommand, Result<TreeDto>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _currentUser;

    public UpdateTreeHandler(IQsengDbContext db, ICurrentUser currentUser)
    { _db = db; _currentUser = currentUser; }

    public async Task<Result<TreeDto>> Handle(UpdateTreeCommand cmd, CancellationToken ct)
    {
        var tree = await _db.Trees.FindAsync([cmd.Id], ct);
        if (tree is null) return Result<TreeDto>.NotFound("Tree not found.");
        if (tree.OwnerId != _currentUser.UserId) return Result<TreeDto>.Fail("Forbidden.", 403);

        tree.Name = cmd.Name;
        tree.Description = cmd.Description;
        await _db.SaveChangesAsync(ct);
        var personCount = await _db.Persons.CountAsync(p => p.TreeId == tree.Id, ct);
        return Result<TreeDto>.Ok(new TreeDto(tree.Id, tree.Name, tree.Description, tree.CreatedAt, personCount));
    }
}
