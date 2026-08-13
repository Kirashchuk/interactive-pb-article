import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = resolve(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, "server"), { recursive: true });
await mkdir(resolve(dist, "client"), { recursive: true });
await mkdir(resolve(dist, ".openai"), { recursive: true });

for (const entry of ["index.html", "css", "data", "js", "vendor", "assets", "Стаття_Бюджети_участі_2015-2026.pdf"]) {
  await cp(resolve(root, entry), resolve(dist, "client", entry), { recursive: true });
}

await cp(resolve(root, "worker", "index.js"), resolve(dist, "server", "index.js"));
await cp(resolve(root, ".openai", "hosting.json"), resolve(dist, ".openai", "hosting.json"));

const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
await writeFile(resolve(dist, "package.json"), `${JSON.stringify({ private: true, type: packageJson.type }, null, 2)}\n`);
console.log("Built deployable static article in dist/");
