import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalTranslationEngine } from "../src/local/engine";
import { getLocalRoute } from "../src/local/models";

vi.mock("../src/local/model-store", () => ({ readLocalModel: async () => ({ model: new ArrayBuffer(3), lex: new ArrayBuffer(3), vocab: new ArrayBuffer(3) }) }));

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("local worker lifecycle", () => {
  it("transfers the packaged runtime from the extension page for a cold offline Firefox worker", async () => {
    vi.stubEnv("MODE", "firefox");
    const wasm = new ArrayBuffer(4);
    const fetchRuntime = vi.fn(async () => ({ ok: true, arrayBuffer: async () => wasm }));
    const sent: Array<{ name: string; args: unknown[]; transfer: Transferable[] }> = [];
    class FakeWorker {
      onmessage?: (event: { data: unknown }) => void;
      terminate = vi.fn();
      postMessage(message: { id: number; name: string; args: unknown[] }, transfer: Transferable[]) {
        sent.push({ ...message, transfer });
        queueMicrotask(() => this.onmessage?.({ data: { id: message.id,
          result: message.name === "translate" ? [{ target: { text: "你好" } }] : null } }));
      }
    }
    vi.stubGlobal("chrome", { runtime: { getURL: (path: string) => `moz-extension://test/${path}` } });
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal("fetch", fetchRuntime);
    const engine = new LocalTranslationEngine();
    expect(await engine.translate(getLocalRoute("en", "zh-CN"), ["Hello"])).toEqual(["你好"]);
    expect(fetchRuntime).toHaveBeenCalledWith("moz-extension://test/bergamot-runtime/bergamot-translator-worker.wasm");
    expect(sent[0]).toMatchObject({ name: "initialize", args: [{ wasmBinary: wasm }], transfer: [wasm] });
    engine.release();
  });

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
