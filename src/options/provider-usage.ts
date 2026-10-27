import { getProviderUsage, PROVIDER_USAGE_CHECKED_AT } from "../shared/provider-usage";
import { getEffectiveProviderPerformance } from "../shared/performance";
import type { ExtensionSettings, ProviderConfig } from "../shared/types";

export function renderProviderUsage(container: HTMLElement, provider: ProviderConfig): void {
  const usage = getProviderUsage(provider);
  container.replaceChildren();
  container.className = "provider-usage";
  container.setAttribute("aria-labelledby", "providerUsageTitle");
  const header = document.createElement("div"); header.className = "provider-usage-heading";
  const heading = document.createElement("h3"); heading.id = "providerUsageTitle"; heading.textContent = `额度与限制 · ${usage.service}`;
  const checked = document.createElement("time"); checked.dateTime = PROVIDER_USAGE_CHECKED_AT; checked.textContent = `更新于 ${PROVIDER_USAGE_CHECKED_AT}`;
  header.append(heading, checked);
  const details = document.createElement("dl"); details.className = "provider-usage-details";
  for (const [label, value] of [["免费 / 匿名额度", usage.quota], ["单次请求", usage.request], ["请求速率", usage.rate], ["服务商并发", usage.concurrency]]) {
    const row = document.createElement("div");
    const term = document.createElement("dt"); term.textContent = label;
    const description = document.createElement("dd"); description.textContent = value;
    row.append(term, description); details.append(row);
  }
  container.append(header, details);
  if (usage.note) { const note = document.createElement("p"); note.className = "provider-usage-note"; note.textContent = usage.note; container.append(note); }
  const sources = document.createElement("p"); sources.className = "provider-usage-sources"; sources.dataset.role = "usage-sources";
  sources.append(usage.sources.length ? "官方来源：" : "官方来源：请参阅所配置服务商的官方文档。");
  usage.sources.forEach((source, index) => {
    if (index) sources.append(" · ");
    const link = document.createElement("a"); link.href = source.url; link.target = "_blank"; link.rel = "noopener noreferrer";
    link.textContent = source.label; sources.append(link);
  });
  const scheduling = document.createElement("p"); scheduling.className = "provider-usage-scheduling"; scheduling.dataset.role = "provider-scheduling";
  const note = document.createElement("p"); note.className = "provider-usage-note";
  note.textContent = "额度及限制以服务商最新公布为准。";
  container.append(sources, scheduling, note);
}

export function updateProviderScheduling(container: HTMLElement, provider: ProviderConfig, settings: ExtensionSettings): void {
  const output = container.querySelector<HTMLElement>("[data-role='provider-scheduling']");
  if (!output) return;
  const performance = getEffectiveProviderPerformance(settings, provider.id);
  const useApi = "serviceMode" in provider && provider.serviceMode === "api";
  const inner = provider.type === "google-web-translate" && !useApi ? "；每个任务内部最多 4 路请求"
    : ["yandex-web-translate", "volcengine-web-translate", "mymemory", "firefox-local"].includes(provider.type)
      || provider.type === "tencent-transmart" && useApi ? "；每个任务内部串行处理" : "";
  output.textContent = `插件当前设置：分块大小 ${performance.chunkSize.toLocaleString("en-US")} 字符，调度并发 ${performance.concurrency}${inner}。`;
}
