// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../src/shared/defaults";
import { normalizeSettings } from "../src/shared/settings";
import type { ExtensionSettings, RuntimeRequest, RuntimeResponse } from "../src/shared/types";

describe("options provider controls", () => {
  afterEach(() => {
    window.dispatchEvent(new Event("pagehide"));
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
    delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
    document.documentElement?.replaceChildren();
  });

  it("adds, toggles, and deletes a custom Anthropic provider", async () => {
    document.open();
    document.write(readFileSync(resolve(process.cwd(), "options.html"), "utf8"));
    document.close();
    let stored = cloneSettings(DEFAULT_SETTINGS);
    const sendMessage = vi.fn(async (request: RuntimeRequest): Promise<RuntimeResponse> => {
      if (request.type === "GET_OCR_STATUS") return { ok: true, data: { state: "installed", total: 100, downloaded: 100 } };
      if (request.type === "GET_SETTINGS") return { ok: true, data: stored };
      if (request.type === "SAVE_SETTINGS") {
        stored = normalizeSettings(request.settings);
        return { ok: true, data: null };
      }
      return { ok: true, data: null };
    });
    vi.stubGlobal("chrome", { runtime: { sendMessage } });
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute("open", "");
      }
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute("open");
      }
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    await import("../src/options/index");
    await vi.waitFor(() => {
      expect(document.querySelector("#providerTriggerLabel")?.textContent)
        .toBe("Google Web Translate");
    });
    expect(query<HTMLSelectElement>("#sourceLang").value).toBe("auto");
    expect(query<HTMLSelectElement>("#sourceLang").selectedOptions[0]?.textContent)
      .toBe("自动检测");
    expect(query<HTMLSelectElement>("#translationDisplayMode").selectedOptions[0]?.textContent)
      .toBe("原色对照");
    expect(query<HTMLSelectElement>("#pdfTranslationScope").value).toBe("nearby");
    expect(query<HTMLInputElement>("#pdfTranslationPageRadius").value).toBe("5");
    query<HTMLInputElement>("#pdfTranslationPageRadius").value = "2";
    click("#save");
    await vi.waitFor(() => expect(stored.pdfTranslationPageRadius).toBe(2));
    query<HTMLSelectElement>("#pdfTranslationScope").value = "unlimited";
    query<HTMLSelectElement>("#pdfTranslationScope").dispatchEvent(new Event("change"));
    expect(query<HTMLElement>("#pdfTranslationPageRadiusField").hidden).toBe(true);
    expect(query<HTMLElement>("#pdfTranslationScopeDescription").textContent).toContain("翻译整份 PDF");
    click("#save");
    await vi.waitFor(() => expect(stored.pdfTranslationPageRadius).toBeNull());
    query<HTMLSelectElement>("#pdfTranslationScope").value = "nearby";
    query<HTMLSelectElement>("#pdfTranslationScope").dispatchEvent(new Event("change"));
    expect(query<HTMLInputElement>("#pdfTranslationPageRadius").disabled).toBe(false);
    expect(query<HTMLElement>("#pdfTranslationScopeDescription").textContent).toContain("滚动后自动补译");
    query<HTMLInputElement>("#pdfTranslationPageRadius").value = "0";
    click("#save");
    await vi.waitFor(() => expect(stored.pdfTranslationPageRadius).toBe(0));
    query<HTMLSelectElement>("#translationDisplayMode").value = "bilingual-accent";
    query<HTMLSelectElement>("#sourceLang").value = "en";
    click("#save");
    await vi.waitFor(() => expect(stored).toMatchObject({
      sourceLang: "en",
      translationDisplayMode: "bilingual-accent"
    }));
    const translateCodeComments = query<HTMLInputElement>("#translateCodeComments");
    expect(translateCodeComments.checked).toBe(true);
    const imageTranslation = query<HTMLInputElement>("#imageTranslationEnabled");
    expect(imageTranslation.checked).toBe(false);
    imageTranslation.click();
    click("#save");
    await vi.waitFor(() => expect(stored.imageTranslationEnabled).toBe(true));
    translateCodeComments.click();
    click("#save");
    await vi.waitFor(() => expect(stored.translateCodeComments).toBe(false));
    const inheritPerformance = query<HTMLInputElement>("[data-field='inheritPerformance']");
    expect(inheritPerformance.checked).toBe(true);
    inheritPerformance.click();
    expect(query<HTMLElement>("[data-role='performanceOverrides']").hidden).toBe(false);
    query<HTMLInputElement>("[data-field='chunkSize']").value = "800";
    query<HTMLInputElement>("[data-field='concurrency']").value = "2";
    click("#save");
    await vi.waitFor(() => {
      expect(stored.providers.find((entry) => entry.id === "google-web-translate"))
        .toMatchObject({ performanceMode: "custom", chunkSize: 800, concurrency: 2 });
    });

    click("#providerTrigger");
    expect(document.querySelectorAll(".provider-menu-row")).toHaveLength(DEFAULT_SETTINGS.providers.length);
    expect(document.querySelectorAll(".provider-enable")).toHaveLength(DEFAULT_SETTINGS.providers.length);
    expect(document.querySelectorAll(".provider-delete")).toHaveLength(0);
    expect(document.querySelectorAll(".provider-option-type")).toHaveLength(0);

    click("[data-action='select'][data-provider-id='deepseek']");
    await vi.waitFor(() => {
      expect(document.querySelector("#providerTriggerLabel")?.textContent).toBe("DeepSeek");
    });
    expect(query<HTMLInputElement>("[data-field='baseURL']").value)
      .toBe("https://api.deepseek.com");
    expect(query<HTMLSelectElement>("[data-field='model']").value).toBe("deepseek-flash");
    expect(Array.from(query<HTMLSelectElement>("[data-field='model']").options, (option) => option.value))
      .toEqual(["deepseek-flash", "deepseek-v4-pro"]);
    for (const model of ["deepseek-v4-pro", "deepseek-flash"]) {
      query<HTMLSelectElement>("[data-field='model']").value = model;
      click("#save");
      await vi.waitFor(() => {
        expect(stored.providers.find((entry) => entry.id === "deepseek"))
          .toMatchObject({ model });
      });
    }
    click("#providerTrigger");
    click("[data-action='select'][data-provider-id='google-web-translate']");
    await vi.waitFor(() => {
      expect(document.querySelector("#providerTriggerLabel")?.textContent)
        .toBe("Google Web Translate");
    });

    click("#addProvider");
    expect(document.querySelector("#providerDialog")?.hasAttribute("open")).toBe(true);
    const kind = query<HTMLSelectElement>("#customProviderKind");
    kind.value = "llm";
    kind.dispatchEvent(new Event("change", { bubbles: true }));
    expect(query<HTMLLabelElement>("#customLlmFormatField").hidden).toBe(false);
    query<HTMLInputElement>("#customProviderName").value = "My Anthropic";
    query<HTMLSelectElement>("#customLlmFormat").value = "anthropic";
    query<HTMLFormElement>("#providerDialogForm").dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );

    await vi.waitFor(() => {
      expect(document.querySelector("#providerTriggerLabel")?.textContent).toBe("My Anthropic");
    });
    expect(stored.providers).toHaveLength(DEFAULT_SETTINGS.providers.length + 1);
    expect(stored.providers.find((provider) => provider.id === stored.activeProviderId)?.type)
      .toBe("anthropic-compatible");

    click("#providerTrigger");
    expect(document.querySelectorAll(".provider-delete")).toHaveLength(1);
    const customId = stored.activeProviderId;
    click(`[data-action="toggle"][data-provider-id="${customId}"]`);
    await vi.waitFor(() => expect(stored.activeProviderId).toBe("google-web-translate"));
    expect(stored.providers.find((provider) => provider.id === customId)?.enabled).toBe(false);

    click(`[data-action="delete"][data-provider-id="${customId}"]`);
    await vi.waitFor(() => {
      expect(stored.providers).toHaveLength(DEFAULT_SETTINGS.providers.length);
      expect(document.querySelectorAll(".provider-delete")).toHaveLength(0);
    });

    click("#providerTrigger");
    click("[data-action='select'][data-provider-id='openai-compatible']");
    await vi.waitFor(() => expect(document.querySelector("#providerTriggerLabel")?.textContent).toBe("OpenAI Compatible"));
    expect(query<HTMLSelectElement>("[data-field='ollamaCompatibility']").value).toBe("enabled");
    for (const value of ["disabled", "enabled"]) {
      query<HTMLSelectElement>("[data-field='ollamaCompatibility']").value = value;
      click("#save");
      await vi.waitFor(() => {
        const provider = stored.providers.find((entry) => entry.id === "openai-compatible");
        expect(provider?.type === "openai-compatible" && provider.ollamaCompatibility)
          .toBe(value === "enabled");
      });
    }
  });
});

function click(selector: string): void {
  query<HTMLButtonElement>(selector).click();
}

function query<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

function cloneSettings(value: ExtensionSettings): ExtensionSettings {
  return JSON.parse(JSON.stringify(value)) as ExtensionSettings;
}
