using System.Reflection;

namespace Qseng.Api;

/// <summary>
/// Build identity stamped at publish time (see docker/Dockerfile.api: -p:InformationalVersion=&lt;version&gt;+&lt;commit&gt;).
/// Local builds carry the csproj defaults ("0.0.0-dev", no commit).
/// </summary>
public static class AppVersion
{
    public const string DefaultVersion = "0.0.0-dev";
    public const string UnknownCommit = "unknown";

    public static string Version { get; }
    public static string Commit { get; }

    static AppVersion()
    {
        var info = typeof(AppVersion).Assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
        (Version, Commit) = Parse(info ?? DefaultVersion);
    }

    public static (string Version, string Commit) Parse(string informationalVersion)
    {
        if (string.IsNullOrWhiteSpace(informationalVersion)) return (DefaultVersion, UnknownCommit);
        var plus = informationalVersion.IndexOf('+');
        if (plus < 0) return (informationalVersion, UnknownCommit);
        var commit = informationalVersion[(plus + 1)..];
        return (informationalVersion[..plus], commit.Length == 0 ? UnknownCommit : commit);
    }
}
