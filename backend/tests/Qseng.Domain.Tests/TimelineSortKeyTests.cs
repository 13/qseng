using FluentAssertions;
using Xunit;
using Qseng.Domain.Entities;
using Qseng.Domain.ValueObjects;

namespace Qseng.Domain.Tests;

public class TimelineSortKeyTests
{
    private static int KeyFor(PartialDate? date)
    {
        var e = new TimelineEvent { Title = "x", Start = date };
        e.RecomputeSortKey();
        return e.StartSortKey;
    }

    [Fact]
    public void Full_date_encodes_as_yyyyMMdd()
    {
        KeyFor(new PartialDate(1878, 4, 12)).Should().Be(18780412);
    }

    [Fact]
    public void Missing_day_and_month_pad_with_zeros()
    {
        KeyFor(new PartialDate(1878, 4, null)).Should().Be(18780400);
        KeyFor(new PartialDate(1878, null, null)).Should().Be(18780000);
    }

    [Fact]
    public void An_unknown_date_is_zero_so_it_sorts_last_descending()
    {
        KeyFor(null).Should().Be(0);
        KeyFor(new PartialDate(null, 4, 12)).Should().Be(0);
    }

    [Fact]
    public void Keys_order_chronologically()
    {
        var dates = new PartialDate?[]
        {
            new(1878, 4, 12),
            new(1878, 4, 1),
            new(1878, 1, null),
            new(1877, 12, 31),
            null
        };

        var keys = dates.Select(KeyFor).ToList();

        // Descending: newest first, unknown last.
        keys.OrderByDescending(k => k).Should().ContainInOrder(
            18780412, 18780401, 18780100, 18771231, 0);
    }

    [Fact]
    public void Approximate_flag_does_not_affect_ordering()
    {
        KeyFor(new PartialDate(1900, 6, 1, Approx: true))
            .Should().Be(KeyFor(new PartialDate(1900, 6, 1)));
    }
}
