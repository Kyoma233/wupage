// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/shared/defaults";
import { getProviderUsage } from "../src/shared/provider-usage";
import { renderProviderUsage, updateProviderScheduling } from "../src/options/provider-usage";
import type { ProviderConfig } from "../src/shared/types";

describe("provider usage scope", () => {
  it("never applies Cloud API quotas to anonymous browser interfaces", () => {
    for (const type of ["microsoft-web-translate", "google-web-translate", "tencent-transmart", "yandex-web-translate", "volcengine-web-translate"] as const) {
      const usage = getProviderUsage({ type, id: type, label: type, serviceMode: "free", api: { apiKey: "saved-key" } });
      expect(usage.service).toContain("匿名");
      expect(usage.quota).toContain("官方未公布匿名接口配额");
      expect(usage.quota).not.toMatch(/200 万|50 万|100 万|50,000/u);
      expect(usage.sources.every(entry => !/service-limits|translate\/quotas|Productbilling/u.test(entry.url))).toBe(true);
      expect(JSON.stringify(usage)).not.toContain("saved-key");
    }
  });

  it("distinguishes MyMemory's anonymous daily characters, request bytes, and RapidAPI subscription", () => {
    const provider = { type: "mymemory", id: "mymemory", label: "MyMemory" } as const;
    const anonymous = getProviderUsage(provider);
    expect(anonymous.quota).toContain("每天 5,000 字符");
    expect(anonymous.request).toContain("500 UTF-8 字节");
    expect(anonymous.concurrency).toContain("官方未公布");
    const api = getProviderUsage({ ...provider, serviceMode: "api" });
    expect(api.service).toContain("RapidAPI");
    expect(api.quota).toContain("订阅");
    expect(api.sources.some(entry => new URL(entry.url).hostname === "rapidapi.com")).toBe(true);
  });

  it("keeps published request-rate and concurrency limits distinct", () => {
    const yandex = getProviderUsage({ type: "yandex-web-translate", id: "yandex", label: "Yandex", serviceMode: "api" });
    expect(yandex.rate).toContain("20 次/秒");
    expect(yandex.concurrency).toContain("官方未公布");
    expect(yandex.concurrency).not.toContain("20");
    const azure = getProviderUsage({ type: "microsoft-web-translate", id: "ms", label: "Microsoft", serviceMode: "api" });
    expect(azure.quota).toContain("每月 200 万字符");
    expect(azure.rate).toContain("200 万字符/小时");
    expect(azure.concurrency).toContain("无固定");
  });

  it("updates model-specific rules and declines to invent limits for custom models or endpoints", () => {
    const provider = DEFAULT_SETTINGS.providers.find(entry => entry.type === "deepseek")!;
    if (provider.type !== "deepseek") throw new Error("Missing test provider");
    expect(getProviderUsage(provider).concurrency).toContain("2,500");
    expect(getProviderUsage({ ...provider, model: "deepseek-v4-pro" }).concurrency).toContain("500");
    expect(getProviderUsage({ ...provider, model: "custom-model" }).concurrency).not.toMatch(/\d/u);
    const custom = getProviderUsage({ ...provider, baseURL: "https://api.deepseek.com.example.com/v1" });
    expect(custom.sources).toEqual([]);
    expect(custom.concurrency).not.toContain("2,500");
    const glm = DEFAULT_SETTINGS.providers.find(entry => entry.type === "zhipu-glm")!;
    if (glm.type !== "zhipu-glm") throw new Error("Missing test provider");
    expect(getProviderUsage(glm).quota).toContain("当前模型免费");
    expect(getProviderUsage({ ...glm, model: "custom-model" }).quota).not.toContain("当前模型免费");
  });

  it("only cites official OpenAI or Anthropic limits for their own hosts", () => {
    const provider = DEFAULT_SETTINGS.providers.find(entry => entry.type === "openai-compatible")!;
    if (provider.type !== "openai-compatible") throw new Error("Missing test provider");
    expect(getProviderUsage(provider).sources[0].url).toContain("developers.openai.com");
    expect(getProviderUsage({ ...provider, baseURL: "http://127.0.0.1:11434/v1" }).sources).toEqual([]);
    expect(getProviderUsage({ ...provider, type: "anthropic-compatible", baseURL: "https://api.anthropic.com/v1" }).sources[0].url).toContain("platform.claude.com");
  });
});

describe("provider usage card", () => {
  it("renders model text safely and opens official sources with safe external links", () => {
    const container = document.createElement("aside");
    const provider = { type: "deepseek", id: "deepseek", label: "DeepSeek", baseURL: "https://api.deepseek.com", apiKey: "private-key",
      model: '<img src=x onerror="alert(1)">', systemPrompt: "Translate" } as const;
    renderProviderUsage(container, provider);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain(provider.model);
    expect(container.textContent).not.toContain("private-key");
    for (const link of container.querySelectorAll("a")) {
      expect(link.protocol).toBe("https:"); expect(link.target).toBe("_blank"); expect(link.rel).toBe("noopener noreferrer");
    }
    expect(container.querySelector("time")?.dateTime).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
  });

  it("shows plugin scheduling separately, caps provider concurrency, and refreshes it without replacing official data", () => {
    const container = document.createElement("aside");
    const provider: ProviderConfig = { type: "google-web-translate", id: "google", label: "Google", performanceMode: "custom", chunkSize: 2400, concurrency: 7 };
    renderProviderUsage(container, provider);
    const official = container.querySelector("dl");
    const settings = { ...DEFAULT_SETTINGS, concurrency: 2, providers: [provider] };
    updateProviderScheduling(container, provider, settings);
    expect(container.querySelector("[data-role='provider-scheduling']")?.textContent).toContain("2,400 字符，调度并发 2");
    expect(container.querySelector("[data-role='provider-scheduling']")?.textContent).toContain("最多 4 路请求");
    updateProviderScheduling(container, provider, { ...settings, concurrency: 1 });
    expect(container.querySelector("[data-role='provider-scheduling']")?.textContent).toContain("调度并发 1");
    expect(container.querySelector("dl")).toBe(official);
  });
});
