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
  const timeline = spec.windows.map((w) => {
    const windowPeaks = peaks({ ...spec, power: w.power }, low, high);
    return { time: grid.start + w.time, peak: windowPeaks[0], peaks: windowPeaks };
  });
  const matches = (w, p) => w.peaks.some(q => Math.abs(q.frequency - p.frequency) <= 0.4 && q.snr >= 6 && q.power >= (w.peak?.power || 0) * 0.2);
  const strong = found.filter(p => p.snr >= 8 && p.power >= peak.power * 0.25 && p.concentration >= 0.15);
  const pairStability = strong.length === 2 ? timeline.filter(w => strong.every(p => matches(w, p))).length / timeline.length : 0;
  const pair = strong.length === 2 && Math.abs(strong[0].frequency - strong[1].frequency) >= 1 && grid.coverage >= 0.85
    && pairStability >= 0.65
    ? strong.slice().sort((a,b) => a.frequency - b.frequency) : null;
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
    pair,
    pairStability,
  };
}
// One equal vote per anatomical group: axes and correlated landmarks cannot multiply a vote.
export function aggregate(channels) {
  const double = aggregatePair(channels);
  if (double) return double;
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
      : "Fréquence retrouvée sur plusieurs groupes anatomiques.",
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
function aggregatePair(channels) {
  const options = [];
  for (const family of ["global", "relative"]) {
    const available = channels.filter(c => c.family === family && c.result);
    const total = new Set(available.map(c => c.group)).size;
    const paired = available.filter(c => c.result.pair);
    for (const seed of paired) {
      const agree = paired.filter(c => c.result.pair.every((p, i) => Math.abs(p.frequency - seed.result.pair[i].frequency) <= 0.4));
      const groups = new Set(agree.map(c => c.group)).size;
      if (groups < 3 || groups / total < 0.7) continue;
      // One vote per group, with stable deterministic tie-breaking.
      const votes = [...new Set(agree.map(c => c.group))].sort().map(g => agree.filter(c => c.group === g).sort((a,b) => quality(b.result) - quality(a.result) || a.point - b.point || a.axis.localeCompare(b.axis))[0]);
      const frequencies = [0,1].map(i => quantile(votes.map(c => c.result.pair[i].frequency), 0.5));
      options.push({family, frequencies, groups, support: groups / total, agree, votes});
    }
  }
  options.sort((a,b) => b.groups - a.groups || b.support - a.support || a.family.localeCompare(b.family) || a.frequencies[0] - b.frequencies[0]);
  if (!options.length) return null;
  const best = options[0];
  // Do not let a weaker relative component replace an equally supported raw
  // single-frequency result. Subtracting the palm can magnify tracking artefacts.
  if (best.family === "relative") {
    const raw = channels.filter(c => c.family === "global" && c.result?.periodic && !c.result.pair);
    const coherent = raw.filter(c => best.frequencies.some(f => Math.abs(f-c.result.peak.frequency)<=0.4));
    if (new Set(coherent.map(c=>c.group)).size >= best.groups) return null;
  }
  const conflict = options.some(o => o.frequencies.some((f,i) => Math.abs(f - best.frequencies[i]) > 0.5));
  const other = channels.filter(c => c.family !== best.family && c.result?.periodic && best.frequencies.every(f => Math.abs(c.result.peak.frequency-f)>0.5));
  if (conflict || new Set(other.map(c=>c.group)).size >= 3) return {frequency:null, frequencies:[], reliability:"Incertaine", reason:"Les composantes ne concordent pas entre les points suivis.", support:0, points:0};
  const representative = [...best.votes].sort((a,b) => quality(b.result)-quality(a.result) || a.point-b.point || a.axis.localeCompare(b.axis))[0];
  const ratio = best.frequencies[1] / best.frequencies[0];
  const multiple = Math.round(ratio);
  const harmonic = multiple >= 2 && multiple <= 4 && Math.abs(best.frequencies[1] - multiple * best.frequencies[0]) <= Math.max(0.2, representative.result.spec.resolution);
  return {
    frequency: null, frequencies: best.frequencies,
    reliability: "Deux composantes concordantes",
    reason: harmonic ? "Deux fréquences présentes ensemble. La plus élevée peut être une harmonique de la première." : "Deux fréquences présentes ensemble et retrouvées sur plusieurs groupes anatomiques.",
    support: best.support, points: new Set(best.agree.map(c=>c.point)).size,
    family: best.family, groups: best.groups, representative, harmonic,
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
        frequencies: result.frequencies || (result.frequency === null ? [] : [result.frequency]),
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
