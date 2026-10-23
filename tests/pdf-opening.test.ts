// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../src/shared/defaults";
import type { RuntimeRequest, RuntimeResponse } from "../src/shared/types";

const { getDocument } = vi.hoisted(() => ({ getDocument: vi.fn() }));
vi.mock("pdfjs-dist", () => ({ GlobalWorkerOptions: {}, TextLayer: vi.fn(), getDocument }));

describe("PDF source opening", () => {
  let fileAccess: ReturnType<typeof vi.fn>;
  let fetchPdf: ReturnType<typeof vi.fn>;
  let sendMessage: ReturnType<typeof vi.fn>;
  const fileUrl = "file:///C:/Reports/Annual%20report.pdf#page=2";

  beforeEach(() => {
    document.open();
    document.write(readFileSync(resolve(process.cwd(), "pdf.html"), "utf8"));
    document.close();
    window.history.replaceState({}, "", "/pdf.html");
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    vi.stubGlobal("IntersectionObserver", class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    });
    const page = {
      getViewport: () => ({ width: 612, height: 792 }),
      getTextContent: async () => ({
        items: [{ str: "A paragraph for translation.", transform: [1, 0, 0, 12, 10, 100], width: 180, fontName: "font" }],
        styles: { font: { fontFamily: "Arial" } }
      })
    };
    getDocument.mockReset().mockReturnValue({
      promise: Promise.resolve({ numPages: 1, getPage: async () => page }),
      destroy: vi.fn(async () => undefined)
    });
    fileAccess = vi.fn(async () => true);
    sendMessage = vi.fn(async (request: RuntimeRequest): Promise<RuntimeResponse> => {
      if (request.type === "GET_SETTINGS") return { ok: true, data: structuredClone(DEFAULT_SETTINGS) };
      if (request.type === "TRANSLATE_BATCH") return { ok: true, data: { translations: ["一段用于翻译的文字。"], cached: 0 } };
      return { ok: true };
    });
    vi.stubGlobal("chrome", {
      runtime: { id: "test-extension", sendMessage },
      extension: { isAllowedFileSchemeAccess: fileAccess },
      tabs: { create: vi.fn(async () => undefined) }
    });
    fetchPdf = vi.fn(async () => new Response("%PDF-test", { headers: { "content-type": "application/pdf" } }));
    vi.stubGlobal("fetch", fetchPdf);
  });

  afterEach(() => {
    document.querySelectorAll<HTMLElement>("[data-timer]").forEach((element) => {
      window.clearTimeout(Number(element.dataset.timer));
    });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
    document.documentElement.replaceChildren();
    window.history.replaceState({}, "", "/");
  });

  async function launch(url: string, autoTranslate = true): Promise<void> {
    window.history.replaceState({}, "", `/pdf.html?url=${encodeURIComponent(url)}&translate=${autoTranslate ? 1 : 0}`);
    await import("../src/pdf/index");
  }

  function translated(): boolean {
    return sendMessage.mock.calls.some(([request]) => (request as RuntimeRequest).type === "TRANSLATE_BATCH");
  }

  it("reads and automatically translates a permitted local PDF", async () => {
    await launch(fileUrl);
    await vi.waitFor(() => expect(translated()).toBe(true));
    expect(fileAccess).toHaveBeenCalledOnce();
    expect(fetchPdf).toHaveBeenCalledWith(fileUrl, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(getDocument).toHaveBeenCalledWith({ data: expect.any(Uint8Array) });
    expect(document.querySelector("#documentName")?.textContent).toBe("Annual report.pdf");
    expect(document.querySelector<HTMLElement>("#readerView")?.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>("#fileAccessNotice")?.hidden).toBe(true);
  });

  it("does not read a file before permission, then retries the same PDF and translation", async () => {
    fileAccess.mockResolvedValue(false);
    await launch(fileUrl);
    await vi.waitFor(() => expect(document.querySelector<HTMLElement>("#fileAccessNotice")?.hidden).toBe(false));
    expect(fetchPdf).not.toHaveBeenCalled();
    expect(getDocument).not.toHaveBeenCalled();
    expect(translated()).toBe(false);

    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue("Chrome/130 Edg/130");
    document.querySelector<HTMLButtonElement>("#openFileAccessSettings")!.click();
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: "edge://extensions/?id=test-extension" });
    fileAccess.mockResolvedValue(true);
    document.querySelector<HTMLButtonElement>("#retryLocalPdf")!.click();
    await vi.waitFor(() => expect(translated()).toBe(true));
    expect(fetchPdf).toHaveBeenCalledWith(fileUrl, expect.anything());
    expect(document.querySelector<HTMLElement>("#fileAccessNotice")?.hidden).toBe(true);
  });

  it("lets the user select the local file without granting file URL access", async () => {
    fileAccess.mockResolvedValue(false);
    await launch(fileUrl);
    await vi.waitFor(() => expect(document.querySelector<HTMLElement>("#fileAccessNotice")?.hidden).toBe(false));
    const file = new File(["%PDF-test"], "selected.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "arrayBuffer", { value: async () => new TextEncoder().encode("%PDF-test").buffer });
    const input = document.querySelector<HTMLInputElement>("#fileInput")!;
    Object.defineProperty(input, "files", { value: [file] });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => expect(translated()).toBe(true));
    expect(fetchPdf).not.toHaveBeenCalled();
    expect(document.querySelector("#documentName")?.textContent).toBe("selected.pdf");
    expect(document.querySelector<HTMLElement>("#fileAccessNotice")?.hidden).toBe(true);
  });

  it("still opens online PDFs without checking local file permission", async () => {
    fileAccess.mockResolvedValue(false);
    await launch("https://example.com/report.pdf");
    await vi.waitFor(() => expect(translated()).toBe(true));
    expect(fileAccess).not.toHaveBeenCalled();
  });

  it("keeps manually opened files idle until the user asks for translation", async () => {
    await launch(fileUrl, false);
    await vi.waitFor(() => expect(document.querySelector<HTMLElement>("#readerView")?.hidden).toBe(false));
    expect(translated()).toBe(false);
    document.querySelector<HTMLButtonElement>("#translateDocument")!.click();
    await vi.waitFor(() => expect(translated()).toBe(true));
  });

  it("reports a missing local file without attempting translation", async () => {
    fetchPdf.mockRejectedValue(new Error("File not found"));
    await launch(fileUrl);
    await vi.waitFor(() => expect(document.querySelector("#statusToast")?.textContent).toContain("File not found"));
    expect(getDocument).not.toHaveBeenCalled();
    expect(translated()).toBe(false);
    expect(document.querySelector<HTMLElement>("#loadingOverlay")?.hidden).toBe(true);
  });

  it("rejects unsupported URL schemes before making a request", async () => {
    await launch("data:application/pdf;base64,JVBERg==");
    await vi.waitFor(() => expect(document.querySelector("#statusToast")?.textContent).toContain("仅支持"));
    expect(fetchPdf).not.toHaveBeenCalled();
  });
});
