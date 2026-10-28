import { parseBingDictionary } from "./parsers";

let player: HTMLAudioElement | undefined;
let playbackId: string | undefined;

export function stopDictionaryPlayback(id?: string): void {
  if (id && id !== playbackId) return;
  player?.pause();
  player?.removeAttribute("src");
  player?.load();
  player = undefined;
  playbackId = undefined;
}

export async function playDictionaryPlayback(id: string, dataUrl: string): Promise<void> {
  if (!/^data:audio\/(?:mpeg|mp3|wav|ogg);base64,[A-Za-z0-9+/=]+$/.test(dataUrl) || dataUrl.length > 3_000_000) {
    throw new Error("词典发音数据无效。");
  }
  stopDictionaryPlayback();
  const audio = new Audio(dataUrl);
  player = audio;
  playbackId = id;
  audio.onended = () => stopDictionaryPlayback(id);
  audio.onerror = () => stopDictionaryPlayback(id);
  try { await audio.play(); }
  catch { stopDictionaryPlayback(id); throw new Error("发音播放失败，请重试。"); }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.target !== "dictionary-runtime" || sender.id !== chrome.runtime.id || sender.tab) return;
  const task = async () => {
    if (request.action === "parse-bing") return parseBingDictionary(request.html, request.query);
    if (request.action === "play") return playDictionaryPlayback(request.id, request.dataUrl);
    if (request.action === "stop") return stopDictionaryPlayback(request.id);
    throw new Error("未知词典操作。");
  };
  void task().then(data => sendResponse({ ok: true, data }), (error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  return true;
});
