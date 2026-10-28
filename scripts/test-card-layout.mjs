// Browser regression for separate card fields and localized mixed-language pages.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createServer } from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = path.join(root, ".npm-cache/card-layout");
await fs.mkdir(output, { recursive: true });
const moduleName = process.env.PLAYWRIGHT_MODULE || "playwright";
const { chromium } = await import(path.isAbsolute(moduleName) ? pathToFileURL(moduleName).href : moduleName);
const title = "A modular library for game extensions";
const summary = "Lightweight tools for creating and sharing extensions with other players.";
const listTranslations = [
  ["Lower your expectations for this puzzle", "降低你对这个谜题的期望"],
  ["Is there a special place for Hilbert's foundations of geometry?", "希尔伯特的《几何基础》在几何学基础中是否享有特殊地位？"],
  ["performance", "性能"], ["stream", "流"], ["memory-efficient", "节省内存"]
];
const translations = [[title, "游戏扩展模块库"], [summary, "用于创建扩展并与其他玩家分享的轻量级工具。"], ["by", "作者"], ...listTranslations];
const server = createServer((request, response) => {
  const chinese = request.url === "/zh";
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(`<!doctype html><html lang="${chinese ? "zh-CN" : "en"}"><head><meta charset="utf-8">
    <title>${chinese ? "模组列表" : "Extension catalog"}</title><style>
    body{margin:20px;font:16px/1.5 sans-serif;background:#171a1c;color:#b1b8bd}
    main{max-width:700px}.card{padding:16px;margin-bottom:16px;background:#23282c;border-radius:12px}
    .fields{gap:8px;align-items:center}.flex{display:flex}.grid{display:grid;grid-template-columns:minmax(0,1fr) auto}
    .title{font-size:20px;font-weight:600;line-height:24px;color:#f6f8fa;min-width:0;display:-webkit-box;
      -webkit-box-orient:vertical;-webkit-line-clamp:1;overflow:hidden}
    .author{flex-shrink:0;white-space:nowrap;font-weight:400;color:#b1b8bd}.author a{color:inherit}
    .summary{margin-top:8px;font-size:16px;font-weight:400;line-height:24px}
    #list-layout{max-width:300px;padding:12px;background:white;color:#0c0d0e}
    #list-layout a{color:#0074cc;text-decoration:none}
    .post-tags{padding:0;list-style:none}.post-tags li{display:inline;margin-right:4px}
    .post-tags a{display:inline-flex;align-items:center;padding:4px 6px;border-radius:4px;background:#edf0f2;font-size:13px}
    /* Stack Overflow's icon/link rows reserve 90% of the line for the link. */
    #hot-network-questions ul{margin:0;padding:0}
    #hot-network-questions li{list-style-type:none;white-space:nowrap;margin:0 0 10px}
    #hot-network-questions .favicon,#hot-network-questions a{display:inline-block;vertical-align:top}
    #hot-network-questions .favicon{width:16px;height:16px;margin:2px 6px 0 0;background:#0074cc}
    #hot-network-questions a{font-weight:normal;font-size:13px;white-space:normal;width:90%}
    </style></head><body><main>
    <p>${chinese ? "游戏版本 · 加载器 · 排序方式 · 客户端或服务端" : "Browse community extensions and tools for your game."}</p>
    ${["flex", "grid"].map(layout => `<div class="card" id="${layout}"><div class="fields ${layout}">
      <span class="title">${title}</span><span class="author">by <a href="/user/developer">developer</a></span>
      </div><div class="summary">${summary}</div></div>`).join("")}
    <div id="list-layout"><ul class="post-tags">${listTranslations.slice(2).map(([text]) =>
      `<li><a class="layout-link" href="/tag/${text}" rel="tag">${text}</a></li>`).join("")}</ul>
      <div id="hot-network-questions"><h4>Hot Network Questions</h4><ul>
        <li><div class="favicon" title="Puzzling"></div><a class="layout-link" href="/question/1">Lower your <em>expectations</em> for this puzzle</a></li>
        <li><div class="favicon" title="Mathematics"></div><a class="layout-link" href="/question/2">${listTranslations[1][0]}</a></li>
      </ul></div>
    </div>
    </main></body></html>`);
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
  await control.evaluate(async () => {
    const { data: settings } = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
    settings.activeProviderId = settings.providers.find(provider => provider.type === "google-web-translate").id;
    settings.cacheEnabled = false; settings.sourceLang = "auto"; settings.targetLang = "zh-CN";
    settings.translationDisplayMode = "replace";
    await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings });
  });
  await worker.evaluate(translations => {
    const originalFetch = globalThis.fetch;
    globalThis.cardRequests = [];
    globalThis.fetch = async (url, init) => {
      if (new URL(url).hostname !== "translate.googleapis.com") return originalFetch(url, init);
      const source = new URL(url).searchParams.get("q");
      globalThis.cardRequests.push(source);
      // Simulate the endpoint detecting a Chinese catalog as already Chinese,
      // including its embedded English descriptions. Individual items translate.
      let translated = source;
      if (!source.startsWith("Page title: 模组列表")) {
        for (const [original, target] of translations) translated = translated.replaceAll(original, target);
      }
      return new Response(JSON.stringify([[[translated, source, null, null]]]), {
        headers: { "Content-Type": "application/json" }
      });
    };
  }, translations);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const reports = [];
  for (const locale of ["en", "zh"]) {
    const url = `http://127.0.0.1:${server.address().port}/${locale}`;
    await page.goto(url);
    await page.waitForSelector("#wupage-floating-ball", { state: "attached" });
    const original = await page.locator("main").innerHTML();
    const listLinks = await page.locator(".layout-link").evaluateAll(nodes => nodes.map(node => ({
      href: node.getAttribute("href"), color: getComputedStyle(node).color
    })));
    const typography = await page.locator(".title").evaluateAll(nodes => nodes.map(node => {
      const { fontSize, fontWeight, lineHeight, color } = getComputedStyle(node);
      return { fontSize, fontWeight, lineHeight, color };
    }));
    const message = request => worker.evaluate(async ({ url, request }) => {
      const [tab] = await chrome.tabs.query({ url });
      return chrome.tabs.sendMessage(tab.id, request);
    }, { url, request });
    const result = await message({ type: "TRANSLATE_PAGE" });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.data.failed, 0);
    assert.equal(await page.locator(".summary .wupage-translation").count(), 2);
    for (const description of await page.locator(".summary .wupage-translation").allTextContents()) {
      assert.equal(description, translations[1][1], `${locale}: English descriptions must translate`);
    }
    const requestCount = await worker.evaluate(() => globalThis.cardRequests.length);
    for (const width of [1000, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const mode of ["replace", "bilingual", "bilingual-accent"]) {
        await control.evaluate(async mode => {
          const { data: settings } = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
          await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings: { ...settings, translationDisplayMode: mode } });
        }, mode);
        await page.waitForFunction(mode => [...document.querySelectorAll(".wupage-translation")]
          .every(node => node.dataset.wupageDisplayMode === mode), mode);
        assert.equal(await page.locator(".fields > .wupage-translation").count(), 0);
        assert.equal(await page.locator("#list-layout li > .wupage-translation").count(), 0);
        assert.equal(await page.locator(".layout-link .wupage-translation").count(), 5);
        assert.deepEqual(await page.locator(".layout-link").evaluateAll(nodes => nodes.map(node => ({
          href: node.getAttribute("href"), color: getComputedStyle(node).color
        }))), listLinks);
        const listLayout = await page.locator(".layout-link").evaluateAll(nodes => nodes.map(node => {
          const translation = node.querySelector(".wupage-translation");
          const box = node.getBoundingClientRect();
          const insideLink = [...translation.getClientRects()].every(rect => rect.left >= box.left - 1
            && rect.right <= box.right + 1 && rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1);
          const row = node.closest("li").getBoundingClientRect();
          return { insideLink, insideRow: box.right <= row.right + 1, color: getComputedStyle(translation).color };
        }));
        assert.ok(listLayout.every(row => row.insideLink && row.insideRow), JSON.stringify({ locale, width, mode, listLayout }));
        assert.deepEqual(await page.locator(".author a").evaluateAll(nodes => nodes.map(node => node.getAttribute("href"))),
          ["/user/developer", "/user/developer"]);
        assert.equal(await page.locator("main").evaluate(node => node.scrollWidth > node.clientWidth + 1), false);
        if (mode === "replace") {
          assert.deepEqual(listLayout.map(row => row.color), listLinks.map(link => link.color));
          const rendered = await page.locator(".title .wupage-translation").evaluateAll(nodes => nodes.map(node => {
            const { fontSize, fontWeight, lineHeight, color } = getComputedStyle(node);
            return { fontSize, fontWeight, lineHeight, color };
          }));
          assert.deepEqual(rendered, typography, "Replacement titles must retain their original typography");
          assert.deepEqual(await page.locator(".title").allTextContents(), [translations[0][1], translations[0][1]]);
        }
        assert.equal(await worker.evaluate(() => globalThis.cardRequests.length), requestCount);
        reports.push({ locale, width, mode, independentFields: true, linksPreserved: true, listLayout });
        await page.screenshot({ path: path.join(output, `${locale}-${width}-${mode}.png`) });
      }
    }
    await message({ type: "CLEAR_TRANSLATION" });
    assert.equal(await page.locator("main").innerHTML(), original);
  }
  const requests = await worker.evaluate(() => globalThis.cardRequests);
  assert.ok(requests.some(source => source.startsWith("Page title: 模组列表")), "Exercise combined language detection");
  assert.ok(requests.includes(summary), "Retry the untranslated description independently");
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(output, "report.json"), JSON.stringify({ reports, errors }, null, 2));
  console.log("PASS: localized card pages; 12 locale/viewport/mode combinations, title typography, icon/link rows, tag labels, mixed-language recovery and source restoration");
} finally {
  await context?.close();
  await new Promise(resolve => server.close(resolve));
}
