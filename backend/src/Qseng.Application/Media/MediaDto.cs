using Qseng.Domain.Enums;

namespace Qseng.Application.Media;

public record MediaDto(
    Guid Id, Guid PersonId, string Url, string? Caption, MediaKind Kind, DateTime CreatedAt,
    bool IsAvatar = false);
