// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { renderImageTranslation } from "../src/content/image-rendering";
import type { ImageTextRegion } from "../src/shared/types";

const region: ImageTextRegion = {
  box: [0, 0, 1000, 1000], text: "総監督", translation: "总导演",
  foreground: "#111111", background: "#ffffff", align: "center", bold: false, sampleColors: true
};

afterEach(() => vi.restoreAllMocks());

function render(background: number[], foreground = [153, 125, 38, 255]) {
  const width = 100, height = 40;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      pixels.set(x >= 30 && x < 70 && y >= 10 && y < 30 ? foreground : background, (y * width + x) * 4);
    }
  }
  const fills: string[] = [], textColors: string[] = [];
  const context = {
    fillStyle: "", font: "", drawImage: vi.fn(), clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(),
    beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(),
    getImageData: vi.fn(() => ({ data: pixels })),
    fillRect: vi.fn(() => fills.push(context.fillStyle)),
    fillText: vi.fn(() => textColors.push(context.fillStyle)),
    measureText: (text: string) => ({ width: text.length * 10 })
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const replacesSource = renderImageTranslation(canvas, document.createElement("img"), [region]);
  return { context, fills, textColors, replacesSource };
}

describe("image translation color and alpha sampling", () => {
  it("preserves gold lettering on a transparent background without painting black", () => {
    const result = render([0, 0, 0, 0]);

    expect(result.replacesSource).toBe(true);
    expect(result.fills).toEqual([]);
    expect(result.textColors).toEqual(["#997d26"]);
    expect(result.context.clearRect).toHaveBeenCalledWith(0, 0, 100, 40);
  });

  it("ignores RGB bytes of fully transparent pixels", () => {
    const result = render([255, 0, 255, 0]);

    expect(result.fills).toEqual([]);
    expect(result.textColors).toEqual(["#997d26"]);
  });

  it("preserves the actual light background and colored text of opaque images", () => {
    const result = render([238, 238, 234, 255]);

    expect(result.replacesSource).toBe(false);
    expect(result.fills).toEqual(["#eeeeea"]);
    expect(result.textColors).toEqual(["#997d26"]);
  });

  it("retains a partially transparent background instead of flattening it", () => {
    const result = render([238, 238, 234, 128]);

    expect(result.replacesSource).toBe(true);
    expect(result.fills).toEqual([`rgba(238, 238, 234, ${128 / 255})`]);
    expect(result.textColors).toEqual(["#997d26"]);
  });

  it("samples the source before painting a translation", () => {
    const result = render([238, 238, 234, 255]);

    expect(result.context.getImageData.mock.invocationCallOrder[0])
      .toBeLessThan(result.context.fillRect.mock.invocationCallOrder[0]);
    expect(result.context.clearRect.mock.invocationCallOrder[1])
      .toBeLessThan(result.context.fillRect.mock.invocationCallOrder[0]);
  });
});
