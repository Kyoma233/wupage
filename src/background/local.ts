import { getLocalRoute, normalizeLocalLanguage } from "../local/models";
import type { RuntimeResponse, TranslateBatchRequest } from "../shared/types";
import { ensureOffscreenDocument } from "./offscreen";

export async function requestLocal<T>(action: string, data?: unknown): Promise<T> {
  await ensureOffscreenDocument();
  const response = await chrome.runtime.sendMessage({ target: "bergamot-offscreen", action, data }) as RuntimeResponse;
  if (!response?.ok) throw new Error(response?.error ?? "本地翻译未能启动，请重新加载扩展。");
  return response.data as T;
}

export async function translateLocally(request: TranslateBatchRequest, signal?: AbortSignal): Promise<string[]> {
  signal?.throwIfAborted();
  if (!request.texts.length) return [];
  let source = request.sourceLang ?? "auto";
  if (source === "auto") {
    const detected = await chrome.i18n.detectLanguage(request.texts.join("\n").slice(0, 12000));
    const best = detected.languages[0];
    if (!best || best.language === "und" || best.percentage < 50) {
      throw new Error("本地翻译无法可靠识别源语言，请在翻译设置中手动选择源语言。");
    }
    source = best.language;
  }
  const route = getLocalRoute(source, request.targetLang);
  if (!route.length) return [...request.texts];
  signal?.throwIfAborted();
  return requestLocal<string[]>("translate", { ...request, sourceLang: normalizeLocalLanguage(source) });
}
