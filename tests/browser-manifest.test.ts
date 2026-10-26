import { describe, expect, it } from "vitest";
import manifest from "../public/manifest.json";
import { browserManifest } from "../build/manifest";

describe("browser package boundaries", () => {
  it("preserves the Chromium manifest and leaves the shared source untouched", () => {
    const snapshot = structuredClone(manifest);
    expect(browserManifest(manifest, false)).toEqual(snapshot);
    const firefox = browserManifest(manifest, true);
    expect(manifest).toEqual(snapshot);
    expect(firefox.background).toEqual({ scripts: ["background.js"], type: "module" });
    expect(firefox.permissions).not.toContain("offscreen");
    expect(firefox.permissions).toContain("declarativeNetRequestWithHostAccess");
    expect(firefox.content_security_policy.sandbox).toContain("moz-extension:");
    expect(firefox.content_security_policy.sandbox).not.toContain("chrome-extension:");
    expect(firefox.browser_specific_settings?.gecko).toMatchObject({
      strict_min_version: "154.0", data_collection_permissions: { required: ["websiteContent", "authenticationInfo"] }
    });
    expect(firefox.version).toBe(manifest.version);
  });
});
