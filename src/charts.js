import { CONNECTIONS } from "./tracking.js";
export function overlay(canvas, video, hands = []) {
  const scale = Math.min(1, 960 / Math.max(video.videoWidth || 640, video.videoHeight || 480));
  const width = Math.round((video.videoWidth || 640) * scale);
  const height = Math.round((video.videoHeight || 480) * scale);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const c = canvas.getContext("2d");
  c.clearRect(0, 0, canvas.width, canvas.height);
  hands.forEach((h, j) => {
    const p = h.landmarks;
    c.strokeStyle = j ? "#e79a44" : "#38debd";
    c.fillStyle = c.strokeStyle;
    c.lineWidth = Math.max(2, canvas.width / 320);
    for (const [a, b] of CONNECTIONS) {
      c.beginPath();
      c.moveTo(p[a].x * canvas.width, p[a].y * canvas.height);
      c.lineTo(p[b].x * canvas.width, p[b].y * canvas.height);
      c.stroke();
    }
    for (const q of p) {
      c.beginPath();
      c.arc(
        q.x * canvas.width,
        q.y * canvas.height,
        canvas.width / 160,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
  });
}
export function plot(
  canvas,
  x,
  y,
  { xlabel = "Temps (s)", ylabel = "", peak = null } = {},
) {
  const draw = () => {
    const w = canvas.clientWidth || 600,
      h = 230,
      dpr = devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const c = canvas.getContext("2d");
    c.scale(dpr, dpr);
    const box = { l: 58, t: 22, w: w - 78, h: 163 };
    let xmin = Math.min(...x),
      xmax = Math.max(...x),
      ymin = Math.min(0, ...y),
      ymax = Math.max(...y);
    if (ymax === ymin) ymax = ymin + 1;
    if (xmax === xmin) xmax = xmin + 1;
    const X = (v) => box.l + ((v - xmin) / (xmax - xmin)) * box.w,
      Y = (v) => box.t + box.h - ((v - ymin) / (ymax - ymin)) * box.h;
    c.font = "11px system-ui";
    c.fillStyle = "#60737c";
    c.strokeStyle = "#dfe8eb";
    for (let i = 0; i <= 4; i++) {
      const yy = box.t + (i * box.h) / 4;
      c.beginPath();
      c.moveTo(box.l, yy);
      c.lineTo(w - 20, yy);
      c.stroke();
      c.fillText((ymax - (i * (ymax - ymin)) / 4).toPrecision(2), 2, yy + 4);
      const xx = xmin + (i * (xmax - xmin)) / 4;
      c.fillText(xx.toFixed(1), X(xx) - 8, h - 27);
    }
    c.fillText(ylabel, box.l, 12);
    c.fillText(xlabel, w / 2 - 25, h - 5);
    c.strokeStyle = "#087f8c";
    c.lineWidth = 2;
    c.beginPath();
    x.forEach((v, i) =>
      i ? c.lineTo(X(v), Y(y[i])) : c.moveTo(X(v), Y(y[i])),
    );
    c.stroke();
    if (peak !== null && peak >= xmin && peak <= xmax) {
      c.setLineDash([4, 4]);
      c.strokeStyle = "#c77b22";
      c.beginPath();
      c.moveTo(X(peak), box.t);
      c.lineTo(X(peak), box.t + box.h);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = "#915718";
      c.fillText(
        peak.toFixed(1) + " Hz",
        Math.min(X(peak) + 5, w - 70),
        box.t + 12,
      );
    }
    return { box, xmin, xmax };
  };
  let state = draw();
  const resize = new ResizeObserver(() => (state = draw()));
  resize.observe(canvas);
  canvas.onpointermove = (e) => {
    const rect = canvas.getBoundingClientRect(),
      v =
        state.xmin +
        ((e.clientX - rect.left - state.box.l) / state.box.w) *
          (state.xmax - state.xmin);
    let i = 0;
    for (let j = 1; j < x.length; j++)
      if (Math.abs(x[j] - v) < Math.abs(x[i] - v)) i = j;
    canvas.title = `${x[i]?.toFixed(2)} · ${y[i]?.toPrecision(4)}`;
    canvas.nextElementSibling.textContent = `${xlabel} : ${x[i]?.toFixed(2)} — ${ylabel} : ${y[i]?.toPrecision(4)}`;
  };
  return () => {
    resize.disconnect();
    canvas.onpointermove = null;
  };
}

export function spectrogram(canvas, result) {
  const { spec, band, grid } = result;
  const bins = spec.freq.map((f, i) => f >= band[0] && f <= band[1] ? i : -1).filter(i => i >= 0);
  const windows = spec.windows;
  const maximum = Math.max(1e-30, ...windows.flatMap(w => bins.map(i => w.power[i])));
  const db = (w, i) => Math.max(-40, 10 * Math.log10(Math.max(1e-30, w.power[i]) / maximum));
  let box;
  const draw = () => {
    const width = canvas.clientWidth || 600, height = 260, dpr = devicePixelRatio || 1;
    canvas.width = width * dpr; canvas.height = height * dpr;
    const c = canvas.getContext("2d"); c.scale(dpr, dpr);
    box = { l: 45, t: 25, w: width - 60, h: 180 };
    windows.forEach((window, j) => bins.forEach((i, k) => {
      const strength = (db(window, i) + 40) / 40;
      c.fillStyle = `hsl(${240 - strength * 195} 75% ${12 + strength * 48}%)`;
      c.fillRect(box.l + j * box.w / windows.length, box.t + (bins.length - 1 - k) * box.h / bins.length, box.w / windows.length + 0.5, box.h / bins.length + 0.5);
    }));
    c.font = "11px system-ui"; c.fillStyle = "#60737c";
    c.fillText("Fréquence (Hz)", box.l, 13);
    for (let k = 0; k <= 4; k++) {
      const i = Math.round(k * (bins.length - 1) / 4);
      c.fillText(spec.freq[bins[i]].toFixed(1), 2, box.t + box.h - (i + 0.5) * box.h / bins.length + 4);
    }
    const selected = [...new Set([0, Math.floor(windows.length / 2), windows.length - 1])];
    selected.forEach(j => c.fillText((grid.start + windows[j].time).toFixed(1), box.l + (j + 0.5) * box.w / windows.length - 8, 225));
    c.fillText("Centre de la fenêtre (s) · bleu −40 dB → jaune 0 dB", box.l, 246);
  };
  draw(); const resize = new ResizeObserver(draw); resize.observe(canvas);
  canvas.onpointermove = e => {
    const rect = canvas.getBoundingClientRect();
    const j = Math.max(0, Math.min(windows.length - 1, Math.floor((e.clientX - rect.left - box.l) / box.w * windows.length)));
    const k = Math.max(0, Math.min(bins.length - 1, bins.length - 1 - Math.floor((e.clientY - rect.top - box.t) / box.h * bins.length)));
    canvas.nextElementSibling.textContent = `Fenêtre centrée à ${(grid.start + windows[j].time).toFixed(2)} s · ${spec.freq[bins[k]].toFixed(2)} Hz · ${db(windows[j], bins[k]).toFixed(1)} dB relatifs (plancher d’affichage −40 dB).`;
  };
  return () => { resize.disconnect(); canvas.onpointermove = null; };
}
