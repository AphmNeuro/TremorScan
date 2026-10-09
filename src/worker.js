import { HandLandmarker, FilesetResolver } from "../vendor/vision_bundle.mjs";
import { analyzeTracks } from "./analysis.js";
let detector;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === "init") {
      const files = await FilesetResolver.forVisionTasks(
        new URL("../vendor/wasm/", import.meta.url).href,
      );
      detector = await HandLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: new URL(
            "../vendor/hand_landmarker.task",
            import.meta.url,
          ).href,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
      self.postMessage({ type: "ready" });
    } else if (data.type === "frame") {
      try {
        const result = detector.detectForVideo(data.bitmap, data.time * 1000);
        self.postMessage({
          type: "frame",
          time: data.time,
          hands: result.landmarks,
        });
      } finally {
        data.bitmap.close();
      }
    } else if (data.type === "analyze") {
      self.postMessage({
        type: "results",
        results: analyzeTracks(
          data.tracks,
          data.width,
          data.height,
          data.band,
          data.count,
        ),
      });
    } else if (data.type === "close") {
      detector?.close();
      self.close();
    }
  } catch (e) {
    self.postMessage({ type: "error", message: e.message || String(e) });
  }
};
