using Qseng.Domain.Enums;
using Qseng.Domain.ValueObjects;

namespace Qseng.Application.Persons;

public record PersonDto(
    Guid Id, Guid TreeId,
    string FirstName, string LastName, string? MaidenName,
    Sex Sex, string? Notes,
    PartialDate? Birth, PartialDate? Death,
    string? BirthPlace, string? DeathPlace,
    string? CauseOfDeath,
    DateTime CreatedAt, DateTime UpdatedAt,
    string? AvatarUrl = null);
