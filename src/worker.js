import {blueMarkers} from "./marker.js";
import { HandLandmarker, FilesetResolver } from "../vendor/vision_bundle.mjs";
import { analyzeTracks } from "./analysis.js";
let detector, markerCanvas, markerContext;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === "init") {
      if (typeof OffscreenCanvas === "undefined") {
        throw Error("Le traitement nécessite OffscreenCanvas. Mettez iOS et Safari à jour, puis réessayez.");
      }
      // Supply the canvas explicitly: MediaPipe's Safari user-agent heuristic
      // can otherwise fall back to document.createElement inside this worker.
      const canvas = new OffscreenCanvas(1, 1);
      if (!canvas.getContext("webgl2")) {
        throw Error("Le traitement graphique local n’est pas disponible. Essayez Safari à jour ou un ordinateur.");
      }
      const files = await FilesetResolver.forVisionTasks(
        new URL("../vendor/wasm/", import.meta.url).href,
      );
      const options = {
        canvas,
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
      };
      detector = await HandLandmarker.createFromOptions(files, options);
      self.postMessage({ type: "ready", backend: options.baseOptions.delegate });
    } else if (data.type === "frame") {
      try {
        let markers=[];
        if(true){
          markerCanvas ||= new OffscreenCanvas(data.bitmap.width,data.bitmap.height);
          if(markerCanvas.width!==data.bitmap.width||markerCanvas.height!==data.bitmap.height){markerCanvas.width=data.bitmap.width;markerCanvas.height=data.bitmap.height;}
          markerContext ||= markerCanvas.getContext('2d',{willReadFrequently:true});
          markerContext.drawImage(data.bitmap,0,0);
          markers=blueMarkers(markerContext.getImageData(0,0,markerCanvas.width,markerCanvas.height));
        }
        const result = detector.detectForVideo(data.bitmap, data.time * 1000);
        self.postMessage({
          type: "frame",
          time: data.time,
          markers: markers.map(p=>({x:p.x/data.bitmap.width,y:p.y/data.bitmap.height,diameter:p.diameter/data.bitmap.width})),
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
