import { VideoSession } from "./video.js";
import { overlay, plot, spectrogram } from "./charts.js";
import { download, resultCSV, timeCSV, spectrumCSV } from "./export.js";
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
  if (p.phase !== "spectrum" && p.progress < 1 && now - lastPaint < 100) return;
  lastPaint = now;
  $("progress").value = p.progress;
  message(p.phase === "spectrum"
    ? (p.reused ? "Recalcul du spectre à partir des mêmes coordonnées…" : "Calcul de la fréquence en cours…")
    : `Analyse en cours : ${p.count} images traitées. Gardez cette page ouverte.`);
  $("progress-label").textContent =
    p.phase === "spectrum"
      ? "Calcul des spectres et recherche d’un consensus…"
      : `${Math.round(p.progress * 100)} % · ${p.count} images analysées · ${(p.time || 0).toFixed(1)} s de vidéo`;
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
  message("Ouverture de la vidéo…");
  locked(true);
  try {
    const m = await session.load(file);
    $("workspace").hidden = false;
    $("file-info").textContent =
      `${file.name || "Vidéo"} · ${m.width} × ${m.height} · ${m.duration.toFixed(1)} s`;
    $("progress").value = 0;
    overlay($("overlay"), video);
    message(
      m.duration > 30
        ? "Seules les 30 premières secondes seront analysées."
        : "Vidéo prête. Appuyez sur « Analyser la vidéo » : le bouton lecture sert uniquement à revoir l’enregistrement.",
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
  message("Vidéo et données de la session effacées.");
};
$("cancel").onclick = () => session.cancel();
$("analyze").onclick = async () => {
  const low = Number($("low").value),
    high = Number($("high").value);
  if (!(low >= 2 && high <= 15 && high - low >= 1)) {
    message(
      "Choisissez une bande comprise entre 2 et 15 Hz, large d’au moins 1 Hz.",
      true,
    );
    return;
  }
  resetResults();
  locked(true);
  message("Chargement local du modèle de détection…");
  $("progress-label").textContent = "Préparation de MediaPipe…";
  $("progress").value = 0;
  try {
    data = await session.analyze([low, high]);
    render();
    $("results").scrollIntoView({ block: "start" });
    message(
      data.results.some((r) => r.frequency !== null)
        ? "Analyse terminée. Consultez les limites avec votre résultat."
        : "Analyse terminée sans estimation suffisamment fiable. Consultez les détails.",
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
          : "Aucune main détectée. Vérifiez le cadrage, la lumière et la netteté.",
        "notice",
      ),
    );
  }
  for (const r of data.results) {
    const card = node("article", undefined, "result-card"),
      hero = node("div", undefined, "result-hero"),
      title = node("div");
    title.append(node("p", `MAIN SUIVIE ${r.id}`, "eyebrow"));
    const f = node(
      "div",
      r.frequency === null ? "Non déterminée" : r.frequency.toFixed(1),
      "frequency",
    );
    if (r.frequency !== null) f.append(node("small", " Hz"));
    title.append(f);
    hero.append(title, node("span", r.reliability, "reliability"));
    card.append(hero, node("p", r.reason, "fine"));
    const a = r.representative?.result;
    if (a) {
      const metrics = node("dl", undefined, "metrics");
      const items = [
        [
          "Bande analysée",
          `${a.band[0].toFixed(1)}–${a.band[1].toFixed(1)} Hz`,
        ],
        ["Durée exploitable", `${a.grid.duration.toFixed(1)} s`],
        ["Points contributifs", `${r.points} / 21`],
        ["Suivi de cette main", `${Math.round(r.tracking * 100)} %`],
        ["Cadence reconstruite", `${a.grid.fs.toFixed(1)} Hz`],
        ["Accord des groupes", `${Math.round(r.support * 100)} %`],
        ["Fenêtres stables", `${Math.round(a.stable * 100)} %`],
        ["Résolution Welch", `${a.spec.resolution.toFixed(2)} Hz`],
      ];
      for (const [label, value] of items) {
        const d = node("div");
        d.append(node("dt", label), node("dd", value));
        metrics.append(d);
      }
      card.append(
        metrics,
        node(
          "p",
          `Composante retenue : ${r.family === "global" ? "positions dans l’image (mouvement global conservé)" : "positions relatives au centre de la paume"}. Signal illustré : point ${r.representative.point}, axe ${r.representative.axis.toUpperCase()}.`,
          "fine",
        ),
      );
      if (a.secondary.length)
        card.append(
          node(
            "p",
            "Pics secondaires du signal illustré : " +
              a.secondary
                .map((p) => p.frequency.toFixed(1) + " Hz")
                .join(", ") +
              ". Ils peuvent correspondre à des harmoniques ou à des artefacts.",
            "fine",
          ),
        );
      const charts = node("div", undefined, "charts");
      function chart(label, x, y, opts) {
        const box = node("div", undefined, "chart"),
          c = node("canvas");
        c.setAttribute("role", "img");
        c.setAttribute("aria-label", label);
        c.tabIndex = 0;
        box.append(
          node("h3", label),
          c,
          node("p", "Survolez ou touchez le graphique pour lire une valeur."),
        );
        charts.append(box);
        return () => disposers.push(plot(c, x, y, opts));
      }
      const jobs = [];
      jobs.push(
        chart(
          "Déplacement au cours du temps",
          a.grid.times,
          detrend(a.grid.values),
          { ylabel: "Pixels · dérive linéaire retirée" },
        ),
      );
      const ids = a.spec.freq
        .map((f, i) => (f >= a.band[0] && f <= a.band[1] ? i : -1))
        .filter((i) => i >= 0);
      jobs.push(
        chart(
          "Densité spectrale de puissance",
          ids.map((i) => a.spec.freq[i]),
          ids.map((i) => a.spec.power[i]),
          {
            xlabel: "Fréquence (Hz)",
            ylabel: "Pixels² / Hz",
            peak: r.frequency,
          },
        ),
      );
      const timeline = a.timeline.filter((w) => w.peak);
      if (timeline.length >= 3)
        jobs.push(
          chart(
            "Fréquence par fenêtre de 4 secondes",
            timeline.map((w) => w.time),
            timeline.map((w) => w.peak.frequency),
            { ylabel: "Hz" },
          ),
        );
      card.append(charts);
      const d = a.details;
      if (d) {
        const advanced = node("details", undefined, "spectral-details");
        advanced.append(node("summary", "Analyse spectrale approfondie"));
        advanced.append(node("p", "Ces graphiques décrivent le signal illustré ci-dessus. Le résultat principal reste fondé sur le consensus entre groupes anatomiques.", "fine"));
        const measures = node("dl", undefined, "metrics");
        for (const [label, value] of [
          ["Puissance dans la bande", `${d.bandPower.toPrecision(3)} pixels²`],
          ["Déplacement RMS dans la bande", `${d.bandRms.toPrecision(3)} pixels`],
          ["Entropie spectrale normalisée", d.entropy === null ? "—" : d.entropy.toFixed(3)],
          ["Fréquence médiane des fenêtres", d.medianHz === null ? "—" : `${d.medianHz.toFixed(2)} Hz`],
          ["Dispersion temporelle P10–P90", d.p10Hz === null ? "—" : `${d.p10Hz.toFixed(2)}–${d.p90Hz.toFixed(2)} Hz`],
          ["Fenêtres avec pic émergent", `${d.usableWindows} / ${d.totalWindows}`],
        ]) { const item = node("div"); item.append(node("dt", label), node("dd", value)); measures.append(item); }
        advanced.append(measures, node("p", `Fenêtres de ${d.windowSeconds.toFixed(1)} s, recouvrement 50 %. P10–P90 décrit la variabilité des pics de fenêtres avec rapport pic/fond ≥ 6 ; ce n’est pas un intervalle de confiance. L’entropie décrit l’étalement de la puissance entre les bins de cette bande, sans seuil clinique. Elle dépend des paramètres du spectre.`, "fine"));
        const tableBox = node("div", undefined, "table-scroll");
        const table = node("table"); table.append(node("caption", "Pics du signal représentatif"));
        const head = node("thead"), row = node("tr");
        for (const title of ["Fréquence", "Niveau relatif", "Pic / fond", "Relation au pic dominant"]) { const th = node("th", title); th.scope = "col"; row.append(th); }
        head.append(row); table.append(head);
        const body = node("tbody");
        for (const p of d.peaks) {
          const tr = node("tr");
          for (const text of [`${p.frequency.toFixed(2)} Hz`, `${p.relativeDb.toFixed(1)} dB`, `${p.peakToFloorDb.toFixed(1)} dB`, p.harmonic ? `Compatible avec ×${p.harmonic}` : Math.abs(p.frequency - a.peak.frequency) < 0.01 ? "Pic dominant" : "Pic secondaire"])
            tr.append(node("td", text));
          body.append(tr);
        }
        table.append(body); tableBox.append(table); advanced.append(tableBox);
        advanced.append(node("p", `Pics retenus : puissance ≥ 10 % du pic dominant et rapport pic/fond ≥ 6. Le fond est la médiane de la densité spectrale dans la bande, pas une mesure indépendante du bruit. Une relation ×2, ×3 ou ×4 à ±${d.toleranceHz.toFixed(2)} Hz est seulement compatible avec une harmonique : elle ne prouve ni une fondamentale ni une origine physiologique. Les relations hors bande ne sont pas évaluées.`, "fine"));
        const heat = node("div", undefined, "chart");
        const heatCanvas = node("canvas"); heatCanvas.setAttribute("role", "img"); heatCanvas.setAttribute("aria-label", "Spectrogramme du signal représentatif");
        heat.append(node("h3", "Spectrogramme"), heatCanvas, node("p", "Touchez le spectrogramme pour lire une valeur. Les couleurs expriment la puissance relative au maximum de toutes les fenêtres."));
        advanced.append(heat);
        jobs.push(() => disposers.push(spectrogram(heatCanvas, a)));
        card.append(advanced);
      }
      container.append(card);
      jobs.forEach((f) => f());
    } else {
      card.append(
        node(
          "p",
          "Durée continue minimale : 6 s ; au moins trois groupes anatomiques périodiques concordants sont nécessaires.",
          "fine",
        ),
      );
      container.append(card);
    }
  }
  const dt = data.meta.times.slice(1).map((t, i) => t - data.meta.times[i]);
  $("sampling").textContent =
    `${data.meta.count} images traitées · cadence médiane observée ${dt.length ? (1 / quantile(dt, 0.5)).toFixed(1) : "—"} images/s · ${data.meta.skipped} callbacks non traités pendant un calcul. La cadence originale du fichier n’est pas déduite de celle du traitement. ${data.meta.ambiguous} image(s) exclue(s) pour proximité ambiguë des mains.`;
  $("sampling").textContent += ` Calcul effectué en ${data.meta.elapsedSeconds?.toFixed(1) || "—"} s${data.meta.reusedTracking ? " · coordonnées réutilisées sans nouvelle détection" : ""}.`;
}
$("export-results").onclick = () =>
  data && download(resultCSV(data), "tremorscan-resultats.csv");
$("export-data").onclick = () =>
  data && download(timeCSV(data), "tremorscan-points.csv");
$("export-spectrum").onclick = () =>
  data && download(spectrumCSV(data), "tremorscan-spectres.csv");
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
