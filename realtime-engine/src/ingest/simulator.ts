/**
 * Dev simulator: publishes fake positions to Redis so Socket.io clients receive updates.
 * Usage: npm run simulate:ingest
 */
import { loadConfig } from "../config/env";
import { createRedisClients } from "../config/redis";
import { PositionSnapshotStore } from "../state/snapshot-store";
import type { FlightPositionUpdate } from "../types/position";

async function main() {
  const config = loadConfig();
  const { publisher, commands } = createRedisClients(config);
  const snapshots = new PositionSnapshotStore(commands, config);

  const flightId =
    process.env.SIM_FLIGHT_ID ?? "11111111-1111-1111-1111-111111111111";

  let lat = 24.7136;
  let lon = 46.6753;
  let heading = 45;

  console.info(`[simulator] publishing to ${config.REDIS_POSITIONS_CHANNEL} for ${flightId}`);

  setInterval(async () => {
    heading = (heading + 2) % 360;
    const rad = (heading * Math.PI) / 180;
    lat += Math.cos(rad) * 0.01;
    lon += Math.sin(rad) * 0.01;

    const update: FlightPositionUpdate = {
      flightId,
      latitude: lat,
      longitude: lon,
      altitudeFt: 35000,
      groundSpeedKts: 470,
      headingDeg: heading,
      onGround: false,
      recordedAt: new Date().toISOString(),
      source: "simulator",
    };

    await snapshots.save(update);
    await publisher.publish(
      config.REDIS_POSITIONS_CHANNEL,
      JSON.stringify(update),
    );
    process.stdout.write(".");
  }, 2000);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
