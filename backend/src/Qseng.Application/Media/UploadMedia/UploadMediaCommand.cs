using MediatR;
using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;
using Qseng.Domain.Enums;

namespace Qseng.Application.Media.UploadMedia;

public record UploadMediaCommand(Guid PersonId, string FileName, Stream Content, string? Caption, MediaKind Kind)
    : IRequest<Result<MediaDto>>;

public class UploadMediaHandler : IRequestHandler<UploadMediaCommand, Result<MediaDto>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _currentUser;
    private readonly IFileStorage _fileStorage;

    public UploadMediaHandler(IQsengDbContext db, ICurrentUser currentUser, IFileStorage fileStorage)
    { _db = db; _currentUser = currentUser; _fileStorage = fileStorage; }

    public async Task<Result<MediaDto>> Handle(UploadMediaCommand cmd, CancellationToken ct)
    {
        var person = await _db.Persons.FindAsync([cmd.PersonId], ct);
        if (person is null) return Result<MediaDto>.NotFound("Person not found.");

        var tree = await _db.Trees.FindAsync([person.TreeId], ct);
        if (tree is null || tree.OwnerId != _currentUser.UserId)
            return Result<MediaDto>.Fail("Forbidden.", 403);

        var url = await _fileStorage.SaveAsync(cmd.PersonId, cmd.FileName, cmd.Content, ct);

        // The first photo becomes the avatar; later ones must be chosen explicitly.
        var isFirstPhoto = cmd.Kind == MediaKind.Photo &&
            !await _db.Media.AnyAsync(m => m.PersonId == cmd.PersonId && m.Kind == MediaKind.Photo, ct);

        var media = new Domain.Entities.Media
        {
            PersonId = cmd.PersonId,
            Url = url,
            Caption = cmd.Caption,
            Kind = cmd.Kind,
            IsAvatar = isFirstPhoto
        };
        _db.Media.Add(media);
        await _db.SaveChangesAsync(ct);

        return Result<MediaDto>.Ok(new MediaDto(
            media.Id, media.PersonId, media.Url, media.Caption, media.Kind.ToString(), media.CreatedAt, media.IsAvatar));
    }
}
