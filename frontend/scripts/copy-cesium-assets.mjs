import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules/cesium/Build/Cesium");
const target = join(root, "public/cesium");

if (!existsSync(source)) {
  console.warn("[copy-cesium] Cesium build not found — run npm install first");
  process.exit(0);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(dirname(target), { recursive: true });
cpSync(source, target, { recursive: true });
console.info("[copy-cesium] copied Cesium assets → public/cesium");
