using System.Text.RegularExpressions;
using Qseng.Application.Abstractions;
using Qseng.Domain.ValueObjects;

namespace Qseng.Infrastructure.Parsing;

public class GenealogyTextParser : IGenealogyParser
{
    private const string DatePat = @"(?:~|ca\.\s*)?(?:\d{1,2}\.\d{1,2}\.\d{4}|\d{1,2}\.\d{4}|\d{4})";

    private static readonly Regex PersonRx = new(
        $@"^\s*[-•*]?\s*(?<full>[A-ZÄÖÜ][\wäöüÄÖÜß\-]+(?:\s+[A-ZÄÖÜ][\wäöüÄÖÜß\-]+)+)" +
        $@"(?:,\s*geb\.\s*(?<maiden>[A-ZÄÖÜ][\wäöüÄÖÜß\-]+))?" +
        $@"\s*\*\s*(?<birth>{DatePat})(?:\s+in\s+(?<bplace>[^+\n]+?))?" +
        $@"(?:\s*\+\s*(?<death>{DatePat})(?:\s+in\s+(?<dplace>[^\n]+))?)?" +
        @"\s*$",
        RegexOptions.Multiline | RegexOptions.IgnoreCase);

    private static readonly Regex MarriageRx = new(
        $@"(?<a>[A-ZÄÖÜ][\wäöüÄÖÜß\- ]+?)\s+oo\s+(?<b>[A-ZÄÖÜ][\wäöüÄÖÜß\- ]+?)" +
        $@"(?:,\s*(?<date>{DatePat}))?" +
        @"(?:\s+in\s+(?<place>[^\n]+))?",
        RegexOptions.IgnoreCase);

    public ParseResult Parse(string text)
    {
        var warnings = new List<string>();
        var persons = new List<ParsedPerson>();
        var marriages = new List<ParsedMarriage>();

        var cleaned = Regex.Replace(text, @"[ \t]+", " ");

        foreach (Match m in PersonRx.Matches(cleaned))
        {
            var fullName = m.Groups["full"].Value.Trim();
            var (first, last) = SplitName(fullName);
            persons.Add(new ParsedPerson(
                first, last,
                MaidenName: NullIfEmpty(m.Groups["maiden"].Value),
                Birth: PartialDate.TryParse(m.Groups["birth"].Value),
                Death: PartialDate.TryParse(m.Groups["death"].Value),
                BirthPlace: NullIfEmpty(m.Groups["bplace"].Value)?.Trim(),
                DeathPlace: NullIfEmpty(m.Groups["dplace"].Value)?.Trim()));
        }

        foreach (Match m in MarriageRx.Matches(cleaned))
        {
            marriages.Add(new ParsedMarriage(
                m.Groups["a"].Value.Trim(),
                m.Groups["b"].Value.Trim(),
                PartialDate.TryParse(m.Groups["date"].Value),
                NullIfEmpty(m.Groups["place"].Value)?.Trim()));
        }

        if (persons.Count == 0)
            warnings.Add("Keine Personen erkannt – bitte Format prüfen (* für Geburt, + für Tod).");

        return new ParseResult(persons, marriages, warnings);
    }

    private static (string First, string Last) SplitName(string full)
    {
        var parts = full.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return parts.Length == 1 ? (parts[0], "") : (string.Join(' ', parts[..^1]), parts[^1]);
    }

    private static string? NullIfEmpty(string? s) => string.IsNullOrWhiteSpace(s) ? null : s;
}
