import { VideoSession } from "../src/video.js";
const log = document.querySelector("#log");
let file;
const write = (s) => {
  log.textContent += "\n" + s;
};
async function generate(blank) {
  const image = new Image();
  if (!blank) {
    image.src = "./assets/woman_hands.jpg";
    await image.decode();
  }
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  const c = canvas.getContext("2d");
  const stream = canvas.captureStream(60);
  const mime = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/mp4",
  ].find((t) => MediaRecorder.isTypeSupported(t));
  if (!mime) throw Error("MediaRecorder indisponible");
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 4000000,
  });
  const parts = [];
  recorder.ondataavailable = (e) => parts.push(e.data);
  const stopped = new Promise((r) => (recorder.onstop = r));
  recorder.start();
  const start = performance.now();
  await new Promise((resolve) => {
    function frame(now) {
      const t = (now - start) / 1000;
      c.fillStyle = "#ddd";
      c.fillRect(0, 0, 640, 480);
      if (!blank) {
        const scale = Math.min(560 / image.width, 400 / image.height),
          w = image.width * scale,
          h = image.height * scale;
        c.drawImage(
          image,
          (640 - w) / 2 + 12 * Math.sin(2 * Math.PI * 5 * t),
          (480 - h) / 2,
          w,
          h,
        );
      }
      if (t < 12) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
  recorder.stop();
  await stopped;
  stream.getTracks().forEach((t) => t.stop());
  return new File(parts, blank ? "sans-main.webm" : "reference-5hz.webm", {
    type: mime,
  });
}
const session = new VideoSession(
  document.querySelector("video"),
  document.querySelector("canvas"),
  (p) => {
    if (p.phase === "tracking")
      log.textContent =
        log.textContent.split("\nProgression")[0] +
        `\nProgression ${Math.round(p.progress * 100)} % · ${p.count} images`;
  },
);
for (const [id, blank] of [
  ["reference", false],
  ["blank", true],
])
  document.getElementById(id).onclick = async () => {
    try {
      log.textContent = "Génération de la vidéo…";
      file = await generate(blank);
      document.querySelector("#save").disabled = false;
      write("Import du Blob vidéo : " + file.size + " octets");
      await session.load(file);
      write("Décodage réussi");
      const data = await session.analyze([2, 15]);
      write(
        JSON.stringify(
          {
            processed: data.meta.count,
            tracks: data.tracks.map((t) => ({
              id: t.id,
              frames: t.frames.length,
              points: t.frames[0]?.landmarks.length,
            })),
            results: data.results.map((r) => ({
              frequency: r.frequency,
              reliability: r.reliability,
              points: r.points,
              reason: r.reason,
            })),
          },
          null,
          2,
        ),
      );
      write(
        blank
          ? data.tracks.length === 0
            ? "PASS sans main"
            : "FAIL détection inattendue"
          : data.tracks.some((t) => t.frames.length > 50)
            ? "PASS détection/extraction sur vidéo synthétique"
            : "FAIL détection",
      );
    } catch (e) {
      write("FAIL " + e.message);
    } finally {
      session.dispose();
    }
  };
document.querySelector("#bad").onclick = async () => {
  log.textContent = "Test codec / fichier invalide";
  try {
    await session.load(
      new File(["bad file"], "invalide.mov", { type: "video/quicktime" }),
    );
    write("FAIL");
  } catch (e) {
    write("PASS erreur lisible : " + e.message);
  } finally {
    session.dispose();
  }
};
document.querySelector("#save").onclick = () => {
  const url = URL.createObjectURL(file),
    a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
};
