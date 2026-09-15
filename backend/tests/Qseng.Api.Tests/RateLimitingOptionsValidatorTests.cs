using FluentAssertions;
using Qseng.Infrastructure.Options;
using Xunit;

namespace Qseng.Api.Tests;

public class RateLimitingOptionsValidatorTests
{
    [Fact]
    public void Default_options_are_valid()
    {
        var result = new RateLimitingOptionsValidator().Validate(null, new RateLimitingOptions());
        result.Succeeded.Should().BeTrue();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void PermitLimit_below_one_is_rejected(int permitLimit)
    {
        var o = new RateLimitingOptions { Auth = { PermitLimit = permitLimit } };
        var result = new RateLimitingOptionsValidator().Validate(null, o);
        result.Failed.Should().BeTrue();
        result.FailureMessage.Should().Contain("RateLimiting:Auth:PermitLimit");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void WindowSeconds_below_one_is_rejected(int windowSeconds)
    {
        var o = new RateLimitingOptions { Auth = { WindowSeconds = windowSeconds } };
        var result = new RateLimitingOptionsValidator().Validate(null, o);
        result.Failed.Should().BeTrue();
        result.FailureMessage.Should().Contain("RateLimiting:Auth:WindowSeconds");
    }

    [Fact]
    public void Both_invalid_reports_both_errors()
    {
        var o = new RateLimitingOptions { Auth = { PermitLimit = 0, WindowSeconds = 0 } };
        var result = new RateLimitingOptionsValidator().Validate(null, o);
        result.Failed.Should().BeTrue();
        result.FailureMessage.Should().Contain("PermitLimit").And.Contain("WindowSeconds");
    }
}
