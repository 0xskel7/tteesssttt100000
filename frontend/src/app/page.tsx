"use client";

import { LiveMapShell } from "@/features/live-map";

/**
 * Main map page — globe is the full-bleed visual plane.
 * Isolated from /track/[id] via its own error.tsx boundary.
 */
export default function HomePage() {
  return <LiveMapShell />;
}
