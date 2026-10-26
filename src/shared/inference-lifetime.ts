// Firefox can suspend its event page even with a pending message from its own
// child frame. Deliver an event before the 30-second idle timeout, only while
// a model download is active. Chromium's offscreen has an independent lifetime.
export async function withInferenceLifetime<T>(operation: () => Promise<T>): Promise<T> {
  if (import.meta.env.MODE !== "firefox") return operation();
  const heartbeat = () => { void chrome.runtime.sendMessage({ target: "inference-lifetime" }).catch(() => undefined); };
  heartbeat();
  const timer = setInterval(heartbeat, 20_000);
  try { return await operation(); }
  finally { clearInterval(timer); }
}
