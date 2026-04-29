namespace Qseng.Domain.ValueObjects;

public sealed record PartialDate(int? Year, int? Month, int? Day, bool Approx = false)
{
    public bool IsUnknown => Year is null;

    public DateTime SortableDate =>
        Year is null
            ? new DateTime(9999, 12, 31)
            : new DateTime(Year.Value, Month ?? 1, Day ?? 1);

    public override string ToString()
    {
        if (Year is null) return "unknown";
        var s = Day is not null && Month is not null
            ? $"{Day:00}.{Month:00}.{Year}"
            : Month is not null
                ? $"{Month:00}.{Year}"
                : $"{Year}";
        return Approx ? $"~{s}" : s;
    }

    public static PartialDate? TryParse(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return null;
        var s = input.Trim();
        var approx = s.StartsWith('~') || s.StartsWith("ca.", StringComparison.OrdinalIgnoreCase);
        s = s.TrimStart('~').Replace("ca.", "", StringComparison.OrdinalIgnoreCase).Trim();

        var parts = s.Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return parts.Length switch
        {
            1 when int.TryParse(parts[0], out var y) => new PartialDate(y, null, null, approx),
            2 when int.TryParse(parts[0], out var m) && int.TryParse(parts[1], out var y2) =>
                new PartialDate(y2, m, null, approx),
            3 when int.TryParse(parts[0], out var d) && int.TryParse(parts[1], out var m3) && int.TryParse(parts[2], out var y3) =>
                new PartialDate(y3, m3, d, approx),
            _ => null
        };
    }
}
