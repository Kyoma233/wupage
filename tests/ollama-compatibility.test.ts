import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenAICompatibleConfig } from "../src/shared/types";

const config: OpenAICompatibleConfig = {
  type: "openai-compatible", id: "ollama", label: "Ollama", baseURL: "http://[::1]:11434/v1",
  apiKey: "test-secret", model: "local-model", systemPrompt: "Translate to {{targetLang}}"
};
let compatibility: typeof import("../src/background/ollama-compatibility");
let rules: chrome.declarativeNetRequest.Rule[];
let updateRules: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();
  rules = [];
  updateRules = vi.fn(async (options: Parameters<typeof chrome.declarativeNetRequest.updateSessionRules>[0]) => {
    rules = rules.filter((rule) => !options.removeRuleIds?.includes(rule.id));
    rules.push(...(options.addRules ?? []));
  });
  vi.stubGlobal("chrome", {
    runtime: { id: "test-extension" },
    declarativeNetRequest: { getSessionRules: vi.fn(async () => [...rules]), updateSessionRules: updateRules }
  });
  compatibility = await import("../src/background/ollama-compatibility");
});

afterEach(() => vi.unstubAllGlobals());

describe("OpenAI endpoint compatibility", () => {
  it.each([
    ["http://[::1]:11434", "http://[::1]:11434/v1/chat/completions"],
    ["http://[2001:db8::1]:11434/v1/", "http://[2001:db8::1]:11434/v1/chat/completions"],
    ["http://[::1]:11434/v1/chat/completions/", "http://[::1]:11434/v1/chat/completions"],
    ["http://127.0.0.1:11434/", "http://127.0.0.1:11434/v1/chat/completions"],
    ["http://localhost:11434/v1", "http://localhost:11434/v1/chat/completions"],
    ["https://example.com/proxy/v1/chat/completions?key=test", "https://example.com/proxy/v1/chat/completions?key=test"],
    ["https://api.deepseek.com", "https://api.deepseek.com/chat/completions"],
    ["https://api.openai.com/v1", "https://api.openai.com/v1/chat/completions"]
  ])("normalizes %s", (input, endpoint) => {
    expect(compatibility.chatCompletionsEndpoint(input)).toBe(endpoint);
  });

  it("defaults compatibility on regardless of port and honors explicit opt-out", () => {
    expect(compatibility.usesOllamaCompatibility(config)).toBe(true);
    expect(compatibility.usesOllamaCompatibility({ ...config, baseURL: "http://[::1]:12345/v1" })).toBe(true);
    expect(compatibility.usesOllamaCompatibility({ ...config, baseURL: "https://api.openai.com/v1" })).toBe(true);
    expect(compatibility.usesOllamaCompatibility({ ...config, ollamaCompatibility: false })).toBe(false);
    expect(compatibility.usesOllamaCompatibility({ ...config, ollamaCompatibility: true })).toBe(true);
  });

  it("rejects non-HTTP endpoints", () => {
    expect(() => compatibility.chatCompletionsEndpoint("file:///v1")).toThrow("HTTP");
  });

  it("adds Ollama's v1 path on a custom port when explicitly enabled", () => {
    expect(compatibility.chatCompletionsEndpoint("http://[::1]:12345", true))
      .toBe("http://[::1]:12345/v1/chat/completions");
  });
});

