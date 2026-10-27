import { afterEach, describe, expect, it, vi } from "vitest";
import { createProvider } from "../src/background/providers";
import type { ProviderConfig } from "../src/shared/types";

const configs: ProviderConfig[] = [
  { type: "tencent-transmart", id: "tencent-transmart", label: "腾讯 TranSmart" },
  { type: "yandex-web-translate", id: "yandex-web-translate", label: "Yandex 免费翻译" },
  { type: "volcengine-web-translate", id: "volcengine-web-translate", label: "火山免费翻译" },
  { type: "mymemory", id: "mymemory", label: "MyMemory" }
];

afterEach(() => { vi.unstubAllGlobals(); });

function reply(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

describe.each(configs)("$label", config => {
  const provider = createProvider(config);

  it("requires no user credentials and skips an empty batch", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect(provider.validateConfig()).toEqual({ ok: true });
    expect(await provider.translateBatch({ texts: [], targetLang: "zh-CN" })).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards cancellation and does not dispatch later items", async () => {
    const fetch = vi.fn((_url, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener("abort", () => reject(init.signal!.reason), { once: true });
    }));
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    const result = provider.translateBatch({ texts: ["First", "Second"], sourceLang: "en", targetLang: "zh-CN" }, controller.signal);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(provider.translateBatch({ texts: ["Third"], targetLang: "zh-CN" }, controller.signal))
      .rejects.toMatchObject({ name: "AbortError" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reports rate limits without sending text to another service", async () => {
    const fetch = vi.fn().mockResolvedValue(reply({}, 429));
    vi.stubGlobal("fetch", fetch);
    await expect(provider.translateBatch({ texts: ["Hello"], sourceLang: "en", targetLang: "zh-CN" }))
      .rejects.toThrow(config.type === "mymemory" ? "额度" : "429");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([{}, null, { text: [] }, { responseStatus: 200, responseData: { translatedText: "" } }])(
    "rejects invalid responses: %j", async payload => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(payload)));
      await expect(provider.translateBatch({ texts: ["Hello"], sourceLang: "en", targetLang: "zh-CN" })).rejects.toThrow();
    }
  );
});

describe("public translation request formats", () => {
  it("sends and validates Tencent batches without cookies or a preset account key", async () => {
    const fetch = vi.fn().mockResolvedValue(reply({ header: { ret_code: "succ" }, auto_translation: ["你好", "世界"] }));
    vi.stubGlobal("fetch", fetch);
    expect(await createProvider(configs[0]).translateBatch({ texts: ["Hello", "World"], targetLang: "zh-CN" }))
      .toEqual(["你好", "世界"]);
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://transmart.qq.com/api/imt");
    expect(init.credentials).toBe("omit");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(String(init.body))).toMatchObject({
      header: { fn: "auto_translation", client_key: expect.stringMatching(/^browser-chrome-.*[0-9a-f-]{36}-\d+$/) },
      source: { text_list: ["Hello", "World"], lang: "auto" }, target: { lang: "zh" }
    });
    fetch.mockResolvedValueOnce(reply({ header: { ret_code: "succ" }, auto_translation: ["缺项"] }));
    await expect(createProvider(configs[0]).translateBatch({ texts: ["Hello", "World"], targetLang: "zh-CN" })).rejects.toThrow();
  });

  it("preserves Yandex paragraph order and omits source language for automatic detection", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply({ code: 200, text: ["你好"] }))
      .mockResolvedValueOnce(reply({ code: 200, text: ["世界"] }));
    vi.stubGlobal("fetch", fetch);
    expect(await createProvider(configs[1]).translateBatch({ texts: ["Hello", "World"], targetLang: "zh-CN" }))
      .toEqual(["你好", "世界"]);
    expect(fetch.mock.calls.map(([url]) => new URL(url).searchParams.get("text"))).toEqual(["Hello", "World"]);
    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.searchParams.get("target_lang")).toBe("zh");
    expect(url.searchParams.has("source_lang")).toBe(false);
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: "POST", credentials: "omit" });
  });

  it("keeps Volcengine paragraphs separate and respects application errors", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply({ base_resp: { status_code: 0 }, translation: "你好" }))
      .mockResolvedValueOnce(reply({ base_resp: { status_code: 0 }, translation: "世界" }));
    vi.stubGlobal("fetch", fetch);
    expect(await createProvider(configs[2]).translateBatch({ texts: ["Hello", "World"], sourceLang: "en", targetLang: "zh-CN" }))
      .toEqual(["你好", "世界"]);
    expect(fetch.mock.calls.map(([, init]) => JSON.parse(init.body))).toEqual([
      { source_language: "en", target_language: "zh", text: "Hello" },
      { source_language: "en", target_language: "zh", text: "World" }
    ]);
    fetch.mockResolvedValueOnce(reply({ base_resp: { status_code: 1 }, translation: "不可缓存" }));
    await expect(createProvider(configs[2]).translateBatch({ texts: ["Hello"], targetLang: "zh-CN" })).rejects.toThrow("暂时不可用");
  });
});

