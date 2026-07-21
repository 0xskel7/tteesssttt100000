"use client";

/**
 * Error Boundary for the main map route only.
 * Failure here must not affect /track/[flightId] or auth routes.
 */
export default function MapError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#050B12",
        color: "#F3F8FC",
        fontFamily: '"IBM Plex Sans Arabic", system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <p style={{ color: "#3EE0C5", fontWeight: 700, letterSpacing: "0.06em" }}>HORIZON</p>
        <h1 style={{ fontFamily: "Syne, sans-serif" }}>Map unavailable</h1>
        <p style={{ color: "#9BB4C7" }}>{error.message}</p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 16,
            border: "none",
            borderRadius: 999,
            padding: "12px 20px",
            background: "#3EE0C5",
            color: "#07131F",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Retry map
        </button>
      </div>
    </main>
  );
}
