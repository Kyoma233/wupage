// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../src/shared/defaults";
import { enhanceProviderSelect } from "../src/shared/provider-picker";

function setup(): HTMLSelectElement {
  const select = document.createElement("select");
  for (const provider of DEFAULT_SETTINGS.providers) select.add(new Option(provider.label, provider.id));
  select.value = "microsoft-web-translate";
  document.body.append(select);
  enhanceProviderSelect(select, DEFAULT_SETTINGS.providers);
  return select;
}

describe("provider icon picker", () => {
  afterEach(() => {
    window.dispatchEvent(new Event("pagehide"));
    document.body.replaceChildren();
  });

  it("shows bundled icons on the selected service and each option", () => {
    const select = setup();
    expect(select.hidden).toBe(true);
    expect(document.querySelector(".wupage-provider-trigger [data-provider-icon='microsoft-color']")).not.toBeNull();
    expect(document.querySelectorAll(".wupage-provider-choice .wupage-provider-icon"))
      .toHaveLength(select.options.length);
    expect(document.querySelector(".wupage-provider-trigger")?.getAttribute("aria-label"))
      .toBe("翻译服务：Microsoft 翻译");
    expect(document.querySelectorAll("img, script")).toHaveLength(0);
  });

  it("updates the original select and emits one change when a service is chosen", () => {
    const select = setup();
    const onChange = vi.fn();
    select.addEventListener("change", onChange);
    document.querySelector<HTMLButtonElement>(".wupage-provider-trigger")!.click();
    const choice = document.querySelector<HTMLButtonElement>("[data-value='deepseek']")!;
    choice.click();
    expect(select.value).toBe("deepseek");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".wupage-provider-trigger [data-provider-icon='deepseek-color']")).not.toBeNull();
    expect(document.querySelector<HTMLElement>(".wupage-provider-list")!.hidden).toBe(true);
    expect(document.activeElement).toBe(document.querySelector(".wupage-provider-trigger"));
  });

  it("supports keyboard navigation, skips disabled choices and cancels without changing the value", () => {
    const select = setup();
    select.options[1].disabled = true;
    enhanceProviderSelect(select, DEFAULT_SETTINGS.providers);
    const trigger = document.querySelector<HTMLButtonElement>(".wupage-provider-trigger")!;
    trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect((document.activeElement as HTMLElement).dataset.value).toBe(select.options[2].value);
    document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    expect((document.activeElement as HTMLElement).dataset.value).toBe("firefox-local");
    document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.activeElement).toBe(trigger);
    expect(select.value).toBe("microsoft-web-translate");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    const outerEscape = vi.fn();
    document.body.addEventListener("keydown", outerEscape, { once: true });
    trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(outerEscape).toHaveBeenCalledOnce();
  });

  it("closes on outside clicks and synchronizes external changes without duplicating the picker", () => {
    const select = setup();
    document.querySelector<HTMLButtonElement>(".wupage-provider-trigger")!.click();
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(document.querySelector<HTMLElement>(".wupage-provider-list")!.hidden).toBe(true);
    select.value = "zhipu-glm";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    enhanceProviderSelect(select, DEFAULT_SETTINGS.providers);
    expect(document.querySelectorAll(".wupage-provider-picker")).toHaveLength(1);
    expect(document.querySelector(".wupage-provider-trigger [data-provider-icon='zhipu-color']")).not.toBeNull();
  });

  it("treats custom service names as text and gives unknown services a generic icon", () => {
    const select = setup();
    select.add(new Option('<img src="https://example.com/logo" onerror="alert(1)">', "custom"));
    select.value = "custom";
    enhanceProviderSelect(select, DEFAULT_SETTINGS.providers);
    expect(document.querySelector(".wupage-provider-trigger [data-provider-icon='generic']")).not.toBeNull();
    expect(document.querySelector(".wupage-provider-trigger .wupage-provider-name")?.textContent)
      .toContain("<img");
    expect(document.querySelector("img")).toBeNull();
  });
});
