import { mkdir, cp, access, writeFile } from "node:fs/promises";
const root = new URL("../", import.meta.url);
for (const f of [
  "vendor/vision_bundle.mjs",
  "vendor/hand_landmarker.task",
  "vendor/wasm/vision_wasm_internal.wasm",
])
  await access(new URL(f, root));
await mkdir(new URL("dist/", root), { recursive: true });
for (const f of ["index.html", "style.css", "src", "vendor", "docs"])
  await cp(new URL(f, root), new URL("dist/" + f, root), { recursive: true });
await writeFile(new URL("dist/.nojekyll", root), "");
console.log("Construction terminée : dist/");
