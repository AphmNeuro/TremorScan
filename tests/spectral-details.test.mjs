import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSignal } from '../src/analysis.js';
import { spectralDetails } from '../src/spectral-details.js';
import { spectrumCSV } from '../src/export.js';
const samples = fn => Array.from({length: 1200}, (_, i) => ({ t: i / 60, v: fn(i / 60) }));
const sin = (f, t, amplitude = 4) => amplitude * Math.sin(2 * Math.PI * f * t);
test('Band power and RMS recover known sinusoidal variance', () => {
  const a = analyzeSignal(samples(t => sin(5, t)));
  const d = spectralDetails(a);
  assert.ok(Math.abs(d.bandPower - 8) < 0.03);
  assert.ok(Math.abs(d.bandRms - Math.sqrt(8)) < 0.02);
  assert.ok(Math.abs(d.medianHz - 5) < 0.2);
  assert.ok(d.p90Hz - d.p10Hz < 0.05);
  assert.ok(d.entropy >= 0 && d.entropy <= 1);
  assert.ok(Math.abs(d.windowSeconds - 4) < 1e-9);
  assert.ok(Math.abs(d.hopSeconds - 2) < 1e-9);
});
test('Harmonic relation is flagged only at a compatible multiple', () => {
  const harmonic = spectralDetails(analyzeSignal(samples(t => sin(5,t) + sin(10,t,2))));
  assert.ok(harmonic.peaks.some(p => p.harmonic === 2 && Math.abs(p.frequency - 10) < 0.2));
  const unrelated = spectralDetails(analyzeSignal(samples(t => sin(5,t) + sin(8,t,2))));
  assert.ok(unrelated.peaks.some(p => Math.abs(p.frequency - 8) < 0.2 && p.harmonic === null));
});
test('Narrow band never invents an out-of-band harmonic', () => {
  const d = spectralDetails(analyzeSignal(samples(t => sin(5,t) + sin(10,t,2)), [2,8]));
  assert.ok(d.peaks.every(p => p.frequency <= 8 && p.harmonic === null));
});
test('Two-frequency switching broadens temporal frequency dispersion', () => {
  const d = spectralDetails(analyzeSignal(samples(t => sin(t < 10 ? 5 : 8, t))));
  assert.ok(d.p90Hz - d.p10Hz > 2.5);
});
test('Spectrum export retains average and per-window PSD in physical pixel units', () => {
  const a = analyzeSignal(samples(t => sin(5,t)));
  const text = spectrumCSV({results:[{id:1, representative:{point:8, axis:'x', family:'global', result:a}}]});
  assert.match(text, /psd_px2_per_hz/);
  assert.match(text, /welch_mean/);
  assert.match(text, /"window"/);
  assert.ok(!text.includes('NaN'));
  assert.equal(text.split('\r\n').length, 1 + a.spec.freq.filter(f => f >= a.band[0] && f <= a.band[1]).length * (a.spec.windows.length + 1));
});
