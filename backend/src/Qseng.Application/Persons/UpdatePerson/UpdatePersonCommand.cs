using FluentValidation;
using MediatR;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;
using Qseng.Application.Persons.CreatePerson;
using Qseng.Domain.Enums;
using Qseng.Domain.ValueObjects;

namespace Qseng.Application.Persons.UpdatePerson;

public record UpdatePersonCommand(
    Guid Id,
    string FirstName, string LastName, string? MaidenName,
    Sex Sex, string? Notes,
    PartialDate? Birth, PartialDate? Death,
    string? BirthPlace, string? DeathPlace)
    : IRequest<Result<PersonDto>>;

public class UpdatePersonValidator : AbstractValidator<UpdatePersonCommand>
{
    public UpdatePersonValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(200);
    }
}

public class UpdatePersonHandler : IRequestHandler<UpdatePersonCommand, Result<PersonDto>>
{
    private readonly IQsengDbContext _db;
    public UpdatePersonHandler(IQsengDbContext db) => _db = db;

    public async Task<Result<PersonDto>> Handle(UpdatePersonCommand cmd, CancellationToken ct)
    {
        var person = await _db.Persons.FindAsync([cmd.Id], ct);
        if (person is null) return Result<PersonDto>.NotFound("Person not found.");

        person.FirstName = cmd.FirstName; person.LastName = cmd.LastName;
        person.MaidenName = cmd.MaidenName; person.Sex = cmd.Sex; person.Notes = cmd.Notes;
        person.Birth = cmd.Birth; person.Death = cmd.Death;
        person.BirthPlace = cmd.BirthPlace; person.DeathPlace = cmd.DeathPlace;
        person.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Result<PersonDto>.Ok(CreatePersonHandler.ToDto(person));
    }
}
