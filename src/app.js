import { VideoSession } from "./video.js";
import { overlay, plot } from "./charts.js";
import { download, resultCSV, timeCSV } from "./export.js";
import { quantile, detrend } from "./spectrum.js";
const $ = (id) => document.getElementById(id);
let data = null,
  loading = false,
  disposers = [];
const video = $("video");
let lastPaint = 0;
function message(text, error = false) {
  $("message").textContent = text;
  $("message").className = text ? (error ? "error" : "success") : "";
}
function locked(on) {
  loading = on;
  for (const id of [
    "capture",
    "import",
    "analyze",
    "low",
    "high",
    "clear",
    "video-file",
    "camera-file",
  ])
    $(id).disabled = on;
  $("cancel").hidden = !on;
  $("progress-box").hidden = !on;
}
const session = new VideoSession(video, $("overlay"), (p) => {
  // Rendering is throttled, never landmark extraction or signal sampling.
  const now = performance.now();
  if (p.phase === "tracking" && p.progress < 1 && now - lastPaint < 100) return;
  lastPaint = now;
  $("progress").value = p.progress;
  message(p.phase === "retry" ? "VÃ©rification : nouvelle lecture plus lente pour rÃ©cupÃ©rer davantage dâ€™imagesâ€¦" : p.phase === "spectrum"
    ? (p.reused ? "Recalcul du spectre Ã  partir des mÃªmes coordonnÃ©esâ€¦" : "Calcul de la frÃ©quence en coursâ€¦")
    : `Analyse en cours : ${p.count} images traitÃ©es. Gardez cette page ouverte.`);
  $("progress-label").textContent =
    p.phase === "retry" ? "Reprise automatique avec une lecture prudenteâ€¦" : p.phase === "spectrum"
      ? "Calcul des spectres et recherche dâ€™un consensusâ€¦"
      : `${Math.round(p.progress * 100)} % Â· ${p.count} images analysÃ©es Â· ${(p.time || 0).toFixed(1)} s de vidÃ©o`;
  if (p.hands) overlay($("overlay"), video, p.hands);
});
function resetResults() {
  data = null;
  $("results").hidden = true;
  $("result-cards").replaceChildren();
  disposers.forEach((f) => f());
  disposers = [];
}
async function load(file) {
  if (!file || loading) return;
  resetResults();
  message("Ouverture de la vidÃ©oâ€¦");
  locked(true);
  try {
    const m = await session.load(file);
    $("workspace").hidden = false;
    $("file-info").textContent =
      `${file.name || "VidÃ©o"} Â· ${m.width} Ã— ${m.height} Â· ${m.duration.toFixed(1)} s`;
    $("progress").value = 0;
    overlay($("overlay"), video);
    message(
      m.duration > 30
        ? "Seules les 30 premiÃ¨res secondes seront analysÃ©es."
        : "VidÃ©o prÃªte. Appuyez sur Â« Analyser la vidÃ©o Â» : le bouton lecture sert uniquement Ã  revoir lâ€™enregistrement.",
    );
    $("workspace").scrollIntoView({ block: "start" });
  } catch (e) {
    session.dispose();
    $("workspace").hidden = true;
    message(e.message, true);
  } finally {
    locked(false);
  }
}
$("capture").onclick = () => $("camera-file").click();
$("import").onclick = () => $("video-file").click();
for (const id of ["video-file", "camera-file"])
  $(id).onchange = (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    load(f);
  };
