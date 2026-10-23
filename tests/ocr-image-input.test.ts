// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareOcrInput, selectOcrBackground } from "../src/ocr/image-input";

afterEach(() => vi.restoreAllMocks());

describe("OCR alpha preprocessing", () => {
  it("keeps opaque images unchanged", () => {
    expect(selectOcrBackground(new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]))).toBeUndefined();
  });

  it("puts transparent black Japanese lettering on a light recognition background", () => {
    expect(selectOcrBackground(new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 255]))).toBe("white");
  });

  it("keeps white transparent lettering visible against a dark recognition background", () => {
    expect(selectOcrBackground(new Uint8ClampedArray([0, 0, 0, 0, 255, 255, 255, 255]))).toBe("black");
  });

  it("ignores invisible RGB values and handles an empty transparent image", () => {
    expect(selectOcrBackground(new Uint8ClampedArray([255, 255, 255, 0, 0, 0, 0, 255]))).toBe("white");
    expect(selectOcrBackground(new Uint8ClampedArray([255, 0, 255, 0]))).toBe("white");
  });

  it("weights visible colors by alpha instead of transparent edge colors", () => {
    expect(selectOcrBackground(new Uint8ClampedArray([255, 255, 255, 16, 0, 0, 0, 255]))).toBe("white");
  });

  it("creates an opaque OCR copy at the original size without changing the source", () => {
    const sampleContext = { drawImage: vi.fn(), getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 255]) })) };
    const context = { fillStyle: "", fillRect: vi.fn(), drawImage: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValueOnce(sampleContext as unknown as CanvasRenderingContext2D)
      .mockReturnValueOnce(context as unknown as CanvasRenderingContext2D);
    const bitmap = { width: 1300, height: 151, close: vi.fn() } as unknown as ImageBitmap;

    const input = prepareOcrInput(bitmap);

    expect(input).toBeInstanceOf(HTMLCanvasElement);
    expect([input.width, input.height]).toEqual([1300, 151]);
    expect(sampleContext.getImageData).toHaveBeenCalledWith(0, 0, 256, 30);
    expect(context.fillStyle).toBe("white");
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 1300, 151);
    expect(context.fillRect.mock.invocationCallOrder[0]).toBeLessThan(context.drawImage.mock.invocationCallOrder[0]);
    expect(bitmap.close).not.toHaveBeenCalled();
  });

  it("returns the original bitmap when a recognition copy is unnecessary", () => {
    const context = { drawImage: vi.fn(), getImageData: () => ({ data: new Uint8ClampedArray([255, 255, 255, 255]) }) };
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
    const bitmap = { width: 4096, height: 2048 } as ImageBitmap;

    expect(prepareOcrInput(bitmap)).toBe(bitmap);
    expect(getContext).toHaveBeenCalledTimes(1);
  });
});
