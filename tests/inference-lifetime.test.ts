import { afterEach, expect, it, vi } from "vitest";
import { withInferenceLifetime } from "../src/shared/inference-lifetime";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

it("stops Firefox's heartbeat even if a model download fails", async () => {
  vi.stubEnv("MODE", "firefox");
  vi.useFakeTimers();
  const sendMessage = vi.fn(async () => null);
  vi.stubGlobal("chrome", { runtime: { sendMessage } });
  await expect(withInferenceLifetime(async () => { throw new Error("Download failed"); })).rejects.toThrow("Download failed");
  await vi.advanceTimersByTimeAsync(40_000);
  expect(sendMessage).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
