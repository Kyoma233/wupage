export interface PdfLaunchOptions {
  url: string | null;
  autoTranslate: boolean;
}

export function isLikelyPdfUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    const pdfPath = decodeURIComponent(url.pathname).toLowerCase().endsWith(".pdf");
    if (url.protocol === "file:") return pdfPath;
    return (url.protocol === "http:" || url.protocol === "https:")
      && (pdfPath || url.search.toLowerCase().includes(".pdf"));
  } catch {
    return false;
  }
}

export function getExtensionDetailsUrl(extensionId: string, userAgent: string): string {
  if (/Firefox\//.test(userAgent)) return "about:addons";
  const scheme = /Edg\//.test(userAgent) ? "edge" : "chrome";
  return `${scheme}://extensions/?id=${encodeURIComponent(extensionId)}`;
}

export function getPdfLaunchOptions(href: string): PdfLaunchOptions {
  const parameters = new URL(href).searchParams;
  return {
    url: parameters.get("url"),
    autoTranslate: parameters.get("translate") === "1"
  };
}

export async function openPdfWorkspaceInNewTab(
  createTab: (properties: { url: string }) => Promise<unknown>,
  getExtensionUrl: (path: string) => string
): Promise<void> {
  await createTab({ url: getExtensionUrl("pdf.html") });
}
