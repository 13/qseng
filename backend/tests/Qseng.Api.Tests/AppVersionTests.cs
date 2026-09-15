using FluentAssertions;
using Qseng.Api;
using Xunit;

public class AppVersionTests
{
    [Theory]
    [InlineData("1.2.0+abc1234", "1.2.0", "abc1234")]
    [InlineData("0.0.0-edge+9f8e7d6c5b4a", "0.0.0-edge", "9f8e7d6c5b4a")]
    [InlineData("0.0.0-dev", "0.0.0-dev", "unknown")]
    [InlineData("", "0.0.0-dev", "unknown")]
    public void Parse_splits_version_and_commit(string input, string version, string commit)
    {
        var (v, c) = AppVersion.Parse(input);
        v.Should().Be(version);
        c.Should().Be(commit);
    }

    [Fact]
    public void Static_values_are_never_empty()
    {
        AppVersion.Version.Should().NotBeNullOrWhiteSpace();
        AppVersion.Commit.Should().NotBeNullOrWhiteSpace();
    }
}
