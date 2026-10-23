// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../src/shared/defaults";
import type { RuntimeRequest, RuntimeResponse } from "../src/shared/types";

describe("popup language controls", () => {
  afterEach(() => {
    window.dispatchEvent(new Event("pagehide"));
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
    document.documentElement.replaceChildren();
  });

  it("renders and saves the source-to-target language pair", async () => {
    document.open();
    document.write(readFileSync(resolve(process.cwd(), "popup.html"), "utf8"));
    document.close();
    let stored = structuredClone(DEFAULT_SETTINGS);
    const sendMessage = vi.fn(async (request: RuntimeRequest): Promise<RuntimeResponse> => {
      if (request.type === "GET_OCR_STATUS") return { ok: true, data: { state: "installed", total: 100, downloaded: 100 } };
      if (request.type === "GET_SETTINGS") return { ok: true, data: stored };
      if (request.type === "SAVE_SETTINGS") {
        stored = structuredClone(request.settings);
        return { ok: true };
      }
      return { ok: true };
    });
    const sendTabMessage = vi.fn(async (request: RuntimeRequest): Promise<RuntimeResponse> => {
      if (request.type === "GET_PARAGRAPH_MODE") return { ok: true, data: { enabled: false } };
      if (request.type === "GET_TRANSLATION_STATE") return { ok: true, data: { translated: false } };
      return { ok: true };
    });
    const createTab = vi.fn(async () => undefined);
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage,
        openOptionsPage: vi.fn(),
        getURL: (path: string) => `chrome-extension://test-extension/${path}`
      },
      tabs: {
        query: vi.fn(async () => [{ id: 1, url: "https://example.com/paper.pdf" }]),
        sendMessage: vi.fn(async (_tabId: number, request: RuntimeRequest) => sendTabMessage(request)),
        create: createTab
      }
    });

    await import("../src/popup/index");
    await vi.waitFor(() => expect(query<HTMLButtonElement>("#pageToggle").textContent).toBe("翻译 PDF"));
    expect(sendTabMessage).not.toHaveBeenCalled();

    const source = query<HTMLSelectElement>("#sourceLang");
    const target = query<HTMLSelectElement>("#targetLang");
    expect(source.selectedOptions[0]?.textContent).toBe("自动检测");
    expect(target.value).toBe("zh-CN");
    expect(query<HTMLSelectElement>("#translationDisplayMode").selectedOptions[0]?.textContent)
      .toBe("原色对照");
    expect(query<HTMLButtonElement>("#pageToggle").textContent).toBe("翻译 PDF");
    expect(document.querySelector("#pdfTranslate")).toBeNull();
    const imageToggle = query<HTMLButtonElement>("#imageTranslation");
    expect(imageToggle.getAttribute("aria-pressed")).toBe("false");
    imageToggle.click();
    await vi.waitFor(() => {
      expect(stored.imageTranslationEnabled).toBe(true);
      expect(imageToggle.getAttribute("aria-pressed")).toBe("true");
      expect(imageToggle.disabled).toBe(false);
    });
    imageToggle.click();
    await vi.waitFor(() => expect(stored.imageTranslationEnabled).toBe(false));

    source.value = "en";
    target.value = "ja";
    query<HTMLSelectElement>("#translationDisplayMode").value = "replace";
    target.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => {
      expect(stored).toMatchObject({
        sourceLang: "en",
        targetLang: "ja",
        translationDisplayMode: "replace"
      });
    });

    query<HTMLButtonElement>("#openGithub").click();
    query<HTMLButtonElement>("#openWebsite").click();
    expect(createTab).toHaveBeenCalledWith({ url: "https://github.com/mr-wuliu/wupage" });
    expect(createTab).toHaveBeenCalledWith({ url: "https://wupage.mrwuliu.top/" });
    createTab.mockClear();

    vi.spyOn(window, "close").mockImplementation(() => undefined);
    query<HTMLButtonElement>("#pageToggle").click();
    await vi.waitFor(() => {
      expect(createTab).toHaveBeenCalledWith({
        url: "chrome-extension://test-extension/pdf.html?url=https%3A%2F%2Fexample.com%2Fpaper.pdf&translate=1"
      });
    });
  });

  it("does not message Edge settings and extension-internal pages", async () => {
    document.open();
    document.write(readFileSync(resolve(process.cwd(), "popup.html"), "utf8"));
    document.close();
    const sendMessage = vi.fn(async (request: RuntimeRequest): Promise<RuntimeResponse> => {
      if (request.type === "GET_OCR_STATUS") return { ok: true, data: { state: "installed", total: 100, downloaded: 100 } };
      if (request.type === "GET_SETTINGS") return { ok: true, data: structuredClone(DEFAULT_SETTINGS) };
      return { ok: true };
    });
    const sendTabMessage = vi.fn(async (): Promise<RuntimeResponse> => ({ ok: true }));
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage,
        openOptionsPage: vi.fn(),
        getURL: (path: string) => `chrome-extension://test-extension/${path}`
      },
      tabs: {
        query: vi.fn(async () => [{ id: 2, url: "edge://extensions/" }]),
        sendMessage: sendTabMessage,
        create: vi.fn()
      }
    });

    await import("../src/popup/index");
    await vi.waitFor(() => {
      expect(query<HTMLElement>("#status").textContent)
        .toBe("此页面不支持全文翻译，可点击“打开 PDF”导入文档。");
    });

    expect(query<HTMLButtonElement>("#pageToggle").disabled).toBe(true);
    expect(query<HTMLButtonElement>("#paragraphMode").disabled).toBe(true);
    expect(query<HTMLButtonElement>("#debug").disabled).toBe(true);
    expect(sendTabMessage).not.toHaveBeenCalled();

    vi.spyOn(window, "close").mockImplementation(() => undefined);
    const openPdf = query<HTMLButtonElement>("#openPdf");
    expect(openPdf.disabled).toBe(false);
    openPdf.click();
    await vi.waitFor(() => expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: "chrome-extension://test-extension/pdf.html"
    }));
  });

  it.each(["file:///C:/Documents/Annual%20report.PDF#page=2", undefined])(
    "opens a PDF workspace when the active tab is %s", async (url) => {
      document.open();
      document.write(readFileSync(resolve(process.cwd(), "popup.html"), "utf8"));
      document.close();
      const sendMessage = vi.fn(async (request: RuntimeRequest): Promise<RuntimeResponse> => {
        if (request.type === "GET_OCR_STATUS") return { ok: true, data: { state: "installed", total: 100, downloaded: 100 } };
        if (request.type === "GET_SETTINGS") return { ok: true, data: structuredClone(DEFAULT_SETTINGS) };
        return { ok: true };
      });
      const createTab = vi.fn(async () => undefined);
      const sendToTab = vi.fn();
      vi.stubGlobal("chrome", {
        runtime: { sendMessage, getURL: (path: string) => `chrome-extension://test-extension/${path}` },
        tabs: { query: vi.fn(async () => [{ id: 3, url }]), sendMessage: sendToTab, create: createTab }
      });
      vi.spyOn(window, "close").mockImplementation(() => undefined);

      await import("../src/popup/index");
      await vi.waitFor(() => expect(query<HTMLSelectElement>("#provider").options.length).toBeGreaterThan(0));
      if (url) {
        const translate = query<HTMLButtonElement>("#pageToggle");
        expect(translate.textContent).toBe("翻译 PDF");
        expect(translate.disabled).toBe(false);
        translate.click();
        await vi.waitFor(() => expect(createTab).toHaveBeenCalledWith({
          url: `chrome-extension://test-extension/pdf.html?url=${encodeURIComponent(url)}&translate=1`
        }));
        createTab.mockClear();
      } else {
        expect(query<HTMLButtonElement>("#pageToggle").disabled).toBe(true);
      }
      query<HTMLButtonElement>("#openPdf").click();
      await vi.waitFor(() => expect(createTab).toHaveBeenCalledWith({
        url: "chrome-extension://test-extension/pdf.html"
      }));
      expect(sendToTab).not.toHaveBeenCalled();
    }
  );
});

function query<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}
