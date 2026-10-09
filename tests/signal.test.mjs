import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeSignal,
  aggregate,
  analyzeTracks,
  regularize,
} from "../src/analysis.js";
import { welch } from "../src/spectrum.js";
import { HandTracker, extractSignals } from "../src/tracking.js";
import { csv, timeCSV } from "../src/export.js";
function random(seed = 17) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}
function signal(
  f,
  {
    fs = 60,
    duration = 16,
    noise = 0,
    drift = 0,
    jitter = 0,
    missing = 0,
    other = 0,
  } = {},
) {
  const rng = random();
  const a = [];
  for (let i = 0; i < duration * fs; i++) {
    const t = i / fs + (i ? (jitter * (rng() - 0.5)) / fs : 0);
    if (rng() < missing) continue;
    a.push({
      t,
      v:
        4 * Math.sin(2 * Math.PI * f * t) +
        noise * (rng() - 0.5) +
        drift * (t + 0.2 * Math.sin(t)) +
        (other ? 4 * Math.sin(2 * Math.PI * other * t) : 0),
    });
  }
  return a;
}
for (const fs of [30, 60, 120])
  for (const f of [3, 5, 8, 12])
    test(`Pure ${f} Hz @ ${fs} Hz`, () => {
      const r = analyzeSignal(signal(f, { fs }));
      if (f >= 0.4 * fs) {
        assert.ok(!r || r.peak.frequency <= 0.4 * fs);
        return;
      }
      assert.ok(r.periodic);
      assert.ok(Math.abs(r.peak.frequency - f) <= 0.2, `${r.peak.frequency}`);
    });
for (const [name, options] of [
  ["bruit", { noise: 4 }],
  ["dérive", { drift: 4 }],
  ["irrégulier", { jitter: 0.4 }],
  ["manquants", { missing: 0.06 }],
  ["combiné", { noise: 2, drift: 2, jitter: 0.3, missing: 0.04 }],
])
  test(name, () => {
    const r = analyzeSignal(signal(5, options));
    assert.ok(r?.periodic);
    assert.ok(Math.abs(r.peak.frequency - 5) <= 0.2);
  });
test("Deux pics simultanés restent explicites", () => {
  const r = analyzeSignal(signal(5, { other: 8 }));
  assert.ok(r.competing);
  assert.ok(
    r.secondary.some((p) => Math.abs(p.frequency - 8) < 0.2) ||
      Math.abs(r.peak.frequency - 8) < 0.2,
  );
});
test("Bruit seul rejeté sur 20 tirages", () => {
  for (let seed = 0; seed < 20; seed++) {
    const rng = random(seed);
    const r = analyzeSignal(
      Array.from({ length: 960 }, (_, i) => ({
        t: i / 60,
        v: 10 * (rng() - 0.5),
      })),
    );
    assert.ok(!r?.periodic);
  }
});
test("Signal constant et dérive seuls rejetés", () => {
  assert.equal(analyzeSignal(signal(0)), null);
  const r = analyzeSignal(
    Array.from({ length: 960 }, (_, i) => ({ t: i / 60, v: i / 10 })),
  );
  assert.ok(!r?.periodic);
});
test("Pas de pont sur une longue perte de suivi", () => {
  const a = signal(5).filter((p) => p.t < 4 || p.t > 12);
  assert.equal(regularize(a), null);
});
test("Horodatages dupliqués ou inversés rejetés", () => {
  const s = signal(5);
  s[10].t = s[9].t;
  assert.equal(regularize(s), null);
});
test("Nyquist : ne jamais rapporter au-delà de la bande admissible", () => {
  const r = analyzeSignal(signal(8, { fs: 20 }));
  assert.ok(!r || r.band[1] <= 8);
});
test("Aliasing documenté : 25 Hz échantillonné à 30 devient 5 Hz", () => {
  const r = analyzeSignal(signal(25, { fs: 30 }));
  assert.ok(Math.abs(r.peak.frequency - 5) < 0.2);
});
test("Welch conserve la variance sinusoïdale", () => {
  const x = signal(5).map((s) => s.v);
  const s = welch(x, 60);
  const integral = s.power.reduce((a, b) => a + b, 0) * s.binWidth;
  assert.ok(Math.abs(integral - 8) < 0.05);
  assert.equal(s.resolution, 0.25);
  assert.ok(s.windows.length >= 3);
});
function channel(f, g, family = "global") {
  return {
    family,
    group: g,
    point: g * 4,
    axis: "x",
    result: analyzeSignal(signal(f)),
  };
}
test("Consensus multi-groupes déterministe", () => {
  const c = [0, 1, 2, 3, 4, 5].map((g) => channel(5, g));
  assert.ok(Math.abs(aggregate(c).frequency - 5) < 0.2);
  assert.equal(aggregate(c).frequency, aggregate([...c].reverse()).frequency);
});
test("Un artefact isolé ne gagne pas contre cinq groupes", () => {
  const c = [0, 1, 2, 3, 4].map((g) => channel(5, g));
  c.push(channel(8, 5));
  assert.ok(Math.abs(aggregate(c).frequency - 5) < 0.2);
});
test("Deux familles contradictoires => incertain", () => {
  const c = [0, 1, 2, 3].flatMap((g) => [
    channel(5, g),
    channel(8, g, "relative"),
  ]);
  assert.equal(aggregate(c).frequency, null);
});
test("Deux groupes contre deux => incertain", () =>
  assert.equal(
    aggregate([channel(5, 0), channel(5, 1), channel(8, 2), channel(8, 3)])
      .frequency,
    null,
  ));
