/**
 * Horizon Design Tokens — single source of truth for color, type, space, motion.
 * Import TS tokens in components; CSS variables power global styles.
 */

export const colors = {
  brand: {
    primary: "#3EE0C5",
    primaryMuted: "#1FA891",
    ink: "#07131F",
    fog: "#E8F1F6",
  },
  surface: {
    void: "#050B12",
    deep: "#0A1624",
    panel: "rgba(8, 18, 32, 0.88)",
    panelSolid: "#0D1B2A",
    elev: "#132337",
    line: "rgba(180, 210, 230, 0.14)",
  },
  text: {
    primary: "#F3F8FC",
    secondary: "#9BB4C7",
    muted: "#6E879B",
    inverse: "#07131F",
  },
  flight: {
    path: "#5CE1FF",
    pathDim: "rgba(92, 225, 255, 0.35)",
    selected: "#FFC857",
    altitude: "#7CFFB2",
    alert: "#FF6B6B",
  },
  map: {
    atmosphere: "#0B1C2C",
  },
} as const;

export const typography = {
  fontDisplay: '"Syne", "IBM Plex Sans Arabic", system-ui, sans-serif',
  fontBody: '"IBM Plex Sans Arabic", "Manrope", system-ui, sans-serif',
  fontMono: '"IBM Plex Mono", ui-monospace, monospace',
  size: {
    xs: "0.75rem",
    sm: "0.875rem",
    md: "1rem",
    lg: "1.125rem",
    xl: "1.35rem",
    display: "clamp(1.75rem, 3vw, 2.4rem)",
  },
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;

export const space = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "1rem",
  lg: "1.5rem",
  xl: "2rem",
  "2xl": "3rem",
  panelWidth: "380px",
} as const;

export const radii = {
  sm: "8px",
  md: "14px",
  lg: "20px",
  pill: "999px",
} as const;

export const motion = {
  fast: 0.18,
  base: 0.32,
  slow: 0.55,
  spring: { type: "spring" as const, stiffness: 320, damping: 32 },
} as const;

export const zIndex = {
  map: 0,
  overlay: 10,
  panel: 20,
  brand: 30,
  toast: 40,
} as const;

export const tokens = {
  colors,
  typography,
  space,
  radii,
  motion,
  zIndex,
} as const;

export type DesignTokens = typeof tokens;
