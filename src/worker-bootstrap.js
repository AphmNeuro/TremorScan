// MediaPipe's WASM loader uses importScripts: it requires a classic worker.
// Buffer messages until the ES module has installed its handler.
const pending = [];
self.onmessage = (event) => pending.push(event);
import("./worker.js")
  .then(() => {
    for (const event of pending) self.onmessage(event);
  })
  .catch((e) => self.postMessage({ type: "error", message: e.message }));
