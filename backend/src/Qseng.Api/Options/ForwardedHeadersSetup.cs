using System.Net;

namespace Qseng.Api.Options;

/// <summary>Parses "ForwardedHeaders:KnownNetworks" CIDR strings into <see cref="IPNetwork"/> entries
/// for <see cref="Microsoft.AspNetCore.HttpOverrides.ForwardedHeadersOptions.KnownNetworks"/>.</summary>
public static class ForwardedHeadersSetup
{
    public static IList<IPNetwork> Parse(string[] cidrs)
    {
        var networks = new List<IPNetwork>();
        foreach (var cidr in cidrs)
        {
            var parts = cidr.Split('/');
            if (parts.Length != 2 || !IPAddress.TryParse(parts[0], out var address) || !int.TryParse(parts[1], out var prefixLength))
                throw new FormatException($"ForwardedHeaders:KnownNetworks entry '{cidr}' is not a valid CIDR (expected e.g. '172.16.0.0/12').");

            networks.Add(new IPNetwork(address, prefixLength));
        }
        return networks;
    }
}
