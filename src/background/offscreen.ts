let opening: Promise<void> | undefined;

export async function ensureOffscreenDocument(): Promise<void> {
  if (opening) return opening;
  opening = (async () => {
    if (await chrome.offscreen.hasDocument()) return;
    await chrome.offscreen.createDocument({
      url: "ocr-offscreen.html",
      reasons: [chrome.offscreen.Reason.IFRAME_SCRIPTING, chrome.offscreen.Reason.WORKERS],
      justification: "Manage optional local OCR and Bergamot models and run local inference."
    });
  })();
  try { await opening; } finally { opening = undefined; }
}
