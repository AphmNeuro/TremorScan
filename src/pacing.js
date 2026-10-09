import { quantile } from "./spectrum.js";

// Adapt playback, never the timestamps used by the estimator or landmark count.
export class PlaybackPacer {
  constructor() { this.rate = 0.5; this.cooldown = 0; this.steps = []; this.costs = []; }
  observeStep(seconds) {
    if (seconds > 0 && seconds < 0.2) {
      this.steps.push(seconds); if (this.steps.length > 120) this.steps.shift();
    }
  }
  overload() {
    this.rate = Math.max(0.125, this.rate * 0.65);
    this.cooldown = 12;
    return this.rate;
  }
  completed(milliseconds) {
    this.costs.push(milliseconds); if (this.costs.length > 60) this.costs.shift();
    if (this.cooldown > 0) { this.cooldown--; return this.rate; }
    if (this.costs.length < 16 || this.steps.length < 12) return this.rate;
    const step = quantile(this.steps, 0.1);
    // Inference runs while the video is paused. Limit presentation demand;
    // slower inference naturally increases wall time without losing frames.
    const target = Math.min(2, step * 30);
    this.rate = Math.max(0.125, Math.min(target, this.rate * 1.12));
    return this.rate;
  }
}

export function needsSlowerPass(meta) {
  const lost = meta.skipped + meta.missedCallbacks;
  return lost / Math.max(1, meta.count + lost) > 0.02;
}
