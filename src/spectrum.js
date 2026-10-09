// One-sided PSD (pixel²/Hz): linear detrend, periodic Hann, 50% overlap.
export const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
export function quantile(a, q) {
  const b = [...a].sort((x, y) => x - y);
  return b[Math.min(b.length - 1, Math.floor(q * b.length))];
}
export function detrend(a) {
  const n = a.length,
    m = mean(a),
    c = (n - 1) / 2;
  let xy = 0,
    xx = 0;
  for (let i = 0; i < n; i++) {
    xy += (i - c) * (a[i] - m);
    xx += (i - c) ** 2;
  }
  const slope = xx ? xy / xx : 0;
  return a.map((v, i) => v - m - slope * (i - c));
}
export function fft(re, im) {
  const n = re.length;
  if (n < 2 || n & (n - 1)) throw Error("FFT power of two required");
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len *= 2) {
    const a = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let j = 0; j < len / 2; j++) {
        const c = Math.cos(a * j),
          s = Math.sin(a * j),
          k = i + j,
          l = k + len / 2,
          tr = c * re[l] - s * im[l],
          ti = s * re[l] + c * im[l];
        re[l] = re[k] - tr;
        im[l] = im[k] - ti;
        re[k] += tr;
        im[k] += ti;
      }
    }
  }
}
export function welch(values, fs, seconds = 4) {
  const size = Math.min(values.length, Math.round(seconds * fs));
  if (size < 16) return null;
  const nfft = 2 ** Math.ceil(Math.log2(size * 2)),
    hop = Math.floor(size / 2),
    psd = new Array(nfft / 2 + 1).fill(0),
    windows = [];
  const win = Array.from(
      { length: size },
      (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size),
    ),
    scale = fs * win.reduce((s, v) => s + v * v, 0);
  for (let start = 0; start + size <= values.length; start += hop) {
    const a = detrend(values.slice(start, start + size)),
      re = new Float64Array(nfft),
      im = new Float64Array(nfft);
    for (let i = 0; i < size; i++) re[i] = a[i] * win[i];
    fft(re, im);
    const power = psd.map(
      (_, i) =>
        ((re[i] ** 2 + im[i] ** 2) / scale) * (i > 0 && i < nfft / 2 ? 2 : 1),
    );
    power.forEach((p, i) => (psd[i] += p));
    windows.push({ time: (start + size / 2) / fs, power });
  }
  return {
    freq: psd.map((_, i) => (i * fs) / nfft),
    power: psd.map((p) => p / windows.length),
    windows,
    binWidth: fs / nfft,
    resolution: fs / size,
    fs,
  };
}
export function peaks(spec, low, high) {
  const { freq, power } = spec;
  const indices = freq
    .map((f, i) => (f >= low && f <= high ? i : -1))
    .filter((i) => i >= 0);
  if (indices.length < 3) return [];
  const floor = Math.max(
    1e-14,
    quantile(
      indices.map((i) => power[i]),
      0.5,
    ),
  );
  const total = indices.reduce((s, i) => s + power[i], 0);
  const result = [];
  for (const i of indices) {
    if (
      i === 0 ||
      i >= power.length - 1 ||
      power[i] < power[i - 1] ||
      power[i] <= power[i + 1]
    )
      continue;
    const p0 = Math.log(Math.max(1e-30, power[i - 1])),
      p1 = Math.log(Math.max(1e-30, power[i])),
      p2 = Math.log(Math.max(1e-30, power[i + 1]));
    const d = Math.max(
      -0.5,
      Math.min(0.5, (0.5 * (p0 - p2)) / (p0 - 2 * p1 + p2) || 0),
    );
    const f = freq[i] + d * spec.binWidth;
    if (f < low || f > high) continue;
    const energy = indices
      .filter((j) => Math.abs(freq[j] - f) <= 0.5)
      .reduce((s, j) => s + power[j], 0);
    result.push({
      frequency: f,
      power: power[i],
      snr: power[i] / floor,
      concentration: total ? energy / total : 0,
    });
  }
  return result
    .sort((a, b) => b.power - a.power)
    .filter(
      (p, i, all) =>
        !all.slice(0, i).some((a) => Math.abs(a.frequency - p.frequency) < 0.6),
    );
}
