"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveFlight } from "@/features/flight-tracking/types";

type LeafletModule = typeof import("leaflet");
type FlightMarker = import("leaflet").Marker;
type FlightPath = import("leaflet").Polyline;

interface Props {
  flights: LiveFlight[];
  selectedFlightId: string | null;
  onSelectFlight: (flightId: string | null) => void;
}

export function FlightMap({
  flights,
  selectedFlightId,
  onSelectFlight,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const markersRef = useRef(new Map<string, FlightMarker>());
  const pathsRef = useRef(new Map<string, FlightPath>());
  const flightsRef = useRef(flights);
  const selectedRef = useRef(selectedFlightId);
  const onSelectRef = useRef(onSelectFlight);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  flightsRef.current = flights;
  selectedRef.current = selectedFlightId;
  onSelectRef.current = onSelectFlight;

  useEffect(() => {
    let disposed = false;

    async function start() {
      if (!containerRef.current) return;
      try {
        const L = await import("leaflet");
        if (disposed || !containerRef.current) return;

        leafletRef.current = L;
        const map = L.map(containerRef.current, {
          zoomControl: false,
          attributionControl: true,
          preferCanvas: false,
          zoomAnimation: true,
          markerZoomAnimation: true,
          minZoom: 2,
          maxZoom: 19,
          worldCopyJump: true,
        });
        mapRef.current = map;

        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
          {
            subdomains: "abcd",
            maxZoom: 20,
            attribution: "© OpenStreetMap © CARTO",
          },
        ).addTo(map);

        map.fitBounds(
          [
            [10, 19],
            [43, 61],
          ],
          { animate: false, padding: [20, 20] },
        );

        addCities(L, map, flightsRef.current);

        const onZoomIn = () => map.zoomIn();
        const onZoomOut = () => map.zoomOut();
        const onHome = () =>
          map.flyToBounds(
            [
              [10, 19],
              [43, 61],
            ],
            { padding: [20, 20], duration: 1.1 },
          );
        const onFlyTo = () => {
          const flight = flightsRef.current.find(
            (item) => item.id === selectedRef.current,
          );
          if (flight) focusFlight(L, map, flight);
        };
        const onResize = () => map.invalidateSize(false);

        window.addEventListener("horizon:zoom-in", onZoomIn);
        window.addEventListener("horizon:zoom-out", onZoomOut);
        window.addEventListener("horizon:home", onHome);
        window.addEventListener("horizon:flyto", onFlyTo);
        window.addEventListener("resize", onResize);

        (
          map as import("leaflet").Map & { __cleanup?: () => void }
        ).__cleanup = () => {
          window.removeEventListener("horizon:zoom-in", onZoomIn);
          window.removeEventListener("horizon:zoom-out", onZoomOut);
          window.removeEventListener("horizon:home", onHome);
          window.removeEventListener("horizon:flyto", onFlyTo);
          window.removeEventListener("resize", onResize);
        };

        setReady(true);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Map unavailable");
      }
    }

    void start();

    return () => {
      disposed = true;
      const map = mapRef.current as
        | (import("leaflet").Map & { __cleanup?: () => void })
        | null;
      map?.__cleanup?.();
      map?.remove();
      mapRef.current = null;
      markersRef.current.clear();
      pathsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current || !leafletRef.current) return;
    const L = leafletRef.current;
    const map = mapRef.current;
    const active = new Set<string>();

    for (const flight of flights) {
      active.add(flight.id);
      const selected = flight.id === selectedFlightId;
      const position: [number, number] = [
        flight.latitude,
        flight.longitude,
      ];
      let marker = markersRef.current.get(flight.id);

      if (!marker) {
        marker = L.marker(position, {
          icon: airplaneIcon(L, flight, selected),
          keyboard: true,
          riseOnHover: true,
          zIndexOffset: selected ? 1000 : 100,
        })
          .addTo(map)
          .on("click", () => onSelectRef.current(flight.id));
        markersRef.current.set(flight.id, marker);
      } else {
        marker.setLatLng(position);
        marker.setIcon(airplaneIcon(L, flight, selected));
        marker.setZIndexOffset(selected ? 1000 : 100);
      }

      const coordinates = flight.path.map(
        (point) => [point.lat, point.lon] as [number, number],
      );
      let path = pathsRef.current.get(flight.id);
      if (!path) {
        path = L.polyline(coordinates, {
          color: selected ? "#00aeea" : "#39b7d3",
          weight: selected ? 4 : 2,
          opacity: selected ? 0.9 : 0.42,
          dashArray: selected ? "10 10" : "5 10",
          lineCap: "round",
          className: "flight-route",
        }).addTo(map);
        pathsRef.current.set(flight.id, path);
      } else {
        path.setLatLngs(coordinates);
        path.setStyle({
          color: selected ? "#00aeea" : "#39b7d3",
          weight: selected ? 4 : 2,
          opacity: selected ? 0.9 : 0.42,
          dashArray: selected ? "10 10" : "5 10",
        });
      }
    }

    for (const [id, marker] of markersRef.current) {
      if (active.has(id)) continue;
      marker.remove();
      markersRef.current.delete(id);
      pathsRef.current.get(id)?.remove();
      pathsRef.current.delete(id);
    }
  }, [flights, ready, selectedFlightId]);

  useEffect(() => {
    if (!selectedFlightId || !ready) return;
    window.dispatchEvent(new Event("horizon:flyto"));
  }, [ready, selectedFlightId]);

  return (
    <div className="map-stage">
      <div ref={containerRef} className="leaflet-map" />
      {!ready && !error ? <div className="map-loading">Loading map…</div> : null}
      {error ? <div className="map-loading">{error}</div> : null}
      <div className="render-badge">
        <span />
        Live traffic
      </div>
    </div>
  );
}

