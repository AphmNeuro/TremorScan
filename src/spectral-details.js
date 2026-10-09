import { peaks, quantile } from "./spectrum.js";

// Descriptive measures on the existing Welch PSD. No new clinical thresholds.
export function spectralDetails(result) {
  const { spec, band, peak, timeline } = result;
  const indices = spec.freq.map((f, i) => f >= band[0] && f <= band[1] ? i : -1).filter(i => i >= 0);
  const sum = indices.reduce((s, i) => s + spec.power[i], 0);
  const bandPower = sum * spec.binWidth;
  const entropy = sum > 0 && indices.length > 1
    ? -indices.reduce((s, i) => { const p = spec.power[i] / sum; return s + (p > 0 ? p * Math.log(p) : 0); }, 0) / Math.log(indices.length)
    : null;
  const dominant = peak.frequency;
  const tolerance = Math.max(spec.resolution, 0.2);
  const candidates = peaks(spec, ...band)
    .filter(p => p.power >= peak.power * 0.1 && p.snr >= 6).slice(0, 6);
  const described = candidates.map(p => {
    const ratio = p.frequency / dominant;
    const multiple = Math.round(ratio);
    const harmonic = multiple >= 2 && multiple <= 4 && Math.abs(p.frequency - multiple * dominant) <= tolerance ? multiple : null;
    return { ...p, relativeDb: 10 * Math.log10(p.power / peak.power), peakToFloorDb: 10 * Math.log10(p.snr), harmonic };
  });
  const frequencies = timeline.filter(w => w.peak?.snr >= 6).map(w => w.peak.frequency);
  return {
    bandPower, bandRms: Math.sqrt(bandPower), entropy, peaks: described,
    medianHz: frequencies.length ? quantile(frequencies, 0.5) : null,
    p10Hz: frequencies.length ? quantile(frequencies, 0.1) : null,
    p90Hz: frequencies.length ? quantile(frequencies, 0.9) : null,
    usableWindows: frequencies.length, totalWindows: timeline.length,
    windowSeconds: 1 / spec.resolution, hopSeconds: spec.windows.length > 1 ? spec.windows[1].time - spec.windows[0].time : null,
    toleranceHz: tolerance,
  };
}
