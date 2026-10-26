import type { LocalModel } from "./models";
import { readLocalModel } from "./model-store";

// Use the upstream worker protocol directly. This avoids its default remote
// registry/downloader and gives every failed worker call a bounded lifetime.
export class LocalTranslationEngine {
  private worker: Worker | undefined;
  private serial = 0;
  private readonly pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private routeKey = "";

  release(error = new Error("本地翻译已停止。")): void {
    this.worker?.terminate();
    this.worker = undefined;
    this.routeKey = "";
    for (const task of this.pending.values()) { clearTimeout(task.timer); task.reject(error); }
    this.pending.clear();
  }

  private call(name: string, args: unknown[], transfer: Transferable[] = []): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = ++this.serial;
      const timer = setTimeout(() => this.release(new Error("本地翻译处理超时，请缩小文本范围后重试。")), 120_000);
      this.pending.set(id, { resolve, reject, timer });
      try { this.worker!.postMessage({ id, name, args }, transfer); }
      catch (error) { this.release(error instanceof Error ? error : new Error(String(error))); }
    });
  }

  private async ensureRoute(route: LocalModel[]): Promise<void> {
    const key = route.map((model) => model.id).join("/");
    if (this.worker && this.routeKey === key) return;
    this.release();
    this.worker = new Worker(chrome.runtime.getURL("bergamot-runtime/translator-worker.js"));
    this.worker.onmessage = ({ data }) => {
      const task = this.pending.get(data.id);
      if (!task) return;
      clearTimeout(task.timer);
      this.pending.delete(data.id);
      if (data.error) task.reject(new Error(data.error.message ?? "本地翻译失败。"));
      else task.resolve(data.result);
    };
    this.worker.onerror = (event) => { event.preventDefault(); this.release(new Error("本地翻译引擎启动失败，请确认浏览器支持 WebAssembly SIMD，或重新加载扩展。")); };
    this.worker.onmessageerror = () => this.release(new Error("本地翻译消息读取失败，请重试。"));
    await this.call("initialize", [{ cacheSize: 0, useNativeIntGemm: false }]);
    for (const model of route) {
      const files = await readLocalModel(model.id);
      const vocabs = files.vocab ? [files.vocab, files.vocab] : [files.srcvocab, files.trgvocab];
      await this.call("loadTranslationModel", [{ from: model.from, to: model.to }, {
        model: files.model, shortlist: files.lex, vocabs
      }], [...new Set(Object.values(files))]);
    }
    this.routeKey = key;
  }

  async translate(route: LocalModel[], texts: string[]): Promise<string[]> {
    try {
      await this.ensureRoute(route);
      const result = await this.call("translate", [{
        models: route.map(({ from, to }) => ({ from, to })),
        texts: texts.map((text) => ({ text, html: false, qualityScores: false }))
      }]) as { target: { text: string } }[];
      if (!Array.isArray(result) || result.length !== texts.length || result.some((item) => typeof item?.target?.text !== "string")) {
        throw new Error("本地翻译返回了不完整的结果，请重试。");
      }
      return result.map((item) => item.target.text);
    } catch (error) {
      this.release();
      throw error;
    }
  }
}
