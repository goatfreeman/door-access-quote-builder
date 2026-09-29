import { promises as dns } from "node:dns";
import { BlockList } from "node:net";
import type { CompatibilityResult } from "../validation/domain";

type ResolvedAddress = { address: string; family: number };
type AddressLookup = (hostname: string) => Promise<readonly ResolvedAddress[]>;

const blockedAddresses = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) blockedAddresses.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001:2::", 48],
  ["2001:10::", 28],
  ["2001:20::", 28],
  ["2001:db8::", 32],
  ["3fff::", 20],
  ["5f00::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
] as const) blockedAddresses.addSubnet(network, prefix, "ipv6");

const systemLookup: AddressLookup = async (hostname) => dns.lookup(hostname, { all: true, verbatim: true });

export async function assertPublicEvidenceDestinations(result: CompatibilityResult, lookup: AddressLookup = systemLookup) {
  const hostnames = new Set(result.reports.flatMap((report) => report.sources.map((source) => new URL(source).hostname)));
  for (const hostname of hostnames) {
    let addresses: readonly ResolvedAddress[];
    try {
      addresses = await lookup(hostname);
    } catch {
      throw new Error("Evidence source must resolve to a public network destination");
    }
    if (!addresses.length || addresses.some(({ address, family }) => {
      if (family === 4) return blockedAddresses.check(address, "ipv4");
      if (family === 6) return address.toLowerCase().startsWith("::ffff:") || blockedAddresses.check(address, "ipv6");
      return true;
    })) {
      throw new Error("Evidence source must resolve to a public network destination");
    }
  }
}
