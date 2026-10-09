import { HandTracker } from "./tracking.js";
import { PlaybackPacer, needsSlowerPass } from "./pacing.js";
export class VideoSession {
  constructor(video, canvas, onProgress) {
    this.video = video;
    this.canvas = canvas;
    this.onProgress = onProgress;
    this.url = null;
    this.worker = null;
    this.cancelled = false;
  }
  async load(file) {
    this.dispose();
    if (file.size > 600 * 1024 * 1024)
      throw Error(
        "Cette vidéo dépasse 600 Mo. Choisissez un extrait plus court.",
      );
    this.url = URL.createObjectURL(file);
    const v = this.video;
    v.src = this.url;
    v.muted = true;
    v.playsInline = true;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () =>
          finish(
            Error(
              "Impossible de lire cette vidéo. Essayez un MP4 H.264 (« Le plus compatible » sur iPhone).",
            ),
          ),
        12000,
      );
      const done = () => finish();
      const fail = () =>
        finish(
          Error(
            "Codec vidéo non pris en charge par ce navigateur. Essayez un MP4 H.264.",
          ),
        );
      const finish = (e) => {
        clearTimeout(timer);
        this.abort = null;
        v.removeEventListener("loadedmetadata", done);
        v.removeEventListener("error", fail);
        e ? reject(e) : resolve();
      };
      this.abort = () => finish(Error("Ouverture annulée."));
      v.addEventListener("loadedmetadata", done, { once: true });
      v.addEventListener("error", fail, { once: true });
      v.load();
    });
    if (!v.videoWidth || !Number.isFinite(v.duration) || v.duration < 6)
      throw Error("Une vidéo lisible d’au moins 6 secondes est nécessaire.");
    return { width: v.videoWidth, height: v.videoHeight, duration: v.duration };
  }
  async analyze(band) {
    this.video.pause();
    if (this.cached) return this.reanalyze(band);
    const started = performance.now();
    let result = await this.runPass(band, true);
    const firstPass = {...result.meta, times: undefined};
    if (needsSlowerPass(result.meta)) {
      if (this.cancelled) throw Error("Analyse annulée.");
      this.cached = null;
      this.onProgress({phase: "retry", progress: 0, count: 0});
      result = await this.runPass(band, false);
      result.meta.retried = true;
      result.meta.firstPass = firstPass;
    }
    result.meta.elapsedSeconds = (performance.now() - started) / 1000;
    result.meta.samplingWarning = needsSlowerPass(result.meta);
    this.cached = result;
    return result;
  }
  async runPass(band, adaptive) {
    const v = this.video;
    // Stop a user-started preview while the detector loads.
    v.pause();
    if (this.cached) return this.reanalyze(band);
    const started = performance.now();
    if (!v.requestVideoFrameCallback)
      throw Error(
        "Ce navigateur ne fournit pas les horodatages des images. Mettez Safari ou votre navigateur à jour.",
      );
    if (!window.Worker || !window.createImageBitmap)
      throw Error(
        "Ce navigateur ne permet pas le traitement vidéo local requis.",
      );
    this.cancelled = false;
    this.tracker = new HandTracker();
    this.frames = [];
    this.times = [];
    this.processed = 0;
    this.skipped = 0;
    this.missedCallbacks = 0;
    this.end = Math.min(v.duration, 30);
    this.worker = new Worker(new URL("./worker-bootstrap.js", import.meta.url));
    const ready = new Promise((resolve, reject) => {
      this.abort = () => {
        clearTimeout(timeout);
        reject(Error("Analyse annulée."));
      };
      const timeout = setTimeout(
        () =>
          reject(
            Error(
              "Chargement du modèle trop long. Vérifiez que les ressources MediaPipe ont été installées.",
            ),
          ),
        60000,
      );
      this.worker.onmessage = ({ data }) => {
        clearTimeout(timeout);
        if (data.type === "ready") { this.backend = data.backend; resolve(); }
        else if (data.type === "error") reject(Error(data.message));
      };
      this.worker.onerror = () => {
        clearTimeout(timeout);
        reject(
          Error(
            "Impossible de démarrer MediaPipe. Vérifiez les ressources locales et la compatibilité WebAssembly.",
          ),
        );
      };
    });
    this.worker.postMessage({ type: "init" });
    try {
      await ready;
    } catch (e) {
      this.worker?.terminate();
      this.worker = null;
      throw e;
    } finally {
      this.abort = null;
    }
    if (this.cancelled) throw Error("Analyse annulée.");
    const scale = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    const ctx = canvas.getContext("2d", { alpha: false });
    v.currentTime = 0;
    const pacer = new PlaybackPacer();
    v.playbackRate = adaptive ? pacer.rate : 0.25;
    v.controls = false;
    let busy = 0,
      last = -1,
      finished = false,
      stopped = false,
      callback;
    let frameStarted = 0, previousTime = null, presented = null, overloaded = false;
    let maximumRate = v.playbackRate;
    let sendQueue = Promise.resolve();
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(stall);
        v.cancelVideoFrameCallback(callback);
        v.removeEventListener("ended", finish);
        document.removeEventListener("visibilitychange", visibility);
        v.pause();
        v.playbackRate = 1;
        v.controls = true;
        this.abort = null;
      };
      const fail = (e) => {
        if (finished) return;
        finished = true;
        cleanup();
        this.worker?.terminate();
        this.worker = null;
        reject(e);
      };
      this.abort = () => fail(Error("Analyse annulée."));
      let stall;
      const kick = () => {
        clearTimeout(stall);
        stall = setTimeout(
          () =>
            fail(
              Error(
                "Lecture interrompue. Gardez la page au premier plan et réessayez.",
              ),
            ),
          20000,
        );
      };
      const visibility = () => {
        if (document.hidden)
          fail(
            Error(
              "Analyse interrompue lorsque la page est passée en arrière-plan. Relancez-la en gardant cet écran ouvert.",
            ),
          );
      };
      document.addEventListener("visibilitychange", visibility);
      const finish = () => {
        if (finished || stopped) return;
        if (busy) {
          setTimeout(finish, 20);
          return;
        }
        stopped = true;
        cleanup();
        this.abort = () => fail(Error("Analyse annulée."));
        stall = setTimeout(
          () =>
            fail(
              Error(
                "Calcul spectral interrompu. Réessayez avec une vidéo plus courte.",
              ),
            ),
          30000,
        );
        this.onProgress({ phase: "spectrum", progress: 1 });
        this.worker.postMessage({
          type: "analyze",
          tracks: this.tracker.tracks,
          width: v.videoWidth,
          height: v.videoHeight,
          band,
          count: this.processed,
        });
      };
      this.worker.onmessage = ({ data }) => {
        if (data.type === "error") {
          if (finished) {
            this.worker.terminate();
            this.worker = null;
            reject(Error(data.message));
          } else fail(Error(data.message));
          return;
        }
        if (data.type === "frame") {
          busy--;
          const firstFrame = this.processed === 0;
          if (adaptive && !firstFrame) {
            v.playbackRate = pacer.completed(performance.now() - frameStarted);
            maximumRate = Math.max(maximumRate, v.playbackRate);
          }
          this.processed++;
          this.times.push(data.time);
          const hands = this.tracker.add(data.time, data.hands);
          this.frames.push({ time: data.time, hands });
          // A bounded pipeline avoids stop/start for every frame. Resume when
          // the detector has drained the queue; never retain more than 3 bitmaps.
          if ((adaptive && busy <= 1 && v.paused) || firstFrame) v.play().catch(() => fail(Error("Lecture interrompue. Relancez l’analyse.")));
          this.onProgress({
            phase: "tracking",
            progress: data.time / this.end,
            time: data.time,
            count: this.processed,
            hands,
          });
        }
        if (data.type === "results") {
          finished = true;
          cleanup();
          const meta = {
            elapsedSeconds: (performance.now() - started) / 1000,
            reusedTracking: false,
            missedCallbacks: this.missedCallbacks,
            maximumRate,
            backend: this.backend,
            times: this.times,
            count: this.processed,
            skipped: this.skipped,
            ambiguous: this.tracker.ambiguous,
            width: v.videoWidth,
            height: v.videoHeight,
            duration: this.end,
          };
          this.worker.terminate();
          this.worker = null;
          this.cached = {
            results: data.results,
            tracks: this.tracker.tracks,
            frames: this.frames,
            meta,
          };
          resolve(this.cached);
        }
      };
      this.worker.onerror = () =>
        fail(
          Error(
            "Le traitement local a échoué. Réessayez avec une vidéo plus courte.",
          ),
        );
      const frame = async (_, metadata) => {
        kick();
        callback = v.requestVideoFrameCallback(frame);
        const t = metadata.mediaTime;
        if (previousTime !== null) pacer.observeStep(t - previousTime);
        previousTime = t;
        if (presented !== null && metadata.presentedFrames > presented + 1) {
          this.missedCallbacks += metadata.presentedFrames - presented - 1;
          if (adaptive) v.playbackRate = pacer.overload();
        }
        presented = metadata.presentedFrames;
        if (t >= this.end) {
          finish();
          return;
        }
        if (t <= last) return;
        if (busy >= (adaptive ? 3 : 1)) {
          this.skipped++;
          if (adaptive && !overloaded) { v.playbackRate = pacer.overload(); overloaded = true; }
          return;
        }
        last = t;
        busy++;
        overloaded = false;
        if ((adaptive && busy >= 3) || this.processed === 0) v.pause();
        frameStarted = performance.now();
        try {
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          const prepared = createImageBitmap(canvas).then(bitmap => ({bitmap}), error => ({error}));
          const send = sendQueue.then(async () => {
            const item = await prepared;
            if (item.error) throw item.error;
            const bitmap = item.bitmap;
            if (this.cancelled || finished || stopped) {
              bitmap.close(); busy--; return;
            }
            this.worker.postMessage({ type: "frame", bitmap, time: t }, [bitmap]);
          });
          sendQueue = send.catch(() => {});
          await send;
        } catch (e) {
          busy--;
          fail(
            Error(
              "Impossible de décoder les images de cette vidéo : " + e.message,
            ),
          );
        }
      };
      v.addEventListener("ended", finish, { once: true });
      callback = v.requestVideoFrameCallback(frame);
      kick();
      v.play().catch(() =>
        fail(
          Error(
            "Lecture impossible. Appuyez de nouveau sur Analyser ou choisissez une autre vidéo.",
          ),
        ),
      );
    });
  }
  cancel() {
    this.cancelled = true;
    this.abort?.();
    this.worker?.terminate();
    this.worker = null;
  }
  reanalyze(band) {
    const source = this.cached;
    this.cancelled = false;
    const started = performance.now();
    this.worker = new Worker(new URL("./worker-bootstrap.js", import.meta.url));
    this.onProgress({ phase: "spectrum", progress: 1, reused: true });
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        this.worker?.terminate();
        this.worker = null;
        this.abort = null;
      };
      const fail = error => { cleanup(); reject(error); };
      const timer = setTimeout(() => fail(Error("Calcul spectral interrompu. Réessayez.")), 30000);
      this.abort = () => fail(Error("Analyse annulée."));
      this.worker.onerror = () => fail(Error("Le calcul spectral a échoué."));
      this.worker.onmessage = ({data}) => {
        if (data.type === "error") return fail(Error(data.message));
        if (data.type !== "results") return;
        cleanup();
        this.cached = { ...source, results: data.results, meta: { ...source.meta, reusedTracking: true, elapsedSeconds: (performance.now() - started) / 1000 } };
        resolve(this.cached);
      };
      this.worker.postMessage({type: "analyze", tracks: source.tracks, width: source.meta.width, height: source.meta.height, band, count: source.meta.count});
    });
  }
  dispose() {
    this.cancel();
    this.video.pause();
    this.video.removeAttribute("src");
    this.video.load();
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
    this.frames = [];
    this.cached = null;
    this.tracker = null;
  }
}
