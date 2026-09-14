namespace Qseng.Application.Media;

public record MediaDto(
    Guid Id, Guid PersonId, string Url, string? Caption, string Kind, DateTime CreatedAt,
    bool IsAvatar = false);
