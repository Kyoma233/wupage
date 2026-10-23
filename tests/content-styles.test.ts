// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { injectContentStyles } from "../src/content/styles";

describe("content translation styles", () => {
  afterEach(() => {
    document.querySelector("#wupage-translation-style")?.remove();
  });

  it("inherits source colors in every translation text mode", () => {
    injectContentStyles();
    const css = document.querySelector("#wupage-translation-style")?.textContent ?? "";

    expect(css).toMatch(/data-wupage-mode="block"[^}]*color:\s*inherit/s);
    expect(css).toMatch(/data-wupage-container="heading"[^}]*color:\s*inherit/s);
    expect(css).toMatch(/data-wupage-mode="inline"[^}]*color:\s*inherit/s);
    expect(css).toMatch(/data-wupage-mode="code-comment"[^}]*color:\s*inherit/s);
    expect(css).toMatch(/data-wupage-preserve-whitespace="true"[^}]*white-space:\s*pre-wrap/s);
    expect(css).toMatch(/data-wupage-container="youtube-description"[^}]*display:\s*inline/s);
    expect(css).toMatch(/youtube-description[^}]*:not\(\[data-wupage-display-mode="replace"\]\)::before[^}]*content:\s*"\\A"/s);
    expect(css).toMatch(/data-wupage-display-mode="replace"[^}]*font:\s*inherit/s);
    expect(css).toMatch(/\.wupage-replaced-source[^}]*display:\s*none\s*!important/s);
    expect(css).toMatch(/data-wupage-container="image-text"[^}]*display:\s*block/s);
    expect(css).toMatch(/data-wupage-container="image-text"[^}]*font-size:\s*max\(16px, 1rem\)/s);
    expect(css).toMatch(/data-wupage-container="image-text"[^}]*white-space:\s*pre-wrap/s);
    expect(css).toMatch(/data-wupage-container="image-text"[^}]*color:\s*rgb\(245, 245, 245\)/s);
    expect(css).toMatch(/data-wupage-container="image-text"[^}]*background:\s*rgb\(23, 32, 38\)/s);
    expect(css).toMatch(/data-wupage-image-layout="interleaved"[^}]*background:\s*transparent/s);
    expect(css).toMatch(/data-wupage-image-layout="interleaved"[^}]*text-align:\s*center/s);
    expect(css).toMatch(/wupage-image-text-row[^}]*font-size:\s*var\(--wupage-image-font-size\)/s);
  });
});
