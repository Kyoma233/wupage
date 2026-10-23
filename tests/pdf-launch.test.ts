import { describe, expect, it, vi } from "vitest";
import { getExtensionDetailsUrl, getPdfLaunchOptions, isLikelyPdfUrl, openPdfWorkspaceInNewTab } from "../src/pdf/launch";

describe("PDF launch options", () => {
  it.each([
    ["https://example.com/paper.pdf#page=3", true],
    ["https://example.com/download?file=paper.pdf", true],
    ["file:///C:/Reports/Annual%20report.PDF#page=2", true],
    ["file:///home/user/paper%2Epdf", true],
    ["file:///C:/Reports/readme.txt?file=paper.pdf", false],
    ["chrome-extension://extension/paper.pdf", false],
    ["javascript:alert('paper.pdf')", false],
    [undefined, false]
  ])("detects supported PDF tabs: %s", (url, expected) => {
    expect(isLikelyPdfUrl(url)).toBe(expected);
  });

  it("preserves local file URLs and the automatic translation request", () => {
    const source = "file:///C:/Reports/Annual%20report.pdf#page=2";
    expect(getPdfLaunchOptions(`chrome-extension://extension/pdf.html?url=${encodeURIComponent(source)}&translate=1`))
      .toEqual({ url: source, autoTranslate: true });
  });

  it("opens extension details in the user's browser", () => {
    expect(getExtensionDetailsUrl("extension-id", "Chrome/130 Edg/130"))
      .toBe("edge://extensions/?id=extension-id");
    expect(getExtensionDetailsUrl("extension-id", "Chrome/130"))
      .toBe("chrome://extensions/?id=extension-id");
  });

  it("recognizes popup-initiated automatic translation", () => {
    expect(getPdfLaunchOptions(
      "chrome-extension://extension/pdf.html?url=https%3A%2F%2Fexample.com%2Fpaper.pdf&translate=1"
    )).toEqual({
      url: "https://example.com/paper.pdf",
      autoTranslate: true
    });
  });

  it("keeps manually opened PDF workspaces idle", () => {
    expect(getPdfLaunchOptions("chrome-extension://extension/pdf.html")).toEqual({
      url: null,
      autoTranslate: false
    });
  });

  it("opens another blank workspace in a new tab without replacing the current document", async () => {
    const createTab = vi.fn(async () => undefined);

    await openPdfWorkspaceInNewTab(
      createTab,
      (path) => `chrome-extension://extension/${path}`
    );

    expect(createTab).toHaveBeenCalledWith({
      url: "chrome-extension://extension/pdf.html"
    });
  });
});