test("Un seul groupe ne suffit pas", () =>
  assert.equal(
    aggregate(Array.from({ length: 8 }, () => channel(5, 1))).frequency,
    null,
  ));
const hand = (x, y = 0.5) =>
  Array.from({ length: 21 }, (_, i) => ({
    x: x + i * 0.001,
    y: y + i * 0.002,
    z: 0,
  }));
test("Association des mains indépendante de l’ordre", () => {
  const tr = new HandTracker();
  tr.add(0, [hand(0.2), hand(0.7)]);
  const a = tr.add(0.033, [hand(0.71), hand(0.21)]);
  assert.deepEqual(
    a.map((h) => h.id),
    [2, 1],
  );
  tr.add(0.1, [hand(0.4), hand(0.45)]);
  assert.equal(tr.ambiguous, 1);
  const b = tr.add(1, [hand(0.2)]);
  assert.equal(b[0].id, 3);
});
test("Extraction x/y en pixels et mouvement relatif", () => {
  const frames = signal(5).map((p) => ({
    time: p.t,
    landmarks: hand(0.3 + p.v / 1000),
  }));
  const channels = extractSignals(frames, 1000, 500);
  assert.equal(channels.length, 84);
  const raw = channels.find(
    (c) => c.family === "global" && c.point === 0 && c.axis === "x",
  );
  assert.ok(Math.abs(analyzeSignal(raw.samples).peak.frequency - 5) < 0.2);
  assert.equal(
    analyzeSignal(
      channels.find(
        (c) => c.family === "relative" && c.point === 0 && c.axis === "x",
      ).samples,
    ),
    null,
  );
  const r = analyzeTracks(
    [{ id: 1, frames }],
    1000,
    500,
    [2, 15],
    frames.length,
  )[0];
  assert.ok(Math.abs(r.frequency - 5) < 0.2);
  assert.equal(r.points, 21);
});
test("CSV échappe les cellules et exporte les coordonnées", () => {
  assert.equal(csv([['a"b', null]]), '\uFEFF"a""b",""');
  assert.ok(
    timeCSV({
      tracks: [{ id: 1, frames: [{ time: 0, landmarks: hand(0.3) }] }],
      meta: { width: 1000, height: 500 },
    }).includes('"300"'),
  );
});
