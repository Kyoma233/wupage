// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../src/shared/defaults";
import type { RuntimeRequest, RuntimeResponse } from "../src/shared/types";

describe("popup translation interactions", () => {
  let translate: ReturnType<typeof vi.fn>;
  let save: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    document.open();
    document.write(readFileSync(resolve(process.cwd(), "popup.html"), "utf8"));
    document.close();
    translate = vi.fn(async () => ({ translated: 1, cached: 0 }));
    save = vi.fn(async () => undefined);
    vi.stubGlobal("chrome", {
      runtime: { sendMessage: async (request: RuntimeRequest): Promise<RuntimeResponse> => {
        if (request.type === "GET_SETTINGS") return { ok: true, data: structuredClone(DEFAULT_SETTINGS) };
        if (request.type === "GET_OCR_STATUS") return { ok: true, data: { state: "installed", downloaded: 100, total: 100 } };
        if (request.type === "SAVE_SETTINGS") await save();
        return { ok: true };
      } },
      tabs: {
        query: async () => [{ id: 4, url: "https://example.com/article" }],
        sendMessage: vi.fn(async (_tabId: number, request: RuntimeRequest): Promise<RuntimeResponse> => {
          if (request.type === "GET_PARAGRAPH_MODE") return { ok: true, data: { enabled: false } };
          if (request.type === "GET_TRANSLATION_STATE") return { ok: true, data: { translated: false } };
          if (request.type === "TRANSLATE_PAGE") return { ok: true, data: await translate() };
          return { ok: true, data: { cleared: true } };
        })
      }
    });
    await import("../src/popup/index");
    await vi.waitFor(() => expect(button().disabled).toBe(false));
  });

  afterEach(() => {
    window.dispatchEvent(new Event("pagehide"));
    vi.unstubAllGlobals();
    document.documentElement.replaceChildren();
  });

  it("can stop a pending translation and ignores its late response", async () => {
    const pending = deferred();
    translate.mockImplementation(() => pending.promise);
    button().click();
    await vi.waitFor(() => expect(translate).toHaveBeenCalledTimes(1));
    expect(button().textContent).toBe("显示全文");
    expect(button().disabled).toBe(false);
    button().click();
    await vi.waitFor(() => expect(document.querySelector("#status")?.textContent).toBe("已显示原文。"));
    expect(button().textContent).toBe("翻译全文");
    pending.resolve({ translated: 1, cached: 0 });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(button().textContent).toBe("翻译全文");
    expect(button().classList.contains("is-loading")).toBe(false);
  });

  it("does not start a cancelled action after a delayed settings save", async () => {
    const pending = deferred();
    save.mockImplementationOnce(() => pending.promise);
    button().click();
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    button().click();
    await vi.waitFor(() => expect(button().textContent).toBe("翻译全文"));
    pending.resolve(undefined);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(translate).not.toHaveBeenCalled();
    expect(button().disabled).toBe(false);
  });

  it("keeps a restarted translation busy when the previous result arrives", async () => {
    const old = deferred();
    const current = deferred();
    translate.mockImplementationOnce(() => old.promise).mockImplementationOnce(() => current.promise);
    button().click();
    await vi.waitFor(() => expect(translate).toHaveBeenCalledTimes(1));
    button().click();
    await vi.waitFor(() => expect(document.querySelector("#status")?.textContent).toBe("已显示原文。"));
    button().click();
    await vi.waitFor(() => expect(translate).toHaveBeenCalledTimes(2));
    old.resolve({ translated: 1, cached: 0 });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(button().textContent).toBe("显示全文");
    expect(button().classList.contains("is-loading")).toBe(true);
    current.resolve({ translated: 2, cached: 0 });
    await vi.waitFor(() => expect(button().classList.contains("is-loading")).toBe(false));
    expect(document.querySelector("#status")?.textContent).toContain("已翻译 2 段");
  });

  it("keeps the original action when the active page has no completed segments", async () => {
    translate.mockResolvedValue({ translated: 0, cached: 0 });
    button().click();
    await vi.waitFor(() => expect(document.querySelector("#status")?.textContent).toContain("已翻译 0 段"));
    expect(button().textContent).toBe("显示全文");
    expect(button().disabled).toBe(false);
  });

  it("restores the action after a settings error and permits another attempt", async () => {
    save.mockRejectedValueOnce(new Error("设置保存失败"));
    button().click();
    await vi.waitFor(() => expect(document.querySelector("#status")?.textContent).toBe("设置保存失败"));
    expect(button().textContent).toBe("翻译全文");
    expect(button().disabled).toBe(false);
    expect(translate).not.toHaveBeenCalled();
    button().click();
    await vi.waitFor(() => expect(document.querySelector("#status")?.textContent).toContain("已翻译 1 段"));
  });
});

function button(): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>("#pageToggle")!;
}

function deferred(): { promise: Promise<unknown>; resolve: (value: unknown) => void } {
  let resolve!: (value: unknown) => void;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
