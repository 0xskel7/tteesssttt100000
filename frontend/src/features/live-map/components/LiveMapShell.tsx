"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FlightDetailPanel } from "@/features/flight-tracking/components/FlightDetailPanel";
import { DEMO_FLIGHTS } from "@/features/flight-tracking/demo-flights";
import type { LiveFlight } from "@/features/flight-tracking/types";
import { FeatureErrorBoundary } from "@/shared/ui-error-boundary";
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

      <SearchBar
        query={query}
        onQueryChange={setQuery}
        results={visibleFlights}
        total={flights.length}
        onSelect={(id) => {
          onSelectFlight(id);
          setQuery("");
        }}
      />

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

function SearchBar({
  query,
  onQueryChange,
  results,
  total,
  onSelect,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  results: LiveFlight[];
  total: number;
  onSelect: (id: string) => void;
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="map-header"
    >
      <label className="map-search">
        <span className="map-search-plane">✈</span>
        <svg className="map-search-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
        </svg>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search flights and airports"
          aria-label="Search flights"
        />
        <span className="flight-count">{total} flights</span>
      </label>
      {query.trim() ? (
        <div className="search-results">
          {results.slice(0, 7).map((flight) => (
            <button
              type="button"
              key={flight.id}
              onClick={() => onSelect(flight.id)}
            >
              <span className="search-result-plane">✈</span>
              <span>
                <b>{flight.flightNumber}</b>
                <small>
                  {flight.origin.city} → {flight.destination.city}
                </small>
              </span>
              <em>{flight.aircraft.airlineName}</em>
            </button>
          ))}
          {results.length === 0 ? <p>No matching flights</p> : null}
        </div>
      ) : null}
    </motion.header>
  );
}
