import { describe, expect, it } from "vitest";
import { languageFamily, matchesAutoTranslationSite, matchesSitePattern, normalizeAutoTranslation, normalizeSitePattern, setAutoTranslationEnabled } from "../src/shared/auto-translation";
import { normalizeSettings } from "../src/shared/settings";

describe("automatic translation site rules", () => {
  it.each([
    ["example.com", "https://example.com/article", true],
    ["example.com", "http://docs.example.com/article", true],
    ["example.com", "https://evil-example.com/", false],
    ["example.com", "https://example.com.evil.test/", false],
    ["*.example.com", "https://example.com/", false],
    ["*.example.com", "https://docs.example.com/", true],
    ["https://example.com/docs/*", "https://example.com/docs/a/b", true],
    ["https://example.com/docs/*", "http://example.com/docs/a", false],
    ["example.com/docs/*", "https://example.com/blog/a", false],
    ["example.com/docs/a", "https://example.com/docs/ab", false],
    ["example.com/a.b/*/end", "https://example.com/axb/c/end", false],
    ["example.com/a.b/*/end", "https://example.com/a.b/c/end?x=1#part", true],
    ["127.0.0.1:6543/docs/*", "http://127.0.0.1:6543/docs/a", true],
    ["127.0.0.1:6543/docs/*", "http://127.0.0.1:6544/docs/a", false],
    ["example.com", "file:///example.com/a", false],
    ["[::1]:6543", "http://[::1]:6543/docs", true],
    ["https://example.com:443", "https://example.com:8443/docs", false],
    ["example.com:80", "http://example.com/docs", true],
    ["example.com:443", "http://example.com/docs", false]
  ])("matches %s against %s as %s", (pattern, url, result) => {
    expect(matchesSitePattern(pattern, url)).toBe(result);
  });

  it.each(["", "https://user:pass@example.com", "ftp://example.com", "javascript:alert(1)", "https://example.com/?q=1", "example.*.com", "*.127.0.0.1", "example..com"])(
    "rejects an invalid rule %s", pattern => expect(() => normalizeSitePattern(pattern)).toThrow()
  );

  it("normalizes domains, Unicode hosts and paths without changing path case", () => {
    expect(normalizeSitePattern(" HTTPS://Example.COM/Docs/** ")).toBe("https://example.com/Docs/*");
    expect(normalizeSitePattern("例子.测试")).toContain("xn--");
  });

  it("keeps old installations disabled and normalizes only valid rules", () => {
    expect(normalizeSettings({}).autoTranslation).toEqual({ enabled: false, nonTargetLanguage: false, presetSites: [], customSites: [] });
    const settings = normalizeAutoTranslation({ enabled: true, nonTargetLanguage: "true", presetSites: ["github.com", "unknown.test", "github.com"], customSites: [
      { id: "one", pattern: "Example.com", enabled: false },
      { id: "one", pattern: "*.example.net", enabled: true },
      { pattern: "example.com" }, { pattern: "javascript:bad" }, null
    ] });
    expect(settings.nonTargetLanguage).toBe(false);
    expect(settings.presetSites).toEqual(["github.com"]);
    expect(settings.customSites).toHaveLength(2);
    expect(new Set(settings.customSites.map(site => site.id)).size).toBe(2);
    expect(matchesAutoTranslationSite(settings, "https://github.com/a")).toBe(true);
    expect(matchesAutoTranslationSite(settings, "https://example.com/a")).toBe(false);
    expect(matchesAutoTranslationSite(settings, "https://docs.example.net/a")).toBe(true);
    expect(matchesAutoTranslationSite({ ...settings, enabled: false }, "https://github.com/a")).toBe(false);
  });

  it("compares language variants as the same language", () => {
    expect(languageFamily("en-US")).toBe(languageFamily("en"));
    expect(languageFamily("zh_Hans")).toBe(languageFamily("zh-CN"));
  });

  it("only supplies a first-use language rule when no site rules have been configured", () => {
    expect(setAutoTranslationEnabled(undefined, true)).toEqual({ enabled: true, nonTargetLanguage: true, presetSites: [], customSites: [] });
    const configured = { enabled: false, nonTargetLanguage: false, presetSites: [],
      customSites: [{ id: "one", pattern: "example.com", enabled: false }] };
    expect(setAutoTranslationEnabled(configured, true)).toEqual({ ...configured, enabled: true });
    expect(configured.enabled).toBe(false);
  });

  it("keeps deleted presets removed and does not enable a broader language rule", () => {
    const rules = normalizeAutoTranslation({ enabled: true, presetSites: ["github.com"], removedPresetSites: ["github.com", "unknown.test"] });
    expect(rules.presetSites).toEqual([]);
    expect(rules.removedPresetSites).toEqual(["github.com"]);
    expect(matchesAutoTranslationSite(rules, "https://github.com/a")).toBe(false);
    expect(setAutoTranslationEnabled(rules, true).nonTargetLanguage).toBe(false);
  });
});
