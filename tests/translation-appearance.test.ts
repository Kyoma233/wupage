// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { clearTranslations, refreshTranslationColors, renderTargetTranslation } from "../src/content/dom";
import { mapTranslationTextColor } from "../src/shared/translation-colors";

afterEach(() => {
  clearTranslations();
  document.body.replaceChildren();
  refreshTranslationColors();
});

describe("custom bilingual colors", () => {
  const colors = { light: "#aa3344", dark: "#f3c97a" };
  it("selects colors using the webpage background, independently of interface mode", () => {
    expect(mapTranslationTextColor("rgb(30, 30, 30)", "rgb(255, 255, 255)", colors)).toBe("rgb(170, 51, 68)");
    expect(mapTranslationTextColor("rgb(240, 240, 240)", "rgb(23, 32, 38)", colors)).toBe("rgb(243, 201, 122)");
  });

  it("adjusts unreadable choices to preserve contrast", () => {
    const color = mapTranslationTextColor("rgb(30, 30, 30)", "rgb(255, 255, 255)", { light: "#ffffff", dark: "#000000" })!;
    const channel = Number(color.match(/\d+/)![0]) / 255;
    const luminance = channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    expect(1.05 / (luminance + .05)).toBeGreaterThanOrEqual(4.55);
    expect(mapTranslationTextColor("rgb(240, 240, 240)", "rgb(0, 0, 0)", { light: "#fffefe", dark: "#000000" })).not.toBe("rgb(0, 0, 0)");
  });

  it("keeps the chosen hue distinguishable when the source already uses it", () => {
    const result = mapTranslationTextColor("rgb(15, 118, 110)", "rgb(255, 255, 255)", { light: "#0f766e", dark: "#5eead4" });
    expect(result).not.toBe("rgb(15, 118, 110)");
  });

  it("recolors completed paragraph translations in place while preserving original-color mode", () => {
    document.body.innerHTML = '<p id="light" style="color:rgb(30,30,30);background:rgb(255,255,255)">Original text.</p><p id="dark" style="color:rgb(240,240,240);background:rgb(23,32,38)">Other original.</p><p id="original" style="color:rgb(30,30,30);background:rgb(255,255,255)">Keep original color.</p>';
    const light = document.querySelector<HTMLElement>("#light")!, dark = document.querySelector<HTMLElement>("#dark")!;
    renderTargetTranslation(light, "浅色译文", undefined, "bilingual-accent");
    renderTargetTranslation(dark, "深色译文", undefined, "bilingual-accent");
    renderTargetTranslation(document.querySelector("#original")!, "原色译文", undefined, "bilingual");
    const rendered = light.querySelector<HTMLElement>(".wupage-translation")!;
    refreshTranslationColors(colors);
    expect(light.querySelector(".wupage-translation")).toBe(rendered);
    expect(rendered.style.color).toBe("rgb(170, 51, 68)");
    expect(rendered.textContent).toBe("浅色译文");
    expect(dark.querySelector<HTMLElement>(".wupage-translation")!.style.color).toBe("rgb(243, 201, 122)");
    expect(document.querySelector<HTMLElement>("#original .wupage-translation")!.style.color).toBe("rgb(30, 30, 30)");
    expect(light.style.color).toBe("rgb(30, 30, 30)");
  });
});
