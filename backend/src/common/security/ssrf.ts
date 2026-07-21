import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Logger } from "@nestjs/common";

const DEFAULT_OPENSKY_HOSTS = new Set(["opensky-network.org", "www.opensky-network.org"]);

/**
 * SSRF guard for Tracking-Ingestion outbound HTTP.
 * Only allowlisted HTTPS hosts; reject private/link-local resolved IPs.
 */
export async function assertAllowedOutboundUrl(
  rawUrl: string,
  allowedHosts: Set<string> = DEFAULT_OPENSKY_HOSTS,
): Promise<URL> {
  const logger = new Logger("SsrfGuard");
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid outbound URL");
  }

  if (url.protocol !== "https:") {
    throw new Error("Outbound URL must use https");
  }
  if (url.username || url.password) {
    throw new Error("Outbound URL must not include credentials");
  }

  const host = url.hostname.toLowerCase();
  if (!allowedHosts.has(host)) {
    throw new Error(`Host not in SSRF allowlist: ${host}`);
  }

  // Block obvious local hostnames even if somehow allowlisted by misconfig
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Local hostnames are blocked");
  }

  const addresses = await resolveHostAddresses(host);
  for (const addr of addresses) {
    if (isPrivateOrReservedIp(addr)) {
      logger.warn(`SSRF blocked: ${host} resolved to private IP ${addr}`);
      throw new Error("Outbound host resolves to a private/reserved address");
    }
  }

  return url;
}

async function resolveHostAddresses(host: string): Promise<string[]> {
  if (isIP(host)) return [host];
  try {
    const records = await lookup(host, { all: true });
    return records.map((r) => r.address);
  } catch {
    throw new Error(`DNS lookup failed for ${host}`);
  }
}

export function isPrivateOrReservedIp(ip: string): boolean {
  if (ip.includes(":")) {
    // IPv6: unique local, link-local, loopback
    const v = ip.toLowerCase();
    return (
      v === "::1" ||
      v.startsWith("fc") ||
      v.startsWith("fd") ||
      v.startsWith("fe80")
    );
  }
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts as [number, number, number, number];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

/** Allowlist for backend → realtime-engine HTTP (no user-controlled host). */
export function assertAllowedInternalServiceUrl(
  rawUrl: string,
  allowedHosts: string[],
): URL {
  const url = new URL(rawUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Internal service URL protocol not allowed");
  }
  const host = url.hostname.toLowerCase();
  const ok = allowedHosts.some((h) => h.toLowerCase() === host);
  if (!ok) {
    throw new Error(`Realtime engine host not allowlisted: ${host}`);
  }
  return url;
}
