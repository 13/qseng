namespace Qseng.Application.Abstractions;

public interface IFileStorage
{
    Task<string> SaveAsync(Guid personId, string originalFileName, Stream content, CancellationToken ct = default);
    Task DeleteAsync(string url, CancellationToken ct = default);
}
