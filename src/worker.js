import { HandLandmarker, FaceLandmarker, FilesetResolver } from "../vendor/vision_bundle.mjs";
import { analyzeTracks, analyzeFaceTracks } from "./analysis.js";
import { compactFace } from "./face.js";
let detector, mode = 'hand';
self.onmessage = async ({ data }) => {
  try {
    if (data.type === "init") {
      mode = data.mode === 'face' ? 'face' : 'hand';
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
            mode === 'face' ? "../vendor/face_landmarker.task" : "../vendor/hand_landmarker.task",
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
      if(mode==='face'){
        delete options.numHands; delete options.minHandDetectionConfidence; delete options.minHandPresenceConfidence;
        // numFaces=2 disables MediaPipe's single-face temporal smoothing.
        // Multi-face frames are rejected downstream, not analysed together.
        Object.assign(options,{numFaces:2,minFaceDetectionConfidence:0.6,minFacePresenceConfidence:0.6,outputFaceBlendshapes:false,outputFacialTransformationMatrixes:false});
      }
      detector = await (mode==='face'?FaceLandmarker:HandLandmarker).createFromOptions(files, options);
      self.postMessage({ type: "ready", backend: options.baseOptions.delegate });
    } else if (data.type === "frame") {
      try {
        const result = detector.detectForVideo(data.bitmap, data.time * 1000);
        self.postMessage({
          type: "frame",
          time: data.time,
          hands: mode==='face'?result.faceLandmarks.map(compactFace):result.landmarks,
        });
      } finally {
        data.bitmap.close();
      }
    } else if (data.type === "analyze") {
      self.postMessage({
        type: "results",
        results: (data.mode==='face'?analyzeFaceTracks:analyzeTracks)(
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
