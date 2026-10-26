import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalTranslationEngine } from "../src/local/engine";
import { getLocalRoute } from "../src/local/models";

vi.mock("../src/local/model-store", () => ({ readLocalModel: async () => ({ model: new ArrayBuffer(3), lex: new ArrayBuffer(3), vocab: new ArrayBuffer(3) }) }));

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("local worker lifecycle", () => {
  it("bounds failed workers, frees them on timeout, and allows a fresh retry", async () => {
    vi.useFakeTimers();
    const workers: FakeWorker[] = [];
    class FakeWorker {
      onmessage?: (event: { data: unknown }) => void;
      onerror?: (event: Event) => void;
      terminate = vi.fn();
      constructor() { workers.push(this); }
      postMessage(message: { id: number; name: string; args: unknown[] }) {
        if (workers.length === 1) return;
        queueMicrotask(() => this.onmessage?.({ data: { id: message.id,
          result: message.name === "translate" ? [{ target: { text: "你好" } }] : null } }));
      }
    }
    vi.stubGlobal("chrome", { runtime: { getURL: (path: string) => path } });
    vi.stubGlobal("Worker", FakeWorker);
    const engine = new LocalTranslationEngine();
    const pending = engine.translate(getLocalRoute("en", "zh-CN"), ["Hello"]);
    const rejection = expect(pending).rejects.toThrow("超时");
    await vi.advanceTimersByTimeAsync(120000);
    await rejection;
    expect(workers[0].terminate).toHaveBeenCalled();
    const retry = engine.translate(getLocalRoute("en", "zh-CN"), ["Hello"]);
    await vi.advanceTimersByTimeAsync(0);
    expect(await retry).toEqual(["你好"]);
    engine.release();
    expect(workers[1].terminate).toHaveBeenCalledOnce();
  });
});