$("clear").onclick = () => {
  session.dispose();
  resetResults();
  $("workspace").hidden = true;
  message("VidÃ©o et donnÃ©es de la session effacÃ©es.");
};
$("cancel").onclick = () => session.cancel();
$("analyze").onclick = async () => {
  const low = Number($("low").value),
    high = Number($("high").value);
  if (!(low >= 2 && high <= 15 && high - low >= 1)) {
    message(
      "Choisissez une bande comprise entre 2 et 15 Hz, large dâ€™au moins 1 Hz.",
      true,
    );
    return;
  }
  resetResults();
  locked(true);
  message("Chargement local du modÃ¨le de dÃ©tectionâ€¦");
  $("progress-label").textContent = "PrÃ©paration de MediaPipeâ€¦";
  $("progress").value = 0;
  try {
    data = await session.analyze([low, high]);
    render();
    $("results").scrollIntoView({ block: "start" });
    message(
      data.results.some((r) => r.frequencies?.length)
        ? "Analyse terminÃ©e. Consultez les limites avec votre rÃ©sultat."
        : "Analyse terminÃ©e sans estimation suffisamment fiable. Consultez les dÃ©tails.",
      false,
    );
  } catch (e) {
    message(e.message, true);
    $("message").scrollIntoView({ block: "start" });
  } finally {
    locked(false);
  }
};
function node(tag, text, cls) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}
function render() {
  $("results").hidden = false;
  const container = $("result-cards");
  if (!data.results.length) {
    container.append(
      node(
        "p",
        data.tracks.length
          ? "Suivi trop bref ou discontinu. Filmez au moins 10 secondes avec les doigts et le poignet visibles."
          : "Aucune main dÃ©tectÃ©e. VÃ©rifiez le cadrage, la lumiÃ¨re et la nettetÃ©.",
        "notice",
      ),
    );
  }
  for (const r of data.results) {
    const card = node("article", undefined, "result-card"),
      hero = node("div", undefined, "result-hero"),
      title = node("div");
    title.append(node("p", `MAIN SUIVIE ${r.id}`, "eyebrow"));
    const frequencies = r.frequencies || (r.frequency === null ? [] : [r.frequency]);
    const values = node("div", undefined, "frequency-values");
    if (!frequencies.length) values.append(node("div", "Non dÃ©terminÃ©e", "frequency"));
    frequencies.forEach((hz, i) => {
      if (i) values.append(node("span", "+", "frequency-plus"));
      const f = node("div", hz.toFixed(1), "frequency");
      f.append(node("small", " Hz")); values.append(f);
    });
    title.append(values);
    const amplitudeBox = node('section', undefined, 'amplitude-result');
    amplitudeBox.append(node('p', 'AMPLITUDE DU MOUVEMENT', 'eyebrow'));
    if(r.amplitudes?.length){
      for(const a of r.amplitudes){
        const v=node('div',a.peakToPeak.toFixed(2),'frequency');v.append(node('small',' cm'));
        amplitudeBox.append(v,node('p',`Crête à crête · ${a.frequency.toFixed(1)} Hz`,'fine'));
      }
    }else{
      amplitudeBox.append(node('strong','Non mesurable sur cette vidéo'),node('p','Gommette bleue ronde de 1 cm non reconnue de façon suffisamment stable. Gardez-la visible, face à l’objectif.','fine'));
    }
    amplitudeBox.append(node('p','Échelle : gommette de 1 cm de diamètre. Estimation projetée du signal représentatif ; téléphone fixe et main dans le même plan que la gommette.','fine'));
    title.append(amplitudeBox);
    hero.append(title, node("span", data.meta.samplingWarning ? "Acquisition Ã  vÃ©rifier" : r.reliability, "reliability"));
    card.append(hero, node("p", r.reason, "fine"));
    if (frequencies.length === 2) card.append(node("p", "Deux pics ne prouvent pas lâ€™existence de deux tremblements distincts.", "fine"));
    const a = r.representative?.result;
    if (a) {
      const metrics = node("dl", undefined, "metrics");
      for (const [label, value] of [
        ["VidÃ©o exploitable", `${a.grid.duration.toFixed(1)} s`],
        ["Suivi de la main", `${Math.round(r.tracking * 100)} %`],
        ["Points utilisÃ©s", `${r.points} / 21`],
        ["Bande analysÃ©e", `${a.band[0].toFixed(1)}â€“${a.band[1].toFixed(1)} Hz`],
      ]) { const item = node("div"); item.append(node("dt", label), node("dd", value)); metrics.append(item); }
      card.append(metrics);
      const box = node("div", undefined, "chart"), c = node("canvas");
      c.setAttribute("role", "img"); c.setAttribute("aria-label", "Spectre du mouvement");
      box.append(node("h3", "FrÃ©quences prÃ©sentes dans le mouvement"), c, node("p", "Touchez le graphique pour lire une valeur."));
      card.append(box);
      const motion = node("details"), mc = node("canvas");
      motion.append(node("summary", "Voir le mouvement au cours du temps"));
      const motionBox = node("div", undefined, "chart");
      mc.setAttribute("role", "img"); mc.setAttribute("aria-label", "DÃ©placement au cours du temps");
      motionBox.append(mc, node("p", "DÃ©placement du point reprÃ©sentatif, en pixels."));
      motion.append(motionBox); card.append(motion);
      container.append(card);
      const ids = a.spec.freq.map((f,i) => f >= a.band[0] && f <= a.band[1] ? i : -1).filter(i=>i>=0);
      disposers.push(plot(c, ids.map(i=>a.spec.freq[i]), ids.map(i=>a.spec.power[i]), {xlabel:"FrÃ©quence (Hz)", ylabel:"Puissance (pixelsÂ² / Hz)", markers:frequencies}));
      disposers.push(plot(mc, a.grid.times, detrend(a.grid.values), {ylabel:"DÃ©placement (pixels)"}));
    } else {
      card.append(node("p", "Essayez une vidÃ©o de 10 Ã  20 secondes, tÃ©lÃ©phone fixe et main bien Ã©clairÃ©e.", "fine"));
      container.append(card);
    }
  }
  const dt = data.meta.times.slice(1).map((t, i) => t - data.meta.times[i]);
  $("sampling").textContent =
    `${data.meta.count} images traitÃ©es Â· cadence mÃ©diane observÃ©e ${dt.length ? (1 / quantile(dt, 0.5)).toFixed(1) : "â€”"} images/s Â· ${data.meta.skipped} callbacks non traitÃ©s pendant un calcul. La cadence originale du fichier nâ€™est pas dÃ©duite de celle du traitement. ${data.meta.ambiguous} image(s) exclue(s) pour proximitÃ© ambiguÃ« des mains.`;
  $("analysis-time").textContent = `RÃ©sultat obtenu en ${data.meta.elapsedSeconds?.toFixed(1) || "â€”"} s${data.meta.retried ? " Â· vÃ©rification Ã  vitesse rÃ©duite effectuÃ©e" : ""}.`;
  if (data.meta.samplingWarning) $("analysis-time").textContent += " Certaines images manquent encore : interprÃ©tez la mesure avec prudence.";
  $("sampling").textContent += ` Calcul effectuÃ© en ${data.meta.elapsedSeconds?.toFixed(1) || "â€”"} s${data.meta.reusedTracking ? " Â· coordonnÃ©es rÃ©utilisÃ©es sans nouvelle dÃ©tection" : ""}.`;
}
$("export-results").onclick = () =>
  data && download(resultCSV(data), "tremorscan-resultats.csv");
$("export-data").onclick = () =>
  data && download(timeCSV(data), "tremorscan-points.csv");
let replayId;
function replay() {
  if (!loading) {
    let nearest = null;
    for (const f of data?.frames || [])
      if (
        !nearest ||
        Math.abs(f.time - video.currentTime) <
          Math.abs(nearest.time - video.currentTime)
      )
        nearest = f;
    overlay(
      $("overlay"),
      video,
      nearest && Math.abs(nearest.time - video.currentTime) <= 0.1
        ? nearest.hands
        : [],
    );
  }
  if (!video.paused) replayId = requestAnimationFrame(replay);
}
video.addEventListener("play", () => {
  cancelAnimationFrame(replayId);
  replay();
});
video.addEventListener("seeked", () => {
  if (video.paused) replay();
});
window.addEventListener("pagehide", () => {
  session.dispose();
  resetResults();
  $("workspace").hidden = true;
  cancelAnimationFrame(replayId);
});
