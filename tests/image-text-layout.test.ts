import { describe, expect, it } from "vitest";
import { analyzeImageTextLayout } from "../src/content/image-text-layout";

function textPixels(bands: Array<[number, number]>, opaque = false): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(200 * 180 * 4);
  for (let y = 0; y < 180; y++) {
    for (let x = 0; x < 200; x++) {
      const offset = (y * 200 + x) * 4;
      pixels.set([240, 240, 240, opaque || (x > 30 && x < 170 && bands.some(([top, bottom]) => y >= top && y < bottom)) ? 255 : 0], offset);
    }
  }
  return pixels;
}

describe("transparent image paragraph layout", () => {
  it("splits at paragraph gaps instead of the smaller gaps between lines", () => {
    const layout = analyzeImageTextLayout(textPixels([[10, 20], [40, 50], [55, 65], [100, 110], [115, 125]]), 200, 180, 3);

    expect(layout?.slices).toEqual([
      { top: 0, bottom: 30 },
      { top: 30, bottom: 82.5 },
      { top: 82.5, bottom: 180 }
    ]);
    expect(layout?.foreground).toBe("rgb(240, 240, 240)");
    expect(layout?.fontRatio).toBeCloseTo(0.055);
  });

  it("rejects opaque artwork even if its alternative contains paragraphs", () => {
    expect(analyzeImageTextLayout(textPixels([], true), 200, 180, 3)).toBeNull();
  });

  it("rejects text whose line gaps cannot reliably separate the paragraphs", () => {
    expect(analyzeImageTextLayout(textPixels([[10, 20], [25, 35], [40, 50]]), 200, 180, 3)).toBeNull();
  });

  it("rejects empty images and incomplete pixel buffers", () => {
    expect(analyzeImageTextLayout(textPixels([]), 200, 180, 2)).toBeNull();
    expect(analyzeImageTextLayout(new Uint8ClampedArray(20), 200, 180, 2)).toBeNull();
  });
});
