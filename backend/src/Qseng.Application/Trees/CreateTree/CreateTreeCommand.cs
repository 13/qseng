using FluentValidation;
using MediatR;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;
using Qseng.Domain.Entities;

namespace Qseng.Application.Trees.CreateTree;

public record CreateTreeCommand(string Name, string? Description) : IRequest<Result<TreeDto>>;

public record TreeDto(Guid Id, string Name, string? Description, DateTime CreatedAt);

public class CreateTreeValidator : AbstractValidator<CreateTreeCommand>
{
    public CreateTreeValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(1000);
    }
}

public class CreateTreeHandler : IRequestHandler<CreateTreeCommand, Result<TreeDto>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _currentUser;

    public CreateTreeHandler(IQsengDbContext db, ICurrentUser currentUser)
    { _db = db; _currentUser = currentUser; }

    public async Task<Result<TreeDto>> Handle(CreateTreeCommand cmd, CancellationToken ct)
    {
        var tree = new Tree
        {
            OwnerId = _currentUser.UserId,
            Name = cmd.Name,
            Description = cmd.Description
        };
        _db.Trees.Add(tree);
        await _db.SaveChangesAsync(ct);
        return Result<TreeDto>.Ok(new TreeDto(tree.Id, tree.Name, tree.Description, tree.CreatedAt));
    }
}
