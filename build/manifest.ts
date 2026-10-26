interface ManifestV3 {
  background: { service_worker?: string; scripts?: string[]; type?: string };
  permissions: string[];
  content_security_policy: { extension_pages: string; sandbox?: string };
  browser_specific_settings?: {
    gecko: { id: string; strict_min_version: string; data_collection_permissions: { required: string[] } };
  };
  [key: string]: unknown;
}

export function browserManifest(manifest: ManifestV3, firefox: boolean): ManifestV3 {
  if (!firefox) return structuredClone(manifest);
  const result = structuredClone(manifest);
  result.background = { scripts: ["background.js"], type: "module" };
  result.permissions = result.permissions.filter((permission) => permission !== "offscreen");
  result.browser_specific_settings = {
    gecko: {
      id: "wupage@mr-wuliu.github.io",
      // Firefox 154 introduced the isolated sandbox used by the OCR runtime.
      strict_min_version: "154.0",
      data_collection_permissions: { required: ["websiteContent", "authenticationInfo"] }
    }
  };
  if (result.content_security_policy.sandbox) {
    result.content_security_policy.sandbox = result.content_security_policy.sandbox.replace("chrome-extension:", "moz-extension:");
  }
  return result;
}
