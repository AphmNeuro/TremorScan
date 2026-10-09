const wrist = (h) => h[0];
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// Spatial association, not result-array order. Ambiguous crossing frames are discarded.
export class HandTracker {
  constructor() {
    this.tracks = [];
    this.next = 1;
    this.ambiguous = 0;
  }
  add(time, hands) {
    if (
      hands.length === 2 &&
      distance(wrist(hands[0]), wrist(hands[1])) < 0.12
    ) {
      this.ambiguous++;
      return [];
    }
    const active = this.tracks.filter((t) => time - t.last <= 0.25);
    const candidates = [];
    for (const t of active)
      for (let i = 0; i < hands.length; i++) {
        const d = distance(t.wrist, wrist(hands[i]));
        if (d < 0.22) candidates.push({ t, i, d });
      }
    candidates.sort((a, b) => a.d - b.d);
    const assigned = new Map(),
      used = new Set();
    for (const c of candidates) {
      if (!assigned.has(c.i) && !used.has(c.t.id)) {
        assigned.set(c.i, c.t);
        used.add(c.t.id);
      }
    }
    return hands.map((landmarks, i) => {
      let t = assigned.get(i);
      if (!t) {
        t = { id: this.next++, frames: [] };
        this.tracks.push(t);
      }
      t.last = time;
      t.wrist = wrist(landmarks);
      t.frames.push({ time, landmarks });
      return { id: t.id, landmarks };
    });
  }
}
export const CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];
export function extractSignals(frames, width, height) {
  const channels = [];
  for (const family of ["global", "relative"])
    for (let point = 0; point < 21; point++)
      for (const axis of ["x", "y"]) {
        const scale = axis === "x" ? width : height;
        const samples = frames.map((f) => {
          const p = f.landmarks[point];
          const palm = [0, 5, 9, 13, 17].map((i) => f.landmarks[i]?.[axis]);
          const ok =
            p && Number.isFinite(p[axis]) && palm.every(Number.isFinite);
          return {
            t: f.time,
            v: ok
              ? (p[axis] - (family === "relative" ? mean(palm) : 0)) * scale
              : null,
          };
        });
        channels.push({
          family,
          point,
          axis,
          group: point === 0 ? 0 : Math.ceil(point / 4),
          samples,
        });
      }
  return channels;
}
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
