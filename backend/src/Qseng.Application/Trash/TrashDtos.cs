namespace Qseng.Application.Trash;

public record TrashedPersonDto(Guid Id, string FirstName, string LastName, Guid TreeId, string TreeName, DateTime DeletedAt, DateTime PurgeAt);

public record TrashListDto(int RetentionDays, List<TrashedPersonDto> Items);
