import type { AutoTranslationSettings, AutoTranslationSite } from "./types";

export const AUTO_TRANSLATION_PRESETS = [
  { domain: "github.com", label: "GitHub" },
  { domain: "stackoverflow.com", label: "Stack Overflow" },
  { domain: "en.wikipedia.org", label: "英文维基百科" },
  { domain: "reddit.com", label: "Reddit" },
  { domain: "medium.com", label: "Medium" },
  { domain: "news.ycombinator.com", label: "Hacker News" }
];

export function normalizeSitePattern(value: string): string {
  const input = value.trim();
  if (!input || input.length > 2048) throw new Error("请填写有效的站点域名或网址。");
  const explicitProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(input);
  let parsed: URL;
  try { parsed = new URL(explicitProtocol ? input : `https://${input}`); }
  catch { throw new Error("请填写有效的站点域名或 HTTP/HTTPS 网址。"); }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("请填写 HTTP/HTTPS 域名或路径，不包含账号、查询参数或 # 片段。");
  }
  const wildcard = parsed.hostname.startsWith("*.");
  const hostname = (wildcard ? parsed.hostname.slice(2) : parsed.hostname).replace(/\.$/, "");
  const ip = /^(?:\d+\.){3}\d+$|^\[[a-f\d:]+\]$/i.test(hostname);
  if ((!ip && hostname.split(".").some(part => !/^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(part)))
    || !hostname || (wildcard && (ip || hostname === "localhost"))) {
    throw new Error("域名格式不正确；子域名通配请使用 *.example.com。");
  }
  const port = parsed.port || explicitPort(input);
  const host = `${wildcard ? "*." : ""}${hostname}${port ? `:${port}` : ""}`;
  const path = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\*+/g, "*");
  return `${explicitProtocol ? `${parsed.protocol}//` : ""}${host}${path}`;
}

export function matchesSitePattern(pattern: string, address: string): boolean {
  try {
    const normalized = normalizeSitePattern(pattern);
    const explicitProtocol = normalized.includes("://");
    const rule = new URL(explicitProtocol ? normalized : `https://${normalized}`);
    const url = new URL(address);
    const port = explicitPort(normalized);
    if (!["http:", "https:"].includes(url.protocol) || (explicitProtocol && rule.protocol !== url.protocol)
      || (port && port !== (url.port || (url.protocol === "https:" ? "443" : "80")))
      || (explicitProtocol && !port && Boolean(url.port))) return false;
    const wildcard = rule.hostname.startsWith("*.");
    const host = wildcard ? rule.hostname.slice(2) : rule.hostname;
    const actual = url.hostname.replace(/\.$/, "");
    const exact = actual === host;
    const subdomain = !/^(?:\d+\.){3}\d+$|^\[/u.test(host) && actual.endsWith(`.${host}`);
    if (wildcard ? !subdomain : !exact && !subdomain) return false;
    if (rule.pathname === "/") return true;
    const parts = rule.pathname.split("*");
    if (parts.length === 1) return url.pathname === rule.pathname;
    if (!url.pathname.startsWith(parts[0])) return false;
    let cursor = parts[0].length;
    for (const part of parts.slice(1, -1)) {
      const index = url.pathname.indexOf(part, cursor);
      if (index < 0) return false;
      cursor = index + part.length;
    }
    const tail = parts[parts.length - 1];
    return url.pathname.endsWith(tail) && url.pathname.length - tail.length >= cursor;
  } catch { return false; }
}

function explicitPort(pattern: string): string {
  const authority = pattern.replace(/^https?:\/\//i, "").split("/")[0];
  const match = authority.match(/:(\d+)$/u);
  return match ? String(Number(match[1])) : "";
}

export function normalizeAutoTranslation(value: unknown): AutoTranslationSettings {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const presets = new Set(AUTO_TRANSLATION_PRESETS.map(site => site.domain));
  const removed = Array.isArray(input.removedPresetSites)
    ? [...new Set(input.removedPresetSites.filter((site): site is string => typeof site === "string" && presets.has(site)))] : [];
  const patterns = new Set<string>();
  const ids = new Set<string>();
  const customSites: AutoTranslationSite[] = [];
  if (Array.isArray(input.customSites)) for (const entry of input.customSites) {
    if (!entry || typeof entry !== "object" || typeof entry.pattern !== "string") continue;
    try {
      const pattern = normalizeSitePattern(entry.pattern);
      if (patterns.has(pattern)) continue;
      let id = typeof entry.id === "string" && entry.id.trim() ? entry.id : `site-${customSites.length}`;
      while (ids.has(id)) id += "-1";
      ids.add(id); patterns.add(pattern);
      customSites.push({ id, pattern, enabled: entry.enabled !== false });
    } catch { /* Ignore invalid imported rules without discarding other settings. */ }
  }
  return {
    enabled: input.enabled === true,
    nonTargetLanguage: input.nonTargetLanguage === true,
    presetSites: Array.isArray(input.presetSites) ? [...new Set(input.presetSites.filter((site): site is string => typeof site === "string" && presets.has(site) && !removed.includes(site)))] : [],
    customSites,
    ...(removed.length ? { removedPresetSites: removed } : {})
  };
}

export function matchesAutoTranslationSite(settings: AutoTranslationSettings, address: string): boolean {
  return settings.enabled && (settings.presetSites.some(pattern => matchesSitePattern(pattern, address))
    || settings.customSites.some(rule => rule.enabled && matchesSitePattern(rule.pattern, address)));
}

export function setAutoTranslationEnabled(value: unknown, enabled: boolean): AutoTranslationSettings {
  const settings = normalizeAutoTranslation(value);
  const unconfigured = !settings.presetSites.length && !settings.customSites.length && !settings.nonTargetLanguage && !settings.removedPresetSites?.length;
  return { ...settings, enabled, nonTargetLanguage: settings.nonTargetLanguage || (enabled && unconfigured) };
}

export function languageFamily(language: string): string {
  return language.trim().toLowerCase().replace(/_/g, "-").split("-")[0];
}
