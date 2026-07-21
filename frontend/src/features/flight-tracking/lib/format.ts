import type { LiveFlight } from "../types";

export function formatAltitude(ft: number): string {
  return `${Math.round(ft).toLocaleString()} ft`;
}

export function formatSpeed(kts: number): string {
  return `${Math.round(kts)} kts`;
}

export function formatEtaRemaining(etaIso: string, now = Date.now()): string {
  const ms = new Date(etaIso).getTime() - now;
  if (Number.isNaN(ms)) return "—";
  if (ms <= 0) return "Arriving";
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function routeLabel(flight: LiveFlight): string {
  return `${flight.origin.code} → ${flight.destination.code}`;
}
