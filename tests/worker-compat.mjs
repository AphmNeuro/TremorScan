// Regress MediaPipe's Safari UA fallback in a real worker (not an iPhone test).
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
try {
  const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 Version/16.6 Mobile/15E148 Safari/604.1' });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4180/dist/');
  const initialize = () => page.evaluate(() => new Promise((resolve, reject) => {
    const worker = new Worker('./src/worker-bootstrap.js');
    const timer = setTimeout(() => { worker.terminate(); reject(Error('Worker timeout')); }, 60000);
    worker.onmessage = ({ data }) => { clearTimeout(timer); worker.terminate(); resolve(data); };
    worker.onerror = (e) => { clearTimeout(timer); worker.terminate(); reject(Error(e.message)); };
    worker.postMessage({ type: 'init' });
  }));
  const source = await readFile(new URL('../src/worker.js', import.meta.url), 'utf8');
  await page.route('**/src/worker.js', route => route.fulfill({ contentType: 'text/javascript', body: source.replace('        canvas,', '') }));
  const baseline = await initialize();
  assert.equal(baseline.type, 'error');
  assert.match(baseline.message, /document/);
  await page.unroute('**/src/worker.js');
  const result = await initialize();
  assert.equal(result.type, 'ready', JSON.stringify(result));
  console.log('PASS: real worker initializes with Safari user agent; no document fallback. Not a Safari engine/device test.');
} finally { await browser.close(); }
