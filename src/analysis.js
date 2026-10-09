import { welch, peaks, quantile, detrend, mean } from "./spectrum.js";
import { extractSignals } from "./tracking.js";
export function regularize(samples) {
  const valid = samples.filter(
    (p) => Number.isFinite(p.t) && Number.isFinite(p.v),
  );
  if (valid.length < 32) return null;
  for (let i = 1; i < valid.length; i++)
    if (valid[i].t <= valid[i - 1].t) return null;
  const dt = valid.slice(1).map((p, i) => p.t - valid[i].t),
    median = quantile(dt, 0.5),
    fs = Math.min(120, 1 / quantile(dt, 0.9));
  if (fs < 8) return null;
  const gapLimit = Math.min(0.15, 2.6 * median);
  let runs = [[]];
  for (const p of valid) {
    let r = runs.at(-1);
    if (r.length && p.t - r.at(-1).t > gapLimit) {
      r = [];
      runs.push(r);
    }
    r.push(p);
  }
  runs.sort((a, b) => b.at(-1).t - b[0].t - (a.at(-1).t - a[0].t));
  const run = runs[0],
    duration = run.at(-1).t - run[0].t;
  if (duration < 6) return null;
  const values = [],
    times = [];
  let j = 0,
    bridged = 0;
  for (let t = run[0].t; t <= run.at(-1).t; t += 1 / fs) {
    while (j + 1 < run.length - 1 && run[j + 1].t < t) j++;
    const a = run[j],
      b = run[j + 1];
    if (!b) break;
    values.push(a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t));
    times.push(t);
    if (b.t - a.t > median * 1.5) bridged++;
  }
  const coverage = run.length / (duration / median + 1),
    jitter =
      quantile(
        dt.map((d) => Math.abs(d - median)),
        0.9,
      ) / median;
  return {
    values,
    times,
    fs,
    duration,
    coverage: Math.min(1, coverage),
    bridged: bridged / values.length,
    jitter,
    start: run[0].t,
  };
}
export function analyzeSignal(samples, band = [2, 15]) {
  const grid = regularize(samples);
  if (!grid) return null;
  const high = Math.min(band[1], 0.4 * grid.fs),
    low = band[0];
  if (high - low < 1) return null;
  const spec = welch(grid.values, grid.fs),
    found = peaks(spec, low, high);
  const peak = found[0];
  const rms = Math.sqrt(mean(detrend(grid.values).map((x) => x * x)));
  if (!peak || rms < 0.05) return null;
  const timeline = spec.windows.map((w) => ({
    time: grid.start + w.time,
    peak: peaks({ ...spec, power: w.power }, low, high)[0],
  }));
  const stable =
    timeline.filter(
      (w) =>
        w.peak &&
        Math.abs(w.peak.frequency - peak.frequency) <= 0.5 &&
        w.peak.snr >= 6,
    ).length / timeline.length;
  const spread =
    timeline.length > 1
      ? quantile(
          timeline
            .filter((x) => x.peak)
            .map((w) => Math.abs(w.peak.frequency - peak.frequency)),
          0.9,
        )
      : null;
  const competing = found.some((p, i) => i > 0 && p.power > peak.power * 0.65);
  const periodic =
    peak.snr >= 8 &&
    peak.concentration >= 0.35 &&
    stable >= 0.65 &&
    grid.coverage >= 0.75;
  return {
    grid,
    spec,
    peak,
    secondary: found
      .slice(1)
      .filter((p) => p.power >= peak.power * 0.1 && p.snr >= 6)
      .slice(0, 3),
    timeline,
    stable,
    spread,
    periodic,
    competing,
    band: [low, high],
    rms,
  };
}
// One equal vote per anatomical group: axes and correlated landmarks cannot multiply a vote.
export function aggregate(channels) {
  const usable = channels.filter((c) => c.result?.periodic);
  if (!usable.length)
    return {
      frequency: null,
      reliability: "Indéterminée",
      reason: "Aucune oscillation suffisamment périodique et stable.",
      support: 0,
      points: 0,
    };
  const families = ["global", "relative"]
    .map((family) => {
      const set = usable.filter((c) => c.family === family);
      const groups = [];
      for (let g = 0; g <= 5; g++) {
        const options = set
          .filter((c) => c.group === g)
          .sort(
            (a, b) =>
              quality(b.result) - quality(a.result) ||
              a.point - b.point ||
              a.axis.localeCompare(b.axis),
          );
        if (options[0]) groups.push(options[0]);
      }
      if (!groups.length) return null;
      const clusters = groups
        .map((c) => {
          const members = groups.filter(
            (x) =>
              Math.abs(x.result.peak.frequency - c.result.peak.frequency) <=
              0.5,
          );
          return {
            members,
            f: quantile(
              members.map((x) => x.result.peak.frequency),
              0.5,
            ),
          };
        })
        .sort((a, b) => b.members.length - a.members.length || a.f - b.f);
      const best = clusters[0],
        support = best.members.length / groups.length;
      return { family, ...best, support, total: groups.length };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        b.members.length - a.members.length ||
        b.support - a.support ||
        a.family.localeCompare(b.family),
    );
  const best = families[0];
  if (!best)
    return {
      frequency: null,
      reliability: "Indéterminée",
      reason: "Suivi insuffisant.",
      points: 0,
      support: 0,
    };
  const representative = [...best.members].sort(
    (a, b) => quality(b.result) - quality(a.result),
  )[0];
  const conflicting = families.some(
    (f) => f !== best && f.members.length >= 3 && Math.abs(f.f - best.f) > 0.6,
  );
  const ambiguous =
    best.members.length < 3 ||
    best.support < 0.7 ||
    conflicting ||
    best.members.filter((c) => c.result.competing).length >
      best.members.length / 2;
  const points = new Set(
    usable
      .filter(
        (c) =>
          c.family === best.family &&
          Math.abs(c.result.peak.frequency - best.f) <= 0.5,
      )
      .map((c) => c.point),
  ).size;
  const clean =
    best.members.every(
      (c) =>
        c.result.grid.coverage >= 0.9 &&
        c.result.grid.bridged < 0.08 &&
        c.result.stable >= 0.85 &&
        c.result.grid.jitter < 0.3,
    ) && best.support >= 0.85;
  return {
    frequency: ambiguous ? null : best.f,
    reliability: ambiguous
      ? "Incertaine"
      : clean
        ? "Cohérente"
        : "À interpréter avec prudence",
    reason: ambiguous
      ? "Pics concurrents ou désaccord entre groupes anatomiques / composantes."
      : "Consensus entre au moins trois groupes anatomiques ; indicateur qualitatif non calibré.",
    support: best.support,
    points,
    family: best.family,
    representative,
    groups: best.members.length,
    componentFrequencies: families.map((f) => ({
      family: f.family,
      frequency: f.f,
      groups: f.members.length,
    })),
  };
}
function quality(r) {
  return (
    r.stable * r.grid.coverage * Math.min(30, r.peak.snr) * r.peak.concentration
  );
}
export function analyzeTracks(tracks, width, height, band, processedCount) {
  return tracks
    .filter((t) => t.frames.length >= 32)
    .map((track) => {
      const channels = extractSignals(track.frames, width, height).map((c) => ({
        ...c,
        result: analyzeSignal(c.samples, band),
      }));
      const result = aggregate(channels);
      return {
        ...result,
        id: track.id,
        tracking: track.frames.length / Math.max(1, processedCount),
        observedDuration: track.frames.at(-1).time - track.frames[0].time,
        channels: channels
          .filter((c) => c.result)
          .map((c) => ({
            point: c.point,
            axis: c.axis,
            family: c.family,
            frequency: c.result.peak.frequency,
            periodic: c.result.periodic,
          })),
      };
    });
}
