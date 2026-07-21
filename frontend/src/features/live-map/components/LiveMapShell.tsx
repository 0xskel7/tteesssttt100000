"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FlightDetailPanel } from "@/features/flight-tracking/components/FlightDetailPanel";
import { DEMO_FLIGHTS } from "@/features/flight-tracking/demo-flights";
import type { LiveFlight } from "@/features/flight-tracking/types";
import { FeatureErrorBoundary } from "@/shared/ui-error-boundary";
import { colors, typography } from "@/shared/design-tokens";
import { loadMapView, saveMapView } from "../map-view-persistence";
import { FlightMap } from "./FlightMap";
import { advanceFlights } from "../simulate-flights";

interface Props {
  initialFlights?: LiveFlight[];

  initialSelectedId?: string | null;
}

export function LiveMapShell({
  initialFlights = DEMO_FLIGHTS,
  initialSelectedId = null,
}: Props) {
  const [flights, setFlights] = useState(() =>
    initialFlights.map((flight) => ({
      ...flight,
      path: flight.path.map((point) => ({ ...point })),
    })),
  );
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => flights.find((f) => f.id === selectedId) ?? null,
    [flights, selectedId],
  );
  const visibleFlights = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return flights;
    return flights.filter((flight) =>
      [
        flight.flightNumber,
        flight.callsign,
        flight.origin.code,
        flight.destination.code,
        flight.aircraft.airlineName,
      ].some((field) => field.toLowerCase().includes(value)),
    );
  }, [flights, query]);

  const onSelectFlight = useCallback((id: string | null) => {
    setSelectedId(id);

    const previous = loadMapView();
    if (previous) saveMapView(previous);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setFlights((current) => advanceFlights(current));
    }, 1_200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="map-shell">
      <FeatureErrorBoundary title="Map failed">
        <FlightMap
          flights={flights}
          selectedFlightId={selectedId}
          onSelectFlight={onSelectFlight}
        />
      </FeatureErrorBoundary>

      <BrandChrome query={query} onQueryChange={setQuery} />

      <nav className="flight-chips" aria-label="Available flights">
        {visibleFlights.map((flight) => (
          <motion.button
            key={flight.id}
            type="button"
            whileTap={{ scale: 0.97 }}
            className={`flight-chip${selectedId === flight.id ? " is-active" : ""}`}
            onClick={() => onSelectFlight(flight.id)}
          >
            <span className="flight-chip-number">{flight.flightNumber}</span>
            <span className="flight-chip-route">
              {flight.origin.code} → {flight.destination.code}
            </span>
          </motion.button>
        ))}
      </nav>

      <div className="map-controls" aria-label="Map controls">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => window.dispatchEvent(new Event("horizon:zoom-in"))}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => window.dispatchEvent(new Event("horizon:zoom-out"))}
        >
          −
        </button>
        <button
          type="button"
          aria-label="Reset map"
          onClick={() => window.dispatchEvent(new Event("horizon:home"))}
        >
          ◉
        </button>
      </div>

      <FeatureErrorBoundary title="Flight panel failed">
        <FlightDetailPanel flight={selected} onClose={() => onSelectFlight(null)} />
      </FeatureErrorBoundary>
    </main>
  );
}

function BrandChrome({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (value: string) => void;
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="map-header"
    >
      <div className="brand-lockup">
        <p
          style={{
            margin: 0,
            fontFamily: typography.fontDisplay,
            fontWeight: 700,
            color: colors.text.primary,
          }}
        >
          Horizon
        </p>
        <span>LIVE</span>
      </div>
      <label className="map-search">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
        </svg>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search flight, airport or airline"
          aria-label="Search flights"
        />
      </label>
    </motion.header>
  );
}
