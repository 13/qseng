using FluentAssertions;
using Qseng.Domain.ValueObjects;
using Xunit;

namespace Qseng.Domain.Tests;

public class PartialDateTests
{
    [Fact] public void Year_only_parses() => PartialDate.TryParse("1923").Should().Be(new PartialDate(1923, null, null));
    [Fact] public void Month_year_parses() => PartialDate.TryParse("06.1923").Should().Be(new PartialDate(1923, 6, null));
    [Fact] public void Full_date_parses() => PartialDate.TryParse("12.06.1923").Should().Be(new PartialDate(1923, 6, 12));
    [Fact] public void Approx_tilde_parses() => PartialDate.TryParse("~1900")!.Approx.Should().BeTrue();
    [Fact] public void Null_returns_null() => PartialDate.TryParse(null).Should().BeNull();
    [Fact] public void Unknown_sorts_to_end() => new PartialDate(null, null, null).SortableDate.Year.Should().Be(9999);
    [Fact] public void ToString_year_only() => new PartialDate(1923, null, null).ToString().Should().Be("1923");
    [Fact] public void ToString_approx() => new PartialDate(1923, null, null, true).ToString().Should().Be("~1923");
}
