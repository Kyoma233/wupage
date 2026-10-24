// Optional browser regression; no translation service or OCR model is required.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = path.join(root, ".npm-cache/image-resolution");
await fs.mkdir(output, { recursive: true });
await build({ stdin: { contents: `export { setImageTranslationEnabled } from "./src/content/image-translation";`,
  resolveDir: root, loader: "ts" }, bundle: true, format: "iife", globalName: "WuPageTest", outfile: path.join(output, "image.js") });
const moduleName = process.env.PLAYWRIGHT_MODULE || "playwright";
const { chromium } = await import(path.isAbsolute(moduleName) ? pathToFileURL(moduleName).href : moduleName);
// Match the viewBox-only SVG structure that triggers the browser's 300px default.
const svg = process.argv[2] ? await fs.readFile(process.argv[2], "utf8")
  : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 650">
    <g fill="none" stroke="black" stroke-width="3"><path d="M40 80H500V400H40ZM40 160H500M270 80V400M40 240H500M40 320H500"/>
    <path d="M650 80H1300V560H650ZM650 160H1300M960 80V560M650 240H1300M650 320H1300M650 400H1300M650 480H1300"/>
    <path d="M500 200H650"/></g><g font-family="serif" font-size="52"><text x="55" y="140">name</text><text x="285" y="140">value</text>
    <text x="670" y="140">index</text><text x="980" y="140">value</text><text x="1000" y="220">h</text><text x="1000" y="300">e</text>
    <text x="1000" y="380">l</text><text x="1000" y="460">l</text><text x="1000" y="540">o</text></g></svg>`;
const imageUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
const browser = await chromium.launch({ ...(process.env.PDF_TEST_BROWSER
  ? { executablePath: process.env.PDF_TEST_BROWSER } : { channel: "chromium" }), headless: true });
const reports = [];
try {
  for (const deviceScaleFactor of [1, 1.25, 2]) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setContent('<style>body{margin:20px;background:white}img{display:block;width:900px;height:auto}</style><img>');
    await page.locator("img").evaluate(async (image, src) => { image.src = src; await image.decode(); }, imageUrl);
    await page.evaluate(() => {
      window.translationRequests = [];
      window.chrome = { runtime: { id: "image-resolution-test", sendMessage: async (request) => {
        window.translationRequests.push({ type: request.type, width: request.width, height: request.height });
        return { ok: true, data: { regions: [{ box: [30, 100, 280, 150], text: "name value", translation: "名称和值",
          foreground: "black", background: "transparent", align: "left", bold: false }], targetLang: "zh-CN", cached: false } };
      } } };
    });
    await page.addScriptTag({ path: path.join(output, "image.js") });
    await page.evaluate(() => {
      WuPageTest.setImageTranslationEnabled(true);
      document.querySelector("#wupage-image-tools").shadowRoot.querySelector("button").click();
    });
    await page.waitForFunction(() => document.querySelector("#wupage-image-tools").shadowRoot.querySelector("canvas"));
    const sizes = [];
    for (const cssWidth of [900, 1200]) {
      await page.locator("img").evaluate((image, width) => { image.style.width = `${width}px`; }, cssWidth);
      await page.waitForFunction(width => {
        const canvas = document.querySelector("#wupage-image-tools").shadowRoot.querySelector("canvas");
        return canvas.width >= Math.floor(width * devicePixelRatio) && parseFloat(canvas.style.width) === width;
      }, cssWidth);
      const result = await page.evaluate(() => {
        const image = document.querySelector("img");
        const canvas = document.querySelector("#wupage-image-tools").shadowRoot.querySelector("canvas");
        const reference = document.createElement("canvas"); reference.width = canvas.width; reference.height = canvas.height;
        reference.getContext("2d").drawImage(image, 0, 0, reference.width, reference.height);
        const expected = reference.getContext("2d").getImageData(0, 0, reference.width, reference.height).data;
        const actual = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
        let differences = 0, checked = 0;
        // The right side is untouched by the mock translation. Every pixel of
        // its tables and original lettering must match a direct SVG rendering.
        for (let y = 0; y < canvas.height; y++) for (let x = Math.ceil(canvas.width * .5); x < canvas.width; x++) {
          const offset = (y * canvas.width + x) * 4;
          for (let channel = 0; channel < 4; channel++) { checked++; if (actual[offset + channel] !== expected[offset + channel]) differences++; }
        }
        return { naturalWidth: image.naturalWidth, cssWidth: image.getBoundingClientRect().width,
          width: canvas.width, height: canvas.height, differences, checked, requests: window.translationRequests.length };
      });
      assert.equal(result.naturalWidth, 300);
      assert.equal(result.differences, 0, "Untranslated SVG details were resampled from a low-resolution bitmap");
      assert.equal(result.requests, 1, "Resizing must reuse translated regions");
      sizes.push(result);
    }
    await page.screenshot({ path: path.join(output, `translated-${deviceScaleFactor}.png`) });
    await page.evaluate(() => {
      const button = document.querySelector("#wupage-image-tools").shadowRoot.querySelector("button");
      button.click(); button.click();
    });
    assert.equal(await page.evaluate(() => window.translationRequests.length), 1);
    await page.evaluate(() => WuPageTest.setImageTranslationEnabled(false));
    assert.equal(await page.locator("img").getAttribute("data-wupage-image-source-mask"), null);
    assert.deepEqual(errors, []);
    reports.push({ deviceScaleFactor, sizes });
    await page.close();
  }
  await fs.writeFile(path.join(output, "report.json"), JSON.stringify(reports, null, 2));
  console.log(JSON.stringify(reports));
} finally { await browser.close(); }
