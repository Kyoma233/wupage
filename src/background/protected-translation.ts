import { normalizeProtectedText } from "../shared/protected-text";
import type { TranslateBatchRequest } from "../shared/types";

type Translate = (request: TranslateBatchRequest) => Promise<string[]>;

export async function translateProtectedText(request: TranslateBatchRequest, translate: Translate): Promise<string[]> {
  const initial = await translate(request);
  assertResponse(initial, request.texts.length);
  const output = initial.map((text, index) => normalizeProtectedText(request.texts[index], text));
  for (let index = 0; index < output.length; index++) {
    if (output[index] !== undefined) continue;
    const source = request.texts[index];
    // Retry only the damaged paragraph. Keep these calls sequential inside the
    // existing provider limiter instead of creating unbounded nested requests.
    const retry = await tryTranslate({ ...request, texts: [source] }, translate);
    const repaired = retry && normalizeProtectedText(source, retry[0]);
    output[index] = repaired ?? await translateProseFragments(source, request, translate);
  }
  return output as string[];
}

async function translateProseFragments(source: string, request: TranslateBatchRequest, translate: Translate): Promise<string> {
  const parts = source.split(/(⟪WUPAGE\d+⟫)/gu);
  const indexes = parts.flatMap((part, index) => /^⟪WUPAGE\d+⟫$/u.test(part) || !/\p{L}/u.test(part) ? [] : [index]);
  const redact = (text: string) => text.replace(/⟪WUPAGE\d+⟫/gu, "[mathematical expression]");
  const context = [request.context && redact(request.context), `Source paragraph (formulas withheld): ${redact(source)}`]
    .filter(Boolean).join("\n");
  for (let start = 0; start < indexes.length; start += 16) {
    const group = indexes.slice(start, start + 16);
    const texts = group.map((index) => parts[index].trim());
    // No formula IDs are sent in this request or its context. Reinsert their
    // original sequence locally, even when a model keeps omitting them.
    const translated = await tryTranslate({ ...request, texts, context }, translate);
    for (let position = 0; position < group.length; position++) {
      const index = group[position];
      let text = translated && normalizeProtectedText(texts[position], translated[position]);
      if (!text?.trim()) {
        const single = await tryTranslate({ ...request, texts: [texts[position]], context }, translate);
        text = single && normalizeProtectedText(texts[position], single[0]);
      }
      if (!text?.trim()) throw new Error("LLM response did not include a usable translation for protected text.");
      const prefix = /^\s*/u.exec(parts[index])![0];
      const suffix = /\s*$/u.exec(parts[index])![0];
      parts[index] = prefix + text.trim() + suffix;
    }
  }
  const result = parts.join("");
  if (normalizeProtectedText(source, result) === undefined) throw new Error("LLM response changed protected text.");
  return result;
}

async function tryTranslate(request: TranslateBatchRequest, translate: Translate): Promise<string[] | undefined> {
  try {
    const result = await translate(request);
    assertResponse(result, request.texts.length);
    return result;
  } catch (error) {
    // Do not multiply HTTP/authentication failures into per-fragment retries.
    if (!(error instanceof Error) || !error.message.startsWith("LLM response ")) throw error;
    return undefined;
  }
}

function assertResponse(result: string[], expectedLength: number): void {
  if (result.length !== expectedLength || result.some((text) => typeof text !== "string" || !text.trim())) {
    throw new Error("LLM response contains missing or empty items.");
  }
}
