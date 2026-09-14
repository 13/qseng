using System.Net;
using FluentAssertions;
using Qseng.Api.Options;
using Xunit;

namespace Qseng.Api.Tests;

public class ForwardedHeadersSetupTests
{
    [Fact]
    public void Parses_cidrs_into_known_networks()
    {
        var networks = ForwardedHeadersSetup.Parse(["172.16.0.0/12", "10.0.0.0/8"]);
        networks.Should().HaveCount(2);
        networks[0].BaseAddress.Should().Be(IPAddress.Parse("172.16.0.0"));
        networks[0].PrefixLength.Should().Be(12);
        networks[1].BaseAddress.Should().Be(IPAddress.Parse("10.0.0.0"));
        networks[1].PrefixLength.Should().Be(8);
    }

    [Fact]
    public void Empty_array_yields_no_networks()
    {
        ForwardedHeadersSetup.Parse([]).Should().BeEmpty();
    }

    [Fact]
    public void Malformed_entry_throws_a_clear_format_exception()
    {
        var act = () => ForwardedHeadersSetup.Parse(["not-a-cidr"]);
        act.Should().Throw<FormatException>().WithMessage("*not-a-cidr*");
    }
}
