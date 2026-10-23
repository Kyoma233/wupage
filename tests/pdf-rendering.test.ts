import { describe, expect, it, vi } from "vitest";
import type { PDFPageProxy } from "pdfjs-dist";
import { renderPageWithoutText } from "../src/pdf/rendering";

vi.mock("pdfjs-dist", () => ({ OPS: { showText: 44, showSpacedText: 45, nextLineShowText: 46, nextLineSetSpacingShowText: 47 } }));

describe("renderPageWithoutText", () => {
  it("skips all PDF text operators, including vector glyphs, while retaining graphics", async () => {
    const paintedText: string[] = [];
    const fillText = (text: string): void => { paintedText.push(`fill:${text}`); };
    const strokeText = (text: string): void => { paintedText.push(`stroke:${text}`); };
    const context = { fillText, strokeText } as unknown as CanvasRenderingContext2D;
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context)
    } as unknown as HTMLCanvasElement;
    const viewport = { width: 612.8, height: 792.2 } as ReturnType<PDFPageProxy["getViewport"]>;
    const drawVector = vi.fn();
    const page = {
      // Deliberately differs from the optimized list used by render().
      getOperatorList: async () => ({ fnArray: [44, 45, 46, 47, 91] }),
      render: vi.fn(({ operationsFilter }: { operationsFilter: (index: number) => boolean }) => {
        return {
          _internalRenderTask: { operatorList: { fnArray: [91, 44, 45, 46, 47] } },
          promise: Promise.resolve().then(() => {
            for (let index = 0; index < 5; index++) {
              if (!operationsFilter(index)) continue;
              if (index > 0) paintedText.push("vector font glyph");
              else drawVector();
            }
          })
        };
      })
    } as unknown as PDFPageProxy;

    await renderPageWithoutText(page, canvas, viewport);

    expect(paintedText).toEqual([]);
    expect(drawVector).toHaveBeenCalledOnce();
    expect(canvas.width).toBe(612);
    expect(canvas.height).toBe(792);
    expect(context.fillText).toBe(fillText);
    expect(context.strokeText).toBe(strokeText);
  });

  it("propagates rendering failures without changing canvas text methods", async () => {
    const fillText = vi.fn();
    const strokeText = vi.fn();
    const context = { fillText, strokeText } as unknown as CanvasRenderingContext2D;
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context)
    } as unknown as HTMLCanvasElement;
    const viewport = { width: 100, height: 100 } as ReturnType<PDFPageProxy["getViewport"]>;
    const page = {
      getOperatorList: async () => ({ fnArray: [] }),
      render: () => ({ promise: Promise.reject(new Error("render failed")) })
    } as unknown as PDFPageProxy;

    await expect(renderPageWithoutText(page, canvas, viewport)).rejects.toThrow("render failed");
    expect(context.fillText).toBe(fillText);
    expect(context.strokeText).toBe(strokeText);
  });
});
