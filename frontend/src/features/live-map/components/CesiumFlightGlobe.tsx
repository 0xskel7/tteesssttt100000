"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveFlight } from "@/features/flight-tracking/types";
import { colors } from "@/shared/design-tokens";

interface Props {
  flights: LiveFlight[];
  selectedFlightId: string | null;
  onSelectFlight: (flightId: string | null) => void;
}

export function CesiumFlightGlobe({
  flights,
  selectedFlightId,
  onSelectFlight,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [modelMode, setModelMode] = useState<"3d" | "2d-fallback">("3d");

  const flightsRef = useRef(flights);
  const selectedRef = useRef(selectedFlightId);
  const onSelectRef = useRef(onSelectFlight);
  flightsRef.current = flights;
  selectedRef.current = selectedFlightId;
  onSelectRef.current = onSelectFlight;

  useEffect(() => {
    let viewer: import("cesium").Viewer | null = null;
    let cancelled = false;
    const entityIds = new Map<string, string>();

    async function boot() {
      if (!containerRef.current) return;

      try {

        (window as unknown as { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL =
          `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/cesium/`;

        const Cesium = await import("cesium");

        await import("cesium/Build/Cesium/Widgets/widgets.css");

        if (cancelled || !containerRef.current) return;

        if (process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN) {
          Cesium.Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
        }

        viewer = new Cesium.Viewer(containerRef.current, {
          animation: false,
          timeline: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          baseLayerPicker: false,
          navigationHelpButton: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
          creditContainer: document.createElement("div"),
          terrain: undefined,
        });

        viewer.scene.globe.enableLighting = true;
        viewer.scene.globe.atmosphereLightIntensity = 5.0;
        viewer.scene.backgroundColor = Cesium.Color.fromCssColorString(
          colors.map.atmosphere,
        );
        viewer.scene.fog.enabled = true;
        if (viewer.scene.skyAtmosphere) {
          viewer.scene.skyAtmosphere.hueShift = -0.05;
          viewer.scene.skyAtmosphere.saturationShift = -0.1;
        }

        try {
          viewer.imageryLayers.removeAll();
          viewer.imageryLayers.addImageryProvider(
            new Cesium.UrlTemplateImageryProvider({
              url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
              credit: "© OpenStreetMap",
              maximumLevel: 8,
            }),
          );
        } catch {

        }

        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(45, 25, 12_000_000),
        });

        const modelUrl =
          process.env.NEXT_PUBLIC_AIRCRAFT_MODEL_URL ??
          "/models/aircraft.glb";

        const modelOk = await probeModel(modelUrl);
        if (!modelOk) {
          setModelMode("2d-fallback");
        }

        const syncEntities = () => {
          if (!viewer) return;
          const list = flightsRef.current;
          const seen = new Set<string>();

          for (const flight of list) {
            seen.add(flight.id);
            const existingId = entityIds.get(flight.id);
            const selected = selectedRef.current === flight.id;
            const position = Cesium.Cartesian3.fromDegrees(
              flight.longitude,
              flight.latitude,
              feetToMeters(flight.altitudeFt),
            );
            const hpr = new Cesium.HeadingPitchRoll(
              Cesium.Math.toRadians(flight.headingDeg),
              0,
              0,
            );
            const orientation = Cesium.Transforms.headingPitchRollQuaternion(
              position,
              hpr,
            );

            if (existingId) {
              const entity = viewer.entities.getById(existingId);
              if (entity) {
                entity.position = new Cesium.ConstantPositionProperty(position);
                entity.orientation = new Cesium.ConstantProperty(orientation);
                updatePath(Cesium, viewer, flight, selected);
                continue;
              }
            }

            const entity = viewer.entities.add({
              id: `aircraft-${flight.id}`,
              name: flight.flightNumber,
              position,
              orientation,
              properties: {
                flightId: flight.id,
              },
              ...(modelOk
                ? {
                    model: {
                      uri: modelUrl,
                      minimumPixelSize: 48,
                      maximumScale: 20_000,
                      scale: 1.0,
                      color: selected
                        ? Cesium.Color.fromCssColorString(colors.flight.selected)
                        : Cesium.Color.WHITE,
                      colorBlendMode: Cesium.ColorBlendMode.HIGHLIGHT,
                      colorBlendAmount: selected ? 0.45 : 0.15,
                    },
                  }
                : {
                    billboard: {
                      image: createAircraftCanvas(flight.headingDeg, selected),
                      verticalOrigin: Cesium.VerticalOrigin.CENTER,
                      heightReference: Cesium.HeightReference.NONE,
                      disableDepthTestDistance: Number.POSITIVE_INFINITY,
                      scale: selected ? 1.15 : 1,
                    },
                  }),
              label: {
                text: flight.flightNumber,
                font: "600 12px IBM Plex Sans Arabic, sans-serif",
                fillColor: Cesium.Color.fromCssColorString(colors.text.primary),
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 3,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -28),
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                show: selected,
              },
            });

            if (modelOk && entity.model) {
              const err = (
                entity.model as unknown as {
                  errorEvent?: { addEventListener: (cb: () => void) => void };
                }
              ).errorEvent;
              err?.addEventListener(() => {
                setModelMode("2d-fallback");
                if (!viewer || !entity.isAvailable) return;
                entity.model = undefined;
                entity.billboard = new Cesium.BillboardGraphics({
                  image: createAircraftCanvas(flight.headingDeg, selected),
                  verticalOrigin: Cesium.VerticalOrigin.CENTER,
                  disableDepthTestDistance: Number.POSITIVE_INFINITY,
                });
              });
            }

            entityIds.set(flight.id, entity.id);
            updatePath(Cesium, viewer, flight, selected);
          }

          for (const [flightId, entId] of entityIds) {
            if (seen.has(flightId)) continue;
            viewer.entities.removeById(entId);
            viewer.entities.removeById(`path-${flightId}`);
            entityIds.delete(flightId);
          }
        };

        syncEntities();

        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction(
          (movement: { position: import("cesium").Cartesian2 }) => {
            if (!viewer) return;
            const picked = viewer.scene.pick(movement.position);
            const id = picked?.id?.properties?.flightId?.getValue?.(
              Cesium.JulianDate.now(),
            ) as string | undefined;
            if (!id) {
              onSelectRef.current(null);
              return;
            }
            onSelectRef.current(id);
            const flight = flightsRef.current.find((f) => f.id === id);
            if (flight) flyToFlight(Cesium, viewer, flight);
          },
          Cesium.ScreenSpaceEventType.LEFT_CLICK,
        );

        const interval = window.setInterval(syncEntities, 1500);

        const onExternalSelect = () => {
          const id = selectedRef.current;
          if (!id || !viewer) return;
          const flight = flightsRef.current.find((f) => f.id === id);
          if (flight) flyToFlight(Cesium, viewer, flight);
        };
        window.addEventListener("horizon:flyto", onExternalSelect);

        (viewer as unknown as { __horizonCleanup?: () => void }).__horizonCleanup =
          () => {
            window.clearInterval(interval);
            window.removeEventListener("horizon:flyto", onExternalSelect);
            handler.destroy();
          };
      } catch (err) {
        console.error(err);
        setBootError(err instanceof Error ? err.message : "Failed to start globe");
      }
    }

    void boot();

    return () => {
      cancelled = true;
      if (viewer) {
        const cleanup = (viewer as unknown as { __horizonCleanup?: () => void })
          .__horizonCleanup;
        cleanup?.();
        viewer.destroy();
      }
    };
  }, []);

  useEffect(() => {
    if (selectedFlightId) {
      window.dispatchEvent(new Event("horizon:flyto"));
    }
  }, [selectedFlightId]);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      {bootError ? (
        <div
          role="alert"
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background: colors.surface.void,
            color: colors.text.primary,
            padding: 24,
          }}
        >
          <div>
            <h2>Map failed to load</h2>
            <p>{bootError}</p>
          </div>
        </div>
      ) : null}
      <div
        style={{
          position: "absolute",
          left: 16,
          bottom: 16,
          zIndex: 5,
          fontSize: 11,
          color: colors.text.muted,
          background: colors.surface.panel,
          border: `1px solid ${colors.surface.line}`,
          borderRadius: 999,
          padding: "6px 12px",
        }}
      >
        Aircraft render: {modelMode === "3d" ? "3D glTF" : "2D fallback"}
      </div>
    </div>
  );
}