describe("MyMemory constraints", () => {
  const provider = createProvider(configs[3]);

  function echo(): ReturnType<typeof vi.fn> {
    const fetch = vi.fn(async (url: string) => reply({ responseStatus: 200,
      responseData: { translatedText: new URL(url).searchParams.get("q") } }));
    vi.stubGlobal("fetch", fetch);
    return fetch;
  }

  it("splits long multilingual text within 500 UTF-8 bytes and retains whitespace and placeholders", async () => {
    const fetch = echo();
    const text = "  " + ("中文测试🙂 word ").repeat(110) + "⟪WUPAGE0⟫ &lt;div&gt;\n";
    expect(await provider.translateBatch({ texts: [text], sourceLang: "zh-CN", targetLang: "en" })).toEqual([text]);
    expect(fetch.mock.calls.length).toBeGreaterThan(2);
    for (const [value] of fetch.mock.calls) {
      const url = new URL(value);
      expect(new TextEncoder().encode(url.searchParams.get("q")!).byteLength).toBeLessThanOrEqual(500);
      expect(url.searchParams.get("q")).not.toContain("�");
      expect(url.searchParams.get("langpair")).toBe("zh-CN|en");
      expect(url.searchParams.has("key")).toBe(false);
      expect(url.searchParams.has("de")).toBe(false);
    }
  });

  it("uses local language detection for an automatic source", async () => {
    const fetch = echo();
    vi.stubGlobal("chrome", { i18n: { detectLanguage: vi.fn(async () => ({ languages: [{ language: "en", percentage: 100 }] })) } });
    expect(await provider.translateBatch({ texts: ["Hello world"], sourceLang: "auto", targetLang: "zh-CN" })).toEqual(["Hello world"]);
    expect(new URL(fetch.mock.calls[0][0]).searchParams.get("langpair")).toBe("en|zh-CN");
  });

  it("asks for a source language when local detection is uncertain without using quota", async () => {
    const fetch = echo();
    vi.stubGlobal("chrome", { i18n: { detectLanguage: async () => ({ languages: [{ language: "und", percentage: 20 }] }) } });
    await expect(provider.translateBatch({ texts: ["abc"], targetLang: "zh-CN" })).rejects.toThrow("手动选择");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns same-language text locally without using quota", async () => {
    const fetch = echo();
    expect(await provider.translateBatch({ texts: ["原文"], sourceLang: "zh", targetLang: "zh-CN" })).toEqual(["原文"]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports a daily quota failure instead of accepting its warning as a translation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ responseStatus: 403, quotaFinished: true,
      responseData: { translatedText: "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY" } })));
    await expect(provider.translateBatch({ texts: ["Hello"], sourceLang: "en", targetLang: "zh-CN" })).rejects.toThrow("额度已用完");
  });
});
