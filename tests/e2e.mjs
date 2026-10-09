// Optional: npm install --no-save playwright; npx playwright install chromium
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_PATH
    ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href
    : "playwright"
);
const artifacts = new URL("./artifacts/", import.meta.url);
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_CHANNEL
    ? { channel: process.env.BROWSER_CHANNEL }
    : {}),
});
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  if (!process.argv.includes("--reuse-reference")) {
    await page.goto("http://127.0.0.1:4180/tests/browser.html");
    await page
      .getByRole("button", { name: "Tester vidéo de référence", exact: true })
      .click();
    await page.waitForFunction(
      () => /PASS|FAIL/.test(document.querySelector("#log").textContent),
      {},
      { timeout: 180000 },
    );
    const reference = await page.locator("#log").innerText();
    console.log(reference);
    await writeFile(new URL("reference.txt", artifacts), reference);
    assert.match(reference, /PASS détection/);
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Télécharger la vidéo test" })
      .click();
    await (
      await downloadPromise
    ).saveAs(fileURLToPath(new URL("reference.webm", artifacts)));
  }
  await page.goto("http://127.0.0.1:4180/");
  const external = [];
  page.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      !r.url().startsWith("http://127.0.0.1:4180/")
    )
      external.push(r.url());
  });
  await page
    .locator("#video-file")
    .setInputFiles(fileURLToPath(new URL("reference.webm", artifacts)));
  await page
    .getByRole("button", { name: "Analyser la vidéo", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Analyser la vidéo", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      !document.querySelector("#results").hidden ||
      document.querySelector("#message").classList.contains("error"),
    {},
    { timeout: 180000 },
  );
  assert.equal(
    await page.locator("#results").isVisible(),
    true,
    await page.locator("#message").innerText(),
  );
  await page.screenshot({
    path: fileURLToPath(new URL("results-desktop.png", artifacts)),
    fullPage: true,
  });
  const results = await page.locator("#results").innerText();
  console.log(results);
  await writeFile(new URL("ui-results.txt", artifacts), results);
  assert.equal(external.length, 0, "No external requests during analysis");
  const out = page.waitForEvent("download");
  await page.locator("#export-data").click();
  await (await out).saveAs(fileURLToPath(new URL("landmarks.csv", artifacts)));
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    "Mobile overflow",
  );
  await page.screenshot({
    path: fileURLToPath(new URL("results-mobile.png", artifacts)),
    fullPage: true,
  });
  await page.locator("#clear").click();
  assert.equal(await page.locator("#results").isVisible(), false);
  assert.equal(await page.locator("video").getAttribute("src"), null);
  await page.goto("http://127.0.0.1:4180/tests/browser.html");
  await page.locator("#bad").click();
  await page.waitForFunction(
    () => document.querySelector("#log").textContent.includes("PASS"),
    {},
    { timeout: 15000 },
  );
  console.log(await page.locator("#log").innerText());
  await page.locator("#blank").click();
  await page.waitForFunction(
    () =>
      /PASS sans main|FAIL/.test(document.querySelector("#log").textContent),
    {},
    { timeout: 180000 },
  );
  const blank = await page.locator("#log").innerText();
  console.log(blank);
  assert.match(blank, /PASS sans main/);
  assert.deepEqual(errors, []);
  await writeFile(
    new URL("summary.json", artifacts),
    JSON.stringify(
      {
        browser: await browser.version(),
        reference: true,
        ui: true,
        blank: true,
        invalid: true,
        externalRequests: external,
        errors,
        mobileViewport: "390x844; Chromium, not iPhone Safari",
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