describe("Ollama request origin compatibility", () => {
  const endpoint = "http://[::1]:11434/v1/chat/completions?key=test";

  it("limits the rule to this extension's exact POST endpoint and removes it after completion", async () => {
    await compatibility.withOllamaCompatibility(endpoint, async () => {
      expect(rules).toHaveLength(1);
      expect(rules[0].condition).toMatchObject({
        initiatorDomains: ["test-extension"], requestMethods: ["post"], resourceTypes: ["xmlhttprequest"]
      });
      expect(rules[0].action.requestHeaders).toEqual([{ header: "origin", operation: "remove" }]);
      const matches = new RegExp(rules[0].condition.regexFilter!);
      expect(matches.test(endpoint)).toBe(true);
      expect(matches.test(endpoint + "&other=1")).toBe(false);
      expect(matches.test(endpoint.replace("[::1]", "other.example"))).toBe(false);
      return "translated";
    });
    expect(rules).toEqual([]);
  });

  it("keeps a shared rule until all concurrent requests finish", async () => {
    let finishFirst!: () => void;
    let finishSecond!: () => void;
    const firstReady = new Promise<void>((resolve) => { finishFirst = resolve; });
    const secondReady = new Promise<void>((resolve) => { finishSecond = resolve; });
    let started = 0;
    const first = compatibility.withOllamaCompatibility(endpoint, async () => { started++; await firstReady; });
    const second = compatibility.withOllamaCompatibility(endpoint, async () => { started++; await secondReady; });
    await vi.waitFor(() => expect(started).toBe(2));
    expect(rules).toHaveLength(1);
    finishFirst();
    await first;
    expect(rules).toHaveLength(1);
    finishSecond();
    await second;
    expect(rules).toEqual([]);
  });

  it("cleans up on request failure and can process subsequent requests", async () => {
    await expect(compatibility.withOllamaCompatibility(endpoint, async () => { throw new DOMException("Cancelled", "AbortError"); }))
      .rejects.toThrow("Cancelled");
    expect(rules).toEqual([]);
    await expect(compatibility.withOllamaCompatibility(endpoint, async () => "ok")).resolves.toBe("ok");
    expect(rules).toEqual([]);
  });

  it("removes abandoned rules after a worker restart while preserving unrelated rules", async () => {
    rules = [{ id: 100_100 }, { id: 42 }] as chrome.declarativeNetRequest.Rule[];
    await compatibility.withOllamaCompatibility(endpoint, async () => {
      expect(rules.map((rule) => rule.id)).toEqual([42, 100_000]);
    });
    expect(rules.map((rule) => rule.id)).toEqual([42]);
  });

  it("clears abandoned rules at startup even before another Ollama request", async () => {
    rules = [{ id: 100_200 }, { id: 42 }] as chrome.declarativeNetRequest.Rule[];
    await compatibility.initializeOllamaCompatibility();
    expect(rules.map((rule) => rule.id)).toEqual([42]);
  });

  it("never sends a request when the compatibility rule cannot be installed", async () => {
    updateRules.mockRejectedValueOnce(new Error("Permission missing"));
    const send = vi.fn();
    await expect(compatibility.withOllamaCompatibility(endpoint, send)).rejects.toThrow("Permission missing");
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    ["http://[::1]:11434/v1/chat/completions", "http://[::1]:11434/v1/chat/completions"],
    ["http://[::1]:12345", "http://[::1]:12345/v1/chat/completions"],
    ["http://127.0.0.1:12345/v1", "http://127.0.0.1:12345/v1/chat/completions"],
    ["https://example.com/proxy/v1", "https://example.com/proxy/v1/chat/completions"]
  ])("defaults compatibility on for %s and preserves the API key and payload", async (baseURL, endpoint) => {
    const fetchMock = vi.fn(async () => {
      expect(rules).toHaveLength(1);
      return new Response(JSON.stringify({ choices: [{ message: { content: '["你好"]' } }] }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const { createProvider } = await import("../src/background/providers");
    const provider = createProvider({ ...config, baseURL });
    await expect(provider.translateBatch({ texts: ["Hello"], targetLang: "zh-CN" })).resolves.toEqual(["你好"]);
    const [url, request] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(endpoint);
    expect(request.headers).toMatchObject({ Authorization: "Bearer test-secret", "Content-Type": "application/json" });
    expect(JSON.parse(String(request.body)).model).toBe("local-model");
    expect(rules).toEqual([]);
  });

  it("honors explicit opt-out without installing request rules", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: '["你好"]' } }] }))));
    const { createProvider } = await import("../src/background/providers");
    await createProvider({ ...config, baseURL: "http://[::1]:12345/v1", ollamaCompatibility: false })
      .translateBatch({ texts: ["Hello"], targetLang: "zh-CN" });
    expect(updateRules).not.toHaveBeenCalled();
  });
});