function feetToMeters(ft: number): number {
  return ft * 0.3048;
}

function flyToFlight(
  Cesium: typeof import("cesium"),
  viewer: import("cesium").Viewer,
  flight: LiveFlight,
): void {
  const dest = Cesium.Cartesian3.fromDegrees(
    flight.longitude,
    flight.latitude,
    feetToMeters(flight.altitudeFt) + 80_000,
  );
  viewer.camera.flyTo({
    destination: dest,
    orientation: {
      heading: Cesium.Math.toRadians(flight.headingDeg),
      pitch: Cesium.Math.toRadians(-35),
      roll: 0,
    },
    duration: 2.2,
  });
}

function updatePath(
  Cesium: typeof import("cesium"),
  viewer: import("cesium").Viewer,
  flight: LiveFlight,
  selected: boolean,
): void {
  const pathId = `path-${flight.id}`;
  const positions = flight.path.flatMap((p) => [
    p.lon,
    p.lat,
    feetToMeters(p.altFt),
  ]);

  const material = new Cesium.PolylineGlowMaterialProperty({
    glowPower: 0.2,
    color: Cesium.Color.fromCssColorString(
      selected ? colors.flight.path : colors.flight.pathDim,
    ),
  });

  const existing = viewer.entities.getById(pathId);
  if (existing) {
    existing.polyline = new Cesium.PolylineGraphics({
      positions: Cesium.Cartesian3.fromDegreesArrayHeights(positions),
      width: selected ? 4 : 2,
      material,
      clampToGround: false,
      arcType: Cesium.ArcType.GEODESIC,
    });
    return;
  }

  viewer.entities.add({
    id: pathId,
    polyline: {
      positions: Cesium.Cartesian3.fromDegreesArrayHeights(positions),
      width: selected ? 4 : 2,
      material,
      clampToGround: false,
      arcType: Cesium.ArcType.GEODESIC,
    },
  });
}

async function probeModel(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (res.ok) return true;

    const get = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" } });
    return get.ok || get.status === 206;
  } catch {
    return false;
  }
}

function createAircraftCanvas(headingDeg: number, selected: boolean): string {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.translate(size / 2, size / 2);
  ctx.rotate((headingDeg * Math.PI) / 180);
  ctx.fillStyle = selected ? colors.flight.selected : colors.brand.primary;
  ctx.strokeStyle = "#041018";
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(5, 4);
  ctx.lineTo(14, 8);
  ctx.lineTo(14, 11);
  ctx.lineTo(5, 9);
  ctx.lineTo(3, 18);
  ctx.lineTo(7, 21);
  ctx.lineTo(-7, 21);
  ctx.lineTo(-3, 18);
  ctx.lineTo(-5, 9);
  ctx.lineTo(-14, 11);
  ctx.lineTo(-14, 8);
  ctx.lineTo(-5, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  return canvas.toDataURL();
}
