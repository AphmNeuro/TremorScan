const cell = (v) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
export const csv = (rows) =>
  "\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
export function timeCSV(data) {
  const rows = [
    [
      "hand_id",
      "time_s",
      "landmark",
      "x_normalized",
      "y_normalized",
      "z_normalized",
      "x_px",
      "y_px",
    ],
  ];
  for (const t of data.tracks)
    for (const f of t.frames)
      f.landmarks.forEach((p, i) =>
        rows.push([
          t.id,
          f.time,
          i,
          p.x,
          p.y,
          p.z,
          p.x * data.meta.width,
          p.y * data.meta.height,
        ]),
      );
  return csv(rows);
}
export function resultCSV(data) {
  return csv([
    [
      "version",
      "hand_id",
      "dominant_hz",
      "reliability",
      "reason",
      "component",
      "points",
      "group_agreement",
      "tracking_fraction",
      "usable_duration_s",
      "sample_rate_hz",
      "band_low_hz",
      "band_high_hz",
      "welch_resolution_hz",
      "stable_window_fraction",
      "frequency_1_hz", "frequency_2_hz", "possible_harmonic", "elapsed_s", "reused_tracking", "sampling_warning", "backend", "maximum_playback_rate", "retried", "first_pass_s", "first_pass_processed", "first_pass_lost",
    ],
    ...data.results.map((r) => {
      const a = r.representative?.result;
      return [
        "0.3.0",
        r.id,
        r.frequency,
        r.reliability,
        r.reason,
        r.family,
        r.points,
        r.support,
        r.tracking,
        a?.grid.duration,
        a?.grid.fs,
        a?.band[0],
        a?.band[1],
        a?.spec.resolution,
        r.frequencies?.length === 2 ? a?.pairStability : a?.stable,
        r.frequencies?.[0] ?? r.frequency, r.frequencies?.[1], r.harmonic,
        data.meta?.elapsedSeconds, data.meta?.reusedTracking, data.meta?.samplingWarning,
        data.meta?.backend, data.meta?.maximumRate, data.meta?.retried || false,
        data.meta?.firstPass?.elapsedSeconds, data.meta?.firstPass?.count,
        data.meta?.firstPass ? data.meta.firstPass.skipped + data.meta.firstPass.missedCallbacks : null,
      ];
    }),
  ]);
}
export function spectrumCSV(data) {
  const rows = [["hand_id", "point", "axis", "component", "spectrum_type", "window_center_s", "frequency_hz", "psd_px2_per_hz", "band_low_hz", "band_high_hz", "resolution_hz"]];
  for (const r of data.results) {
    const c = r.representative, a = c?.result;
    if (!a) continue;
    for (const w of [{time: null, power: a.spec.power}, ...a.spec.windows]) {
      a.spec.freq.forEach((f, i) => {
        if (f < a.band[0] || f > a.band[1]) return;
        rows.push([r.id, c.point, c.axis, c.family, w.time === null ? "welch_mean" : "window", w.time === null ? "" : a.grid.start + w.time, f, w.power[i], ...a.band, a.spec.resolution]);
      });
    }
  }
  return csv(rows);
}
export function download(text, name) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
