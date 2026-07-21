"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FlightDetailPanel } from "@/features/flight-tracking/components/FlightDetailPanel";
import { DEMO_FLIGHTS } from "@/features/flight-tracking/demo-flights";
import type { LiveFlight } from "@/features/flight-tracking/types";
import { FeatureErrorBoundary } from "@/shared/ui-error-boundary";
import { colors, space, typography } from "@/shared/design-tokens";
import { loadMapView, saveMapView } from "../map-view-persistence";

const CesiumFlightGlobe = dynamic(
  () =>
    import("./CesiumFlightGlobe").then((m) => m.CesiumFlightGlobe),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          background: colors.surface.void,
          color: colors.text.secondary,
          fontFamily: typography.fontBody,
        }}
      >
        Loading globe…
      </div>
    ),
  },
);

interface Props {
  initialFlights?: LiveFlight[];
  /** Optional deep-link selection from /track/[flightId] */
  initialSelectedId?: string | null;
}

export function LiveMapShell({
  initialFlights = DEMO_FLIGHTS,
  initialSelectedId = null,
}: Props) {
  const [flights] = useState(initialFlights);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);

  const selected = useMemo(
    () => flights.find((f) => f.id === selectedId) ?? null,
    [flights, selectedId],
  );

  const onSelectFlight = useCallback((id: string | null) => {
    setSelectedId(id);
    // Preserve last camera intent for reconnect flows
    const previous = loadMapView();
    if (previous) saveMapView(previous);
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100dvh", overflow: "hidden" }}>
      <FeatureErrorBoundary title="Map failed">
        <CesiumFlightGlobe
          flights={flights}
          selectedFlightId={selectedId}
          onSelectFlight={onSelectFlight}
        />
      </FeatureErrorBoundary>

      <BrandChrome />

      <FeatureErrorBoundary title="Flight panel failed">
        <FlightDetailPanel flight={selected} onClose={() => onSelectFlight(null)} />
      </FeatureErrorBoundary>
    </div>
  );
}

function BrandChrome() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      style={{
        position: "absolute",
        top: space.lg,
        left: space.lg,
        zIndex: 30,
        pointerEvents: "none",
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: typography.fontDisplay,
          fontSize: "clamp(2rem, 4vw, 2.75rem)",
          fontWeight: 700,
          letterSpacing: "-0.04em",
          color: colors.text.primary,
          textShadow: "0 8px 32px rgba(0,0,0,0.55)",
        }}
      >
        Horizon
      </p>
      <p
        style={{
          marginTop: 4,
          color: colors.text.secondary,
          fontFamily: typography.fontBody,
          fontSize: typography.size.sm,
          maxWidth: "28ch",
        }}
      >
        Live flights on a true 3D globe — altitude, bearing, and path.
      </p>
    </motion.header>
  );
}
