using FluentValidation;
using MediatR;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;
using Qseng.Domain.Entities;
using Qseng.Domain.Enums;
using Qseng.Domain.ValueObjects;

namespace Qseng.Application.Persons.CreatePerson;

public record CreatePersonCommand(
    Guid TreeId,
    string FirstName, string LastName, string? MaidenName,
    Sex Sex, string? Notes,
    PartialDate? Birth, PartialDate? Death,
    string? BirthPlace, string? DeathPlace)
    : IRequest<Result<PersonDto>>;

public class CreatePersonValidator : AbstractValidator<CreatePersonCommand>
{
    public CreatePersonValidator()
    {
        RuleFor(x => x.TreeId).NotEmpty();
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(200);
    }
}

public class CreatePersonHandler : IRequestHandler<CreatePersonCommand, Result<PersonDto>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _currentUser;

    public CreatePersonHandler(IQsengDbContext db, ICurrentUser currentUser)
    { _db = db; _currentUser = currentUser; }

    public async Task<Result<PersonDto>> Handle(CreatePersonCommand cmd, CancellationToken ct)
    {
        var tree = await _db.Trees.FindAsync([cmd.TreeId], ct);
        if (tree is null) return Result<PersonDto>.NotFound("Tree not found.");
        if (tree.OwnerId != _currentUser.UserId) return Result<PersonDto>.Fail("Forbidden.", 403);

        var person = new Person
        {
            TreeId = cmd.TreeId,
            FirstName = cmd.FirstName, LastName = cmd.LastName, MaidenName = cmd.MaidenName,
            Sex = cmd.Sex, Notes = cmd.Notes,
            Birth = cmd.Birth, Death = cmd.Death,
            BirthPlace = cmd.BirthPlace, DeathPlace = cmd.DeathPlace
        };
        _db.Persons.Add(person);
        await _db.SaveChangesAsync(ct);
        return Result<PersonDto>.Ok(ToDto(person));
    }

    internal static PersonDto ToDto(Person p) => new(
        p.Id, p.TreeId, p.FirstName, p.LastName, p.MaidenName,
        p.Sex, p.Notes, p.Birth, p.Death, p.BirthPlace, p.DeathPlace,
        p.CreatedAt, p.UpdatedAt);
}
