// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { setupLocalModelControl } from "../src/local/control";
import { LOCAL_MODELS, modelBytes } from "../src/local/models";
import type { RuntimeRequest } from "../src/shared/types";

afterEach(() => { window.dispatchEvent(new Event("pagehide")); vi.unstubAllGlobals(); document.body.replaceChildren(); });

describe("local model resource and download controls", () => {
  it("discloses resources and required pivot models before the user explicitly starts downloading", async () => {
    const container = document.createElement("div"); document.body.append(container);
    const models = LOCAL_MODELS.map((model) => ({ id: model.id, state: "missing", downloaded: 0, total: modelBytes(model) }));
    const sendMessage = vi.fn(async (request: RuntimeRequest) => {
      if (request.type === "INSTALL_LOCAL_MODEL") return { ok: true, data: null };
      return { ok: true, data: { models } };
    });
    vi.stubGlobal("chrome", { runtime: { sendMessage } });
    const dispose = setupLocalModelControl(container, "ja", "zh-CN");
    const button = container.querySelector<HTMLButtonElement>("[data-local='download']")!;
    await vi.waitFor(() => expect(button.disabled).toBe(false));
    expect(container.textContent).toContain("额外下载");
    expect(container.textContent).toContain("CPU");
    expect(container.textContent).toContain("数百 MB");
    expect(container.textContent).toContain("日语 → 英语 + 英语 → 简体中文");
    expect(container.querySelector<HTMLSelectElement>("select")!.value).toBe("ja-en");
    expect(sendMessage.mock.calls.every(([request]) => request.type === "GET_LOCAL_MODEL_STATUS")).toBe(true);
    button.click();
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith({ type: "INSTALL_LOCAL_MODEL", modelId: "ja-en" }));
    dispose();
  });
  it("selects models for the requested target language when the source is automatic", () => {
    const container = document.createElement("div"); document.body.append(container);
    vi.stubGlobal("chrome", { runtime: { sendMessage: async () => ({ ok: true, data: { models: [] } }) } });
    setupLocalModelControl(container, "auto", "en");
    expect(container.querySelector<HTMLSelectElement>("select")!.value).toBe("zh-Hans-en");
  });
});
