import { isIP } from "node:net";

export function sessionIpAddress(headers?: Headers): string | undefined {
  // Vercel supplies these headers and overwrites x-forwarded-for. Other hosts
  // must configure their trusted proxy to replace forwarded client headers.
  const forwarded = headers?.get("x-vercel-forwarded-for") ?? headers?.get("x-forwarded-for");
  const address = forwarded?.split(",", 1)[0].trim();
  return address && isIP(address) ? address : undefined;
}
