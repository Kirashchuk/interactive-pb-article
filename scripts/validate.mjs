import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workerPath = resolve(root, "dist", "server", "index.js");
const hostingPath = resolve(root, "dist", ".openai", "hosting.json");

await Promise.all([
  access(resolve(root, "dist", "client", "index.html")),
  access(resolve(root, "dist", "client", "data", "pb_data.json")),
  access(resolve(root, "dist", "client", "data", "analytics.json")),
  access(resolve(root, "dist", "client", "data", "ukraine_oblasts.geojson")),
  access(resolve(root, "dist", "client", "data", "pb_map_city_metrics_2018_2021.csv")),
  access(resolve(root, "dist", "client", "assets", "maps", "first-pb-year.png")),
  access(resolve(root, "dist", "client", "assets", "maps", "prewar-resource-share.png")),
  access(resolve(root, "dist", "client", "assets", "maps", "resource-share-stability.png")),
  access(resolve(root, "dist", "client", "vendor", "d3.v7.min.js")),
  access(resolve(root, "dist", "client", "Стаття_Бюджети_участі_2015-2026.pdf")),
]);
const hosting = JSON.parse(await readFile(hostingPath, "utf8"));
assert.equal(hosting.project_id, "appgprj_6a66051c8ec881919651cb9567f30924");
const worker = await import(pathToFileURL(workerPath).href);
assert.equal(typeof worker.default?.fetch, "function");
console.log("Validated deployable worker and article assets");
