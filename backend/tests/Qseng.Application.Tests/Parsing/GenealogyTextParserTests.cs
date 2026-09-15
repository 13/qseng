using System.IO;
using FluentAssertions;
using Qseng.Infrastructure.Parsing;
using Xunit;

namespace Qseng.Application.Tests.Parsing;

public class GenealogyTextParserTests
{
    // A copy of frontend/e2e/assets/sample-import.txt (kept byte-identical — that file is also
    // pasted verbatim by frontend/e2e/specs/import.spec.ts), copied to the output directory via
    // the csproj's <None ... CopyToOutputDirectory> instead of reached by hopping out to
    // frontend/ through AppContext.BaseDirectory: that path depended on the exact
    // bin/{Debug,Release}/net10.0 output layout and coupled this backend unit test to a frontend
    // asset. If you change one copy, change the other the same way.
    private static readonly string SampleImportPath = Path.Combine(AppContext.BaseDirectory, "Parsing", "sample-import.txt");

    [Fact]
    public void MarriageLine_WithYearOnly_CapturesFullSpouseName()
    {
        var result = new GenealogyTextParser().Parse("Max Mustermann oo Maria Huber, 1905");

        result.Marriages.Should().ContainSingle();
        var marriage = result.Marriages[0];
        marriage.SpouseAName.Should().Be("Max Mustermann");
        marriage.SpouseBName.Should().Be("Maria Huber");
        marriage.Date.Should().NotBeNull();
        marriage.Date!.Year.Should().Be(1905);
        marriage.Place.Should().BeNull();
    }

    [Fact]
    public void MarriageLine_WithFullDateAndPlace_CapturesDateAndPlace()
    {
        var result = new GenealogyTextParser().Parse("Max Mustermann oo Maria Huber, 12.06.1905 in Wien");

        var marriage = result.Marriages.Should().ContainSingle().Subject;
        marriage.SpouseAName.Should().Be("Max Mustermann");
        marriage.SpouseBName.Should().Be("Maria Huber");
        marriage.Date.Should().NotBeNull();
        marriage.Date!.Year.Should().Be(1905);
        marriage.Date.Month.Should().Be(6);
        marriage.Date.Day.Should().Be(12);
        marriage.Place.Should().Be("Wien");
    }

    [Fact]
    public void MarriageLine_WithPlaceOnly_CapturesPlaceAndNoDate()
    {
        var result = new GenealogyTextParser().Parse("Max Mustermann oo Maria Huber in Wien");

        var marriage = result.Marriages.Should().ContainSingle().Subject;
        marriage.SpouseAName.Should().Be("Max Mustermann");
        marriage.SpouseBName.Should().Be("Maria Huber");
        marriage.Date.Should().BeNull();
        marriage.Place.Should().Be("Wien");
    }

    [Fact]
    public void MarriageLine_AsLastLineOfFixtureText_CapturesFullSpouseName()
    {
        var text =
            "Max Mustermann * 12.06.1880 in Wien\n" +
            "  + 03.04.1950 in Salzburg\n" +
            "Maria Huber, geb. Schmidt * 1883 + 1960\n" +
            "Max Mustermann oo Maria Huber";

        var result = new GenealogyTextParser().Parse(text);

        result.Persons.Should().HaveCount(2);
        var marriage = result.Marriages.Should().ContainSingle().Subject;
        marriage.SpouseBName.Should().Be("Maria Huber");
    }

    [Fact]
    public void SampleImportFixture_Verbatim_ParsesTwoPersonsAndOneMarriage()
    {
        var text = File.ReadAllText(SampleImportPath);

        var result = new GenealogyTextParser().Parse(text);

        result.Persons.Should().HaveCount(2);
        var marriage = result.Marriages.Should().ContainSingle().Subject;
        marriage.SpouseBName.Should().Be("Maria Huber");
    }

    [Fact]
    public void MarriageLine_AfterPersonLineEndingInPlace_DoesNotCaptureAcrossNewline()
    {
        var text =
            "Maria Huber, geb. Schmidt * 1883 in Graz\n" +
            "Max Mustermann oo Maria Huber, 1905";

        var result = new GenealogyTextParser().Parse(text);

        var marriage = result.Marriages.Should().ContainSingle().Subject;
        marriage.SpouseAName.Should().Be("Max Mustermann");
        marriage.SpouseBName.Should().Be("Maria Huber");
    }

    [Fact]
    public void MarriageLine_WithLowercaseParticles_CapturesFullNamesOnBothSides()
    {
        var result = new GenealogyTextParser().Parse("Ludwig von Beethoven oo Anna de Vries");

        var marriage = result.Marriages.Should().ContainSingle().Subject;
        marriage.SpouseAName.Should().Be("Ludwig von Beethoven");
        marriage.SpouseBName.Should().Be("Anna de Vries");
    }

    [Theory]
    [InlineData("- Max Mustermann oo Maria Huber, 1905")]
    [InlineData("• Max Mustermann oo Maria Huber, 1905")]
    [InlineData("* Max Mustermann oo Maria Huber, 1905")]
    public void MarriageLine_WithBulletPrefix_MatchesSameAsPersonRx(string text)
    {
        // PersonRx already accepts this optional prefix (`^\s*[-•*]?\s*`); MarriageRx must too.
        var result = new GenealogyTextParser().Parse(text);

        var marriage = result.Marriages.Should().ContainSingle().Subject;
        marriage.SpouseAName.Should().Be("Max Mustermann");
        marriage.SpouseBName.Should().Be("Maria Huber");
    }
}
