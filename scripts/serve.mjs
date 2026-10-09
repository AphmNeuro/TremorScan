import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const port = Number(process.env.PORT || 4180);
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".task": "application/octet-stream",
};
http
  .createServer(async (req, res) => {
    try {
      let p = path.resolve(
        root,
        "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
      );
      if (p !== root && !p.startsWith(root + path.sep)) throw Error();
      if ((await stat(p)).isDirectory()) p = path.join(p, "index.html");
      const data = await readFile(p);
      res.writeHead(200, {
        "Content-Type": types[path.extname(p)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(port, "127.0.0.1", () => console.log(`http://127.0.0.1:${port}`));
