using Qseng.Domain.ValueObjects;

namespace Qseng.Application.Abstractions;

public record ParsedPerson(
    string FirstName, string LastName, string? MaidenName,
    PartialDate? Birth, PartialDate? Death,
    string? BirthPlace, string? DeathPlace);

public record ParsedMarriage(
    string SpouseAName, string SpouseBName,
    PartialDate? Date, string? Place);

public record ParseResult(
    IReadOnlyList<ParsedPerson> Persons,
    IReadOnlyList<ParsedMarriage> Marriages,
    IReadOnlyList<string> Warnings);

public interface IGenealogyParser
{
    ParseResult Parse(string text);
}
