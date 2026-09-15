using FluentAssertions;
using Qseng.Infrastructure.Options;
using Xunit;

namespace Qseng.Api.Tests;

public class CorsOptionsValidatorTests
{
    [Fact]
    public void Production_rejects_an_empty_origin_list()
    {
        var result = new CorsOptionsValidator(isDevelopment: false).Validate(null, new CorsOptions());
        result.Failed.Should().BeTrue();
        result.FailureMessage.Should().Contain("Cors:AllowedOrigins");
    }

    [Fact]
    public void Development_defaults_to_the_angular_dev_server()
    {
        var o = new CorsOptions();
        new CorsOptionsValidator(isDevelopment: true).Validate(null, o).Succeeded.Should().BeTrue();
        o.EffectiveOrigins(isDevelopment: true).Should().Equal("http://localhost:4200");
    }

    [Fact]
    public void Origins_must_be_absolute_urls_without_a_path()
    {
        var o = new CorsOptions { AllowedOrigins = ["https://app.example.org", "not a url", "https://x.org/app", "https://slash.org/"] };
        var result = new CorsOptionsValidator(isDevelopment: false).Validate(null, o);
        result.Failed.Should().BeTrue();
        result.FailureMessage.Should().Contain("not a url").And.Contain("https://x.org/app").And.Contain("https://slash.org/", "a trailing slash never matches the Origin header");
    }
}
