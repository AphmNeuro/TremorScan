import { mkdir, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
const base = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/";
const assets = [
  ["vendor/vision_bundle.mjs", base + "vision_bundle.mjs"],
  ...[
    "vision_wasm_internal.js",
    "vision_wasm_internal.wasm",
    "vision_wasm_nosimd_internal.js",
    "vision_wasm_nosimd_internal.wasm",
  ].map((f) => ["vendor/wasm/" + f, base + "wasm/" + f]),
  [
    "vendor/hand_landmarker.task",
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
  ],
  ["vendor/MEDIAPIPE_README.md", base + "README.md"],
  [
    "vendor/APACHE-LICENSE.txt",
    "https://raw.githubusercontent.com/google-ai-edge/mediapipe/master/LICENSE",
  ],
];
if (process.argv.includes("--reference"))
  assets.push([
    "tests/assets/woman_hands.jpg",
    "https://storage.googleapis.com/mediapipe-tasks/hand_landmarker/woman_hands.jpg",
  ]);
for (const [name, url] of assets) {
  const target = new URL(name, root);
  try {
    await access(target);
    continue;
  } catch {}
  await mkdir(new URL("./", target), { recursive: true });
  const r = await fetch(url);
  if (!r.ok) throw Error(`${r.status}: ${url}`);
  await writeFile(target, new Uint8Array(await r.arrayBuffer()));
  console.log(name);
}
console.log(
  "Ressources locales prêtes. MediaPipe 0.10.21 / modèle float16 v1.",
);
