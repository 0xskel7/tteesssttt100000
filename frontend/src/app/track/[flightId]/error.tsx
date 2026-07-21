"use client";

export default function TrackFlightError({
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
        <p style={{ color: "#3EE0C5", fontWeight: 700 }}>HORIZON</p>
        <h1 style={{ fontFamily: "Syne, sans-serif" }}>Flight view failed</h1>
        <p style={{ color: "#9BB4C7" }}>{error.message}</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 16 }}>
          <button
            type="button"
            onClick={reset}
            style={{
              border: "none",
              borderRadius: 999,
              padding: "12px 20px",
              background: "#3EE0C5",
              color: "#07131F",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Retry flight
          </button>
          <a
            href="/"
            style={{
              borderRadius: 999,
              padding: "12px 20px",
              border: "1px solid rgba(180,210,230,0.14)",
              color: "#F3F8FC",
              textDecoration: "none",
            }}
          >
            Open map
          </a>
        </div>
      </div>
    </main>
  );
}
