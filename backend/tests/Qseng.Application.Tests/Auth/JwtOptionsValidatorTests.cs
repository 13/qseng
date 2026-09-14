using FluentAssertions;
using Xunit;
using Qseng.Infrastructure.Auth;

namespace Qseng.Application.Tests.Auth;

public class JwtOptionsValidatorTests
{
    private static JwtOptions Valid() => new()
    {
        Issuer = "qseng",
        Audience = "qseng",
        Key = new string('k', 32)
    };

    [Fact]
    public void Placeholder_key_is_rejected_outside_development()
    {
        var opt = Valid();
        opt.Key = JwtOptions.InsecureDevelopmentKey;

        var result = new JwtOptionsValidator(isDevelopment: false).Validate(null, opt);

        result.Failed.Should().BeTrue();
        result.FailureMessage.Should().Contain("development placeholder");
    }

    [Fact]
    public void Placeholder_key_is_allowed_in_development()
    {
        var opt = Valid();
        opt.Key = JwtOptions.InsecureDevelopmentKey;

        new JwtOptionsValidator(isDevelopment: true).Validate(null, opt).Succeeded.Should().BeTrue();
    }

    [Fact]
    public void Short_key_is_rejected_even_in_development()
    {
        var opt = Valid();
        opt.Key = "too-short";

        var result = new JwtOptionsValidator(isDevelopment: true).Validate(null, opt);

        result.Failed.Should().BeTrue();
        result.FailureMessage.Should().Contain("at least 32 characters");
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    public void Missing_key_is_rejected(string? key)
    {
        var opt = Valid();
        opt.Key = key!;

        new JwtOptionsValidator(isDevelopment: true).Validate(null, opt).Failed.Should().BeTrue();
    }

    [Fact]
    public void Missing_issuer_or_audience_is_rejected()
    {
        var opt = Valid();
        opt.Issuer = "";

        new JwtOptionsValidator(isDevelopment: true).Validate(null, opt).Failed.Should().BeTrue();
    }

    [Fact]
    public void Out_of_range_lifetimes_are_rejected()
    {
        var opt = Valid();
        opt.AccessTokenMinutes = 0;

        new JwtOptionsValidator(isDevelopment: true).Validate(null, opt).Failed.Should().BeTrue();
    }

    [Fact]
    public void A_real_configuration_passes()
    {
        new JwtOptionsValidator(isDevelopment: false).Validate(null, Valid()).Succeeded.Should().BeTrue();
    }
}
