import { LOCAL_RESOURCE_NOTICE } from "../local/models";
import type { ExtensionSettings } from "./types";

export function localProviderNotice(settings: ExtensionSettings): string | undefined {
  if (settings.providers.find((provider) => provider.id === settings.activeProviderId)?.type !== "firefox-local") return undefined;
  return `Firefox 本地翻译（实验）：${LOCAL_RESOURCE_NOTICE} 请在扩展设置中管理语言模型。`;
}
