// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OcrLine } from "../src/shared/ocr";

const { createEngine, predict } = vi.hoisted(() => ({ createEngine: vi.fn(), predict: vi.fn() }));
vi.mock("@paddleocr/paddleocr-js", () => ({ PaddleOCR: { create: createEngine } }));

describe("OCR bitmap ownership", () => {
  let receive: EventListener;
  let transparent: boolean;
  const lines: OcrLine[] = [{ text: "Cache performance", score: 0.99, poly: [[10, 10], [200, 10], [200, 40], [10, 40]] }];
  class Bitmap {
    width = 800;
    height = 100;
    closed = false;
    close = vi.fn(() => { this.closed = true; this.width = this.height = 0; });
  }
  let bitmap: Bitmap;
  let draw: ReturnType<typeof vi.fn>;
  let post: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    transparent = false;
    bitmap = new Bitmap();
    vi.stubGlobal("ImageBitmap", Bitmap);
    vi.stubGlobal("createImageBitmap", vi.fn(async () => bitmap));
    vi.stubGlobal("fetch", vi.fn(async () => ({ blob: async () => new Blob() })));
    vi.spyOn(window, "addEventListener").mockImplementation((type, callback) => {
      if (type === "message") receive = callback as EventListener;
    });
    post = vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);
    draw = vi.fn((source: Bitmap | HTMLCanvasElement) => {
      if (source instanceof Bitmap && source.closed) throw new DOMException("The image source is detached", "InvalidStateError");
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
      return { drawImage: draw, fillRect: vi.fn(), getImageData: () => {
        const data = new Uint8ClampedArray(this.width * this.height * 4);
        if (!transparent) for (let offset = 3; offset < data.length; offset += 4) data[offset] = 255;
        return { data };
      } } as unknown as CanvasRenderingContext2D;
    });
    createEngine.mockResolvedValue({ predict });
    predict.mockImplementation(async (input: Bitmap | HTMLCanvasElement) => {
      // Match PaddleOCR's source adapter: ImageBitmap arguments are consumed
      // and closed before predict resolves, whereas canvases are copied.
      if (input instanceof Bitmap) input.close();
      return [{ items: lines }];
    });
    await import("../src/ocr/sandbox");
    await request("init");
    post.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.resetModules();
  });

  async function request(action: string): Promise<unknown> {
    receive({ source: window.parent, data: { target: "wupage-ocr-engine", id: 1, action, data: { dataUrl: "data:image/png;base64,AA==" } } } as unknown as Event);
    await vi.waitFor(() => expect(post).toHaveBeenCalled());
    return post.mock.calls.at(-1)![0];
  }

  it.each([false, true])("keeps the source alive through postprocessing (transparent: %s)", async (alpha) => {
    transparent = alpha;
    expect(await request("recognize")).toEqual({ target: "wupage-ocr-result", id: 1, result: lines });
    expect(predict.mock.calls.at(-1)![0]).toBeInstanceOf(HTMLCanvasElement);
    expect(draw).toHaveBeenCalledTimes(3);
    expect(draw.mock.invocationCallOrder.at(-1)).toBeGreaterThan(predict.mock.invocationCallOrder[0]);
    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(bitmap.close.mock.invocationCallOrder[0]).toBeGreaterThan(draw.mock.invocationCallOrder.at(-1)!);
  });

  it("releases the owned bitmap when recognition fails", async () => {
    predict.mockRejectedValueOnce(new Error("Recognition failed"));
    expect(await request("recognize")).toEqual({ target: "wupage-ocr-result", id: 1, error: "Recognition failed" });
    expect(bitmap.close).toHaveBeenCalledOnce();
  });
});
