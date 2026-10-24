interface PageBounds {
  top: number;
  bottom: number;
}

export function selectPdfTranslationPages<T extends { pageNumber: number }>(pages: readonly T[], readingPage: number, radius: number | null): T[] {
  return pages.filter((page) => radius === null || Math.abs(page.pageNumber - readingPage) <= radius);
}

// Page rows are ordered vertically. Locate the row at the reading position in
// logarithmic time, even in manuals containing thousands of pages.
export function findReadingPage<T>(pages: readonly T[], getBounds: (page: T) => PageBounds, readingY: number): T | undefined {
  let low = 0;
  let high = pages.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (getBounds(pages[middle]).bottom < readingY) low = middle + 1;
    else high = middle;
  }
  return pages[low];
}

export function takeNearestPage<T extends { pageNumber: number }>(pending: Set<T>, readingPage: number): T | undefined {
  let next: T | undefined;
  for (const page of pending) {
    if (!next || Math.abs(page.pageNumber - readingPage) < Math.abs(next.pageNumber - readingPage)) next = page;
  }
  if (next) pending.delete(next);
  return next;
}
