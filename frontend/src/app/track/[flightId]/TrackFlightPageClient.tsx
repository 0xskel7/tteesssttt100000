"use client";

import { useMemo } from "react";
import Link from "next/link";
import { LiveMapShell } from "@/features/live-map";
import { DEMO_FLIGHTS } from "@/features/flight-tracking";
import { colors, space, typography } from "@/shared/design-tokens";

export default function TrackFlightPageClient({ flightId }: { flightId: string }) {
  const flight = useMemo(
    () => DEMO_FLIGHTS.find((f) => f.id === flightId) ?? null,
    [flightId],
  );

  if (!flight) {
    return (
      <main
        style={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: colors.surface.void,
          color: colors.text.primary,
          fontFamily: typography.fontBody,
          padding: space.lg,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontFamily: typography.fontDisplay }}>Flight not found</h1>
          <Link href="/" style={{ color: colors.brand.primary }}>
            Back to map
          </Link>
        </div>
      </main>
    );
  }

  return <LiveMapShell initialSelectedId={flight.id} />;
}
