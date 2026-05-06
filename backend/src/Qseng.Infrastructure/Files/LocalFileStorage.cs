using Microsoft.Extensions.Configuration;
using Qseng.Application.Abstractions;

namespace Qseng.Infrastructure.Files;

public class LocalFileStorage : IFileStorage
{
    private readonly string _root;

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg",
        ".pdf",
        ".mp3", ".wav", ".ogg", ".m4a"
    };

    public LocalFileStorage(IConfiguration cfg)
    {
        var configured = cfg["Uploads:Path"];
        _root = configured is not null && Path.IsPathRooted(configured)
            ? configured
            : Path.Combine(Directory.GetCurrentDirectory(), configured ?? "uploads");
        Directory.CreateDirectory(_root);
    }

    public async Task<string> SaveAsync(Guid personId, string originalFileName, Stream content, CancellationToken ct = default)
    {
        var ext = Path.GetExtension(originalFileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(ext))
            throw new InvalidOperationException($"File type '{ext}' is not allowed.");

        var dir = Path.Combine(_root, personId.ToString());
        Directory.CreateDirectory(dir);

        var filename = $"{Guid.NewGuid()}{ext}";
        var fullPath = Path.Combine(dir, filename);

        await using var fs = new FileStream(fullPath, FileMode.Create, FileAccess.Write, FileShare.None, 65536, useAsync: true);
        await content.CopyToAsync(fs, ct);

        return $"/uploads/{personId}/{filename}";
    }

    public Task DeleteAsync(string url, CancellationToken ct = default)
    {
        const string prefix = "/uploads/";
        if (!url.StartsWith(prefix, StringComparison.Ordinal)) return Task.CompletedTask;

        var relative = url[prefix.Length..].Replace('/', Path.DirectorySeparatorChar);
        var abs = Path.Combine(_root, relative);
        if (File.Exists(abs)) File.Delete(abs);
        return Task.CompletedTask;
    }
}
