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
    ],
    ...data.results.map((r) => {
      const a = r.representative?.result;
      return [
        "0.1.0",
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
        a?.stable,
      ];
    }),
  ]);
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
