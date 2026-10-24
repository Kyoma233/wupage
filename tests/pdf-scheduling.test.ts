import { describe, expect, it } from "vitest";
import { findReadingPage, selectPdfTranslationPages, takeNearestPage } from "../src/pdf/scheduling";

describe("PDF translation scheduling", () => {
  const pages = Array.from({ length: 1367 }, (_, index) => ({ pageNumber: index + 1 }));

  it("selects only the current page and five pages on either side, bounded by document edges", () => {
    expect(selectPdfTranslationPages(pages, 800, 5).map((page) => page.pageNumber))
      .toEqual(Array.from({ length: 11 }, (_, index) => 795 + index));
    expect(selectPdfTranslationPages(pages, 1, 5)).toHaveLength(6);
    expect(selectPdfTranslationPages(pages, 1367, 5)).toHaveLength(6);
    expect(selectPdfTranslationPages(pages, 800, 0)).toEqual([pages[799]]);
    expect(selectPdfTranslationPages(pages, 800, null)).toHaveLength(1367);
  });

  it("locates the page being read in a long document with few layout reads", () => {
    let reads = 0;
    const result = findReadingPage(pages, (page) => {
      reads++;
      return { top: (page.pageNumber - 800) * 1000, bottom: (page.pageNumber - 800) * 1000 + 982 };
    }, 300);
    expect(result?.pageNumber).toBe(800);
    expect(reads).toBeLessThan(12);
  });

  it("prioritizes the current page and adjusts pending work after a scroll", () => {
    const pending = new Set(pages);
    expect(takeNearestPage(pending, 800)?.pageNumber).toBe(800);
    expect(takeNearestPage(pending, 800)?.pageNumber).toBe(799);
    expect(takeNearestPage(pending, 1200)?.pageNumber).toBe(1200);
    expect(takeNearestPage(pending, 1200)?.pageNumber).toBe(1199);
    expect(pending.size).toBe(1363);
  });

  it("finishes all remaining pages once, including pages before the reading position", () => {
    const pending = new Set(pages.slice(0, 5));
    const completed = [];
    while (pending.size) completed.push(takeNearestPage(pending, 4)?.pageNumber);
    expect(completed).toEqual([4, 3, 5, 2, 1]);
    expect(takeNearestPage(pending, 4)).toBeUndefined();
    expect(findReadingPage([], () => ({ top: 0, bottom: 0 }), 200)).toBeUndefined();
  });
});
