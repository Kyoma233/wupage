// Optional browser regression against the built MV3 extension and a local model stub.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createServer } from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = path.join(root, ".npm-cache/page-translation");
await fs.mkdir(output, { recursive: true });
// A content script must parse as a classic script even when it reuses helpers
// also imported by the background worker or the PDF reader.
new vm.Script(await fs.readFile(path.join(root, "dist/content.js"), "utf8"));
const moduleName = process.env.PLAYWRIGHT_MODULE || "playwright";
const { chromium } = await import(path.isAbsolute(moduleName) ? pathToFileURL(moduleName).href : moduleName);
const calls = [];
let damagedOnce = false;
let releaseSlow;
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Translation regression</title>
<style>body{margin:24px;font:16px/1.5 sans-serif}main{max-width:700px}code{white-space:nowrap}</style></head><body><main>
<h2>Review <em>request</em></h2>
<p id="rich">Use <code>first()</code> instead of <code>second()</code> before continuing.</p>
<div id="prose">Please <strong>review</strong> the attached contract.</div>
<p>Published <em>message</em>.<span contenteditable="plaintext-only">Unsent inline draft.</span></p>
<p hidden>Hidden private message.</p></main></body></html>`;
const server = createServer(async (request, response) => {
  try {
    if (request.method !== "POST") {
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end(html);
      return;
    }
    let body = "";
    for await (const chunk of request) body += chunk;
    const input = JSON.parse(JSON.parse(body).messages.at(-1).content);
    calls.push(input);
    if (input.texts.includes("Old pending message.")) await new Promise(resolve => { releaseSlow = resolve; });
    const translations = input.texts.map(text => {
      if (!text.includes("WUPAGE")) return `译文：${text}`;
      if (!damagedOnce) {
        damagedOnce = true;
        return "⟪WUPAGE0⟫ 替代 ⟪WUPAGE0⟫。";
      }
      return "先检查 ⟪WUPAGE1⟫，再使用 ⟪WUPAGE0⟫。";
    });
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(translations) } }] }));
  } catch (error) { response.writeHead(500).end(String(error)); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
let context;
try {
  context = await chromium.launchPersistentContext(path.join(output, `profile-${Date.now()}`), {
    ...(process.env.PDF_TEST_BROWSER ? { executablePath: process.env.PDF_TEST_BROWSER } : { channel: "chromium" }),
    headless: true, ignoreDefaultArgs: ["--disable-extensions"],
    args: [`--load-extension=${path.join(root, "dist")}`], viewport: { width: 1000, height: 900 }
  });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker", { timeout: 15000 });
  const control = await context.newPage();
  await control.goto(`chrome-extension://${new URL(worker.url()).host}/options.html`);
  const errors = [];
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  const url = `http://127.0.0.1:${server.address().port}/`;
  await control.evaluate(async (baseURL) => {
    const { data: settings } = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
    const provider = settings.providers.find(entry => entry.type === "deepseek");
    provider.baseURL = `${baseURL}v1`; provider.apiKey = "test-only";
    settings.activeProviderId = provider.id; settings.cacheEnabled = false;
    settings.sourceLang = "en"; settings.targetLang = "zh-CN"; settings.translationDisplayMode = "bilingual";
    await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings });
  }, url);
  await page.goto(url);
  await page.waitForSelector("#wupage-floating-ball", { state: "attached" });
  const original = await page.locator("main").innerHTML();
  const originalText = await page.locator("main").textContent();
  const message = request => worker.evaluate(async ({ url, request }) => {
    const [tab] = await chrome.tabs.query({ url });
    return chrome.tabs.sendMessage(tab.id, request);
  }, { url, request });
  const result = await message({ type: "TRANSLATE_PAGE" });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.data.failed, 0);
  assert.equal(result.data.translated, 4);
  assert.equal(damagedOnce, true);
  assert.equal(calls.filter(call => call.texts.length === 1 && call.texts[0].includes("WUPAGE")).length, 1);
  assert.equal(calls.some(call => /Unsent|Hidden private/u.test(JSON.stringify(call))), false);
  assert.deepEqual(await page.locator(".wupage-translation code").allTextContents(), ["second()", "first()"]);

  const modeReports = [];
  for (const width of [1000, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const mode of ["replace", "bilingual-accent", "bilingual"]) {
      const before = calls.length;
      await control.evaluate(async (mode) => {
        const { data: settings } = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
        await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings: { ...settings, translationDisplayMode: mode } });
      }, mode);
      await page.waitForFunction(mode => [...document.querySelectorAll(".wupage-translation")]
        .every(node => node.dataset.wupageDisplayMode === mode), mode);
      await page.waitForTimeout(250);
      assert.equal(calls.length, before, `Switching modes must reuse translations (${width}, ${mode}): ${JSON.stringify(calls)}`);
      assert.equal(await page.locator(".wupage-translation").count(), 4);
      assert.equal(await page.locator(".wupage-translation-pending").count(), 0);
      assert.equal(await page.locator("main").evaluate(node => node.scrollWidth > node.clientWidth + 1), false);
      modeReports.push({ width, mode });
    }
  }
  await message({ type: "CLEAR_TRANSLATION" });
  assert.equal(await page.locator("main").innerHTML(), original);

  // Verify the Ctrl-click paragraph path uses the same protected-token pipeline.
  await message({ type: "SET_PARAGRAPH_MODE", enabled: true });
  await page.locator("#rich").dispatchEvent("click", { ctrlKey: true });
  await page.waitForSelector(".wupage-translation code");
  assert.deepEqual(await page.locator(".wupage-translation code").allTextContents(), ["second()", "first()"]);
  await message({ type: "CLEAR_TRANSLATION" });
  await message({ type: "SET_PARAGRAPH_MODE", enabled: false });
  assert.equal(await page.locator("main").textContent(), originalText);
  assert.equal(await page.locator(".wupage-translation").count(), 0);
  assert.deepEqual(await page.locator("#rich code").allTextContents(), ["first()", "second()"]);

  // A reused application row must reject the previous source's late response.
  await page.locator("main").evaluate(node => { node.innerHTML = '<p id="pending">Old pending message.</p>'; });
  const pending = message({ type: "TRANSLATE_PAGE" });
  await page.waitForSelector(".wupage-translation-pending");
  await assertEventually(() => assert.equal(typeof releaseSlow, "function"));
  await page.locator("#pending").evaluate(node => { node.firstChild.data = "Current message."; });
  releaseSlow();
  await pending;
  await page.waitForFunction(() => document.querySelector("#pending .wupage-translation")?.textContent === "译文：Current message.");
  assert.equal(await page.locator("main").textContent(), "Current message.译文：Current message.");
  await message({ type: "CLEAR_TRANSLATION" });
  assert.equal(await page.locator("main").textContent(), "Current message.");
  assert.deepEqual(errors, []);
  const report = { modes: modeReports, placeholderRecovery: true, paragraphTranslation: true,
    hiddenAndDraftTextExcluded: true, sourceRestored: true, staleResponseDiscarded: true, errors };
  await fs.writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log("PASS: built MV3 extension; 6 viewport/mode combinations, protected text, drafts, Ctrl-click, source restoration and stale responses");
} finally {
  releaseSlow?.();
  await context?.close();
  await new Promise(resolve => server.close(resolve));
}

async function assertEventually(check) {
  for (let attempt = 0; ; attempt++) {
    try { check(); return; } catch (error) {
      if (attempt >= 100) throw error;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
}
