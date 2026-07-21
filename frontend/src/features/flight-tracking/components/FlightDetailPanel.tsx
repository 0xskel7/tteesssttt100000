"use client";

import type { CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { colors, motion as motionTokens, radii, space, typography } from "@/shared/design-tokens";
import { safeDisplayText } from "@/shared/lib/safe-text";
import type { LiveFlight } from "../types";
import { formatAltitude, formatEtaRemaining, formatSpeed, routeLabel } from "../lib/format";

interface Props {
  flight: LiveFlight | null;
  onClose: () => void;
}

export function FlightDetailPanel({ flight, onClose }: Props) {
  return (
    <AnimatePresence>
      {flight ? (
        <motion.aside
          key={flight.id}
          initial={{ x: 28, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 36, opacity: 0 }}
          transition={motionTokens.spring}
          aria-label={`Flight ${flight.flightNumber} details`}
          className="flight-panel"
          style={panelStyle}
        >
          <div style={headerStyle}>
            <div>
              <p style={eyebrowStyle}>{safeDisplayText(flight.aircraft.airlineName, 60)}</p>
              <h2 style={titleStyle}>{safeDisplayText(flight.flightNumber, 16)}</h2>
              <p style={routeStyle}>{routeLabel(flight)}</p>
            </div>
            <button type="button" onClick={onClose} style={closeStyle} aria-label="Close panel">
              ✕
            </button>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: motionTokens.base }}
            className="flight-panel-route"
            style={routeBlockStyle}
          >
            <AirportBlock code={flight.origin.code} city={flight.origin.city} label="From" />
            <div style={routeDash} />
            <AirportBlock
              code={flight.destination.code}
              city={flight.destination.city}
              label="To"
            />
          </motion.div>

          <dl className="flight-panel-stats" style={statsGrid}>
            <Stat label="Altitude" value={formatAltitude(flight.altitudeFt)} accent={colors.flight.altitude} />
            <Stat label="Speed" value={formatSpeed(flight.groundSpeedKts)} />
            <Stat label="Heading" value={`${Math.round(flight.headingDeg)}°`} />
            <Stat label="ETA" value={formatEtaRemaining(flight.etaIso)} accent={colors.flight.selected} />
          </dl>

          <div style={paxBox}>
            <p style={eyebrowStyle}>Passenger estimate</p>
            <p style={{ fontSize: typography.size.xl, fontWeight: 700, margin: `${space.xs} 0` }}>
              ~{flight.passengerEstimate.estimatedPassengers.toLocaleString()}
              <span style={{ color: colors.text.muted, fontSize: typography.size.sm, fontWeight: 500 }}>
                {" "}
                / {flight.passengerEstimate.maxCapacity}
              </span>
            </p>
            <p style={{ color: colors.text.muted, fontSize: typography.size.xs, lineHeight: 1.45 }}>
              {flight.passengerEstimate.note}
            </p>
          </div>

          <div style={metaRow}>
            <span>{safeDisplayText(flight.aircraft.typeName, 60)}</span>
            <span style={{ fontFamily: typography.fontMono }}>
              {safeDisplayText(flight.aircraft.registration, 16)}
            </span>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

function AirportBlock({
  code,
  city,
  label,
}: {
  code: string;
  city: string;
  label: string;
}) {
  return (
    <div>
      <p style={eyebrowStyle}>{label}</p>
      <p style={{ fontFamily: typography.fontDisplay, fontSize: typography.size.xl, fontWeight: 700 }}>
        {safeDisplayText(code, 8)}
      </p>
      <p style={{ color: colors.text.secondary, fontSize: typography.size.sm }}>
        {safeDisplayText(city, 40)}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div style={statCell}>
      <dt style={eyebrowStyle}>{label}</dt>
      <dd
        style={{
          margin: 0,
          fontFamily: typography.fontMono,
          fontWeight: 600,
          color: accent ?? colors.text.primary,
        }}
      >
        {value}
      </dd>
    </div>
  );
}

const panelStyle: CSSProperties = {
  zIndex: 20,
  display: "flex",
  flexDirection: "column",
  gap: space.md,
  padding: space.lg,
  borderRadius: radii.lg,
  background: colors.surface.panel,
  border: `1px solid ${colors.surface.line}`,
  backdropFilter: "blur(18px)",
  color: colors.text.primary,
  fontFamily: typography.fontBody,
  boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
  overflow: "auto",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: space.md,
};

const titleStyle: CSSProperties = {
  fontFamily: typography.fontDisplay,
  fontSize: typography.size.display,
  margin: 0,
  letterSpacing: "-0.03em",
};

const routeStyle: CSSProperties = {
  color: colors.brand.primary,
  fontWeight: 600,
  marginTop: space.xs,
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  fontSize: typography.size.xs,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: colors.text.muted,
};

const closeStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: radii.pill,
  border: `1px solid ${colors.surface.line}`,
  background: colors.surface.elev,
  color: colors.text.primary,
  cursor: "pointer",
};

const routeBlockStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  alignItems: "center",
  gap: space.sm,
  padding: space.md,
  borderRadius: radii.md,
  background: colors.surface.elev,
};

const routeDash: CSSProperties = {
  height: 2,
  width: 36,
  background: `linear-gradient(90deg, ${colors.flight.pathDim}, ${colors.flight.path})`,
  borderRadius: radii.pill,
};

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: space.sm,
  margin: 0,
};

const statCell: CSSProperties = {
  padding: space.md,
  borderRadius: radii.md,
  background: colors.surface.elev,
  border: `1px solid ${colors.surface.line}`,
};

const paxBox: CSSProperties = {
  padding: space.md,
  borderRadius: radii.md,
  border: `1px dashed ${colors.surface.line}`,
  background: "rgba(62, 224, 197, 0.06)",
};

const metaRow: CSSProperties = {
  marginTop: "auto",
  display: "flex",
  justifyContent: "space-between",
  gap: space.sm,
  color: colors.text.secondary,
  fontSize: typography.size.sm,
};
