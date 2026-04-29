using Qseng.Domain.Enums;

namespace Qseng.Application.Relationships;

public record RelationshipDto(
    Guid Id, Guid TreeId, Guid FromPersonId, Guid ToPersonId,
    RelationshipType Type,
    int? StartYear, int? StartMonth, int? StartDay,
    int? EndYear, int? EndMonth, int? EndDay,
    string? Notes);
