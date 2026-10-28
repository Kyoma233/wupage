import type { ExtensionSettings } from "./types";

export function localProviderNotice(settings: ExtensionSettings): string | undefined {
  if (settings.providers.find((provider) => provider.id === settings.activeProviderId)?.type !== "firefox-local") return undefined;
  return "首次使用请在设置中下载或导入语言模型。";
}
