import { describe, expect, it } from "vitest";
import type { OcrLine } from "../src/shared/ocr";
import { refineTextStripLines, restoreTextFromAlternative } from "../src/ocr/text-lines";

const line = (text: string, left: number, top: number, right: number, bottom: number): OcrLine => ({
  text, score: .99, poly: [[left, top], [right, top], [right, bottom], [left, bottom]]
});
const alternative = "新房昭之×虚淵玄（ニトロプラス）×蒼樹うめ×シャフトによる『叛逆の物語』の正統なる続編―― そして、新たな始まり。";
const headline = [
  line("新房昭之×虚淵玄(ニトロプラス)×蒼樹うめ×シャフトによる", 15, 0, 1278, 59),
  line("叛逆の物語』の正統なる続編", 17, 91, 687, 151),
  line("そして、新たな始まり", 792, 92, 1284, 150)
];

function stripPixels(): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(1300 * 151 * 4);
  for (const [left, top, right, bottom] of [[15, 10, 1278, 40], [1, 100, 687, 140], [710, 120, 775, 122], [792, 100, 1298, 142]]) {
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) pixels[(y * 1300 + x) * 4 + 3] = 255;
  }
  return pixels;
}

describe("OCR inline fragments and source punctuation", () => {
  it("joins one headline sentence and includes its missed quote, dash and final period", () => {
    const result = refineTextStripLines(headline, stripPixels(), 1300, 151);

    expect(result).toHaveLength(2);
    expect(result[1].text).toBe("叛逆の物語』の正統なる続編 そして、新たな始まり");
    expect(result[1].poly).toEqual([[1, 100], [1298, 100], [1298, 142], [1, 142]]);
    const restored = restoreTextFromAlternative(result, alternative);
    expect(restored[0].text).toBe("新房昭之×虚淵玄(ニトロプラス)×蒼樹うめ×シャフトによる");
    expect(restored[1].text).toBe("『叛逆の物語』の正統なる続編―― そして、新たな始まり。");
  });

  it("keeps reading order when the right fragment is detected a few pixels higher", () => {
    const shifted = [headline[0], { ...headline[1], poly: [[17, 93], [687, 93], [687, 151], [17, 151]] as [number, number][] }, headline[2]];
    expect(refineTextStripLines(shifted, stripPixels(), 1300, 151)[1].text)
      .toBe("叛逆の物語』の正統なる続編 そして、新たな始まり");
  });

  it("does not combine a staff table or opaque artwork", () => {
    const staff = [line("Director", 20, 20, 100, 40), line("Writer", 160, 20, 220, 40)];
    expect(refineTextStripLines(staff, new Uint8ClampedArray(300 * 300 * 4), 300, 300)).toBe(staff);
    const opaque = stripPixels();
    for (let offset = 3; offset < opaque.length; offset += 4) opaque[offset] = 255;
    expect(refineTextStripLines(headline, opaque, 1300, 151)).toBe(headline);
  });

  it("keeps distant columns separate even inside a wide transparent strip", () => {
    const columns = [line("Left column", 10, 10, 110, 30), line("Right column", 800, 10, 900, 30)];
    expect(refineTextStripLines(columns, new Uint8ClampedArray(1000 * 100 * 4), 1000, 100)).toHaveLength(2);
  });

  it("does not substitute a photo description or conflicting names for OCR", () => {
    expect(restoreTextFromAlternative(headline, "A poster featuring several animation creators.")).toBe(headline);
    expect(restoreTextFromAlternative(headline, alternative.replace("虚淵玄", "別の名前"))).toBe(headline);
  });

  it("keeps opening quotation marks with the next line and closing punctuation with the previous one", () => {
    const rows = [line("An introduction", 0, 0, 100, 20), line("Quoted title continues", 0, 30, 100, 50)];
    expect(restoreTextFromAlternative(rows, 'An introduction. "Quoted title" continues!').map((entry) => entry.text))
      .toEqual(['An introduction.', '"Quoted title" continues!']);
    expect(restoreTextFromAlternative(rows, "An introduction. 「Quoted title」 continues!").map((entry) => entry.text))
      .toEqual(["An introduction.", "「Quoted title」 continues!"]);
  });
});