function addCities(
  L: LeafletModule,
  map: import("leaflet").Map,
  flights: LiveFlight[],
): void {
  const airports = new Map(
    flights
      .flatMap((flight) => [flight.origin, flight.destination])
      .map((airport) => [airport.code, airport]),
  );

  for (const airport of airports.values()) {
    L.marker([airport.latitude, airport.longitude], {
      interactive: false,
      keyboard: false,
      icon: L.divIcon({
        className: "city-marker",
        iconSize: [130, 36],
        iconAnchor: [8, 18],
        html: `<span class="city-dot"></span><span class="city-copy"><b>${escapeHtml(
          airport.city,
        )}</b><small>${escapeHtml(airport.code)}</small></span>`,
      }),
    }).addTo(map);
  }
}

function airplaneIcon(
  L: LeafletModule,
  flight: LiveFlight,
  selected: boolean,
): import("leaflet").DivIcon {
  return L.divIcon({
    className: `aircraft-marker${selected ? " is-active" : ""}`,
    iconSize: [56, 58],
    iconAnchor: [28, 29],
    html: `<div class="aircraft-marker-inner" style="--bearing:${flight.headingDeg}deg">
      <span class="aircraft-pulse"></span>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M32 4c-2.1 0-3.8 2.2-4 5l-1 15-17 9v5l17-4 1 15-6 5v4l10-3 10 3v-4l-6-5 1-15 17 4v-5l-17-9-1-15c-.2-2.8-1.9-5-4-5Z"/>
      </svg>
      <b>${escapeHtml(flight.flightNumber)}</b>
    </div>`,
  });
}

function focusFlight(
  L: LeafletModule,
  map: import("leaflet").Map,
  flight: LiveFlight,
): void {
  const bounds = L.latLngBounds([
    [flight.latitude, flight.longitude],
    [flight.origin.latitude, flight.origin.longitude],
    [flight.destination.latitude, flight.destination.longitude],
  ]);
  const compact =
    Math.abs(flight.destination.longitude - flight.origin.longitude) <= 12 &&
    Math.abs(flight.destination.latitude - flight.origin.latitude) <= 9;
  const mobile = map.getContainer().clientWidth <= 720;

  if (compact) {
    map.flyToBounds(bounds.pad(0.2), {
      maxZoom: 7,
      paddingTopLeft: [20, 110],
      paddingBottomRight: mobile ? [20, 390] : [410, 30],
      duration: 1.1,
    });
    return;
  }

  map.flyTo([flight.latitude, flight.longitude], mobile ? 4 : 6, {
    duration: 1.1,
  });
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}
