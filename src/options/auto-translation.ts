import { AUTO_TRANSLATION_PRESETS, normalizeAutoTranslation, normalizeSitePattern, setAutoTranslationEnabled } from "../shared/auto-translation";
import type { AutoTranslationSettings, AutoTranslationSite } from "../shared/types";

export function setupAutoTranslationControls(root: HTMLElement): {
  render: (value: AutoTranslationSettings | undefined) => void;
  read: () => AutoTranslationSettings;
} {
  const query = <T extends Element>(selector: string): T => root.querySelector<T>(selector)!;
  const enabled = query<HTMLInputElement>("#autoTranslateEnabled");
  const foreign = query<HTMLInputElement>("#autoTranslateNonTarget");
  const foreignOption = query<HTMLElement>("#autoTranslateNonTargetOption");
  const list = query<HTMLElement>("#autoTranslateSites");
  const message = query<HTMLElement>("#autoTranslateSiteStatus");
  let sites: Array<AutoTranslationSite & { preset?: string }> = [];
  const controls = new Map<string, HTMLInputElement>();
  let defaultLanguageRule = false;

  function updateLanguageOption(): void {
    foreignOption.hidden = !enabled.checked;
    foreign.disabled = !enabled.checked;
  }

  enabled.addEventListener("change", () => {
    if (enabled.checked && defaultLanguageRule) {
      foreign.checked = true;
      defaultLanguageRule = false;
    }
    updateLanguageOption();
  });
  foreign.addEventListener("change", () => { defaultLanguageRule = false; });

  function syncDrafts(): void {
    for (const site of sites) {
      const control = controls.get(site.id);
      if (!control) continue;
      site.pattern = control.value;
      site.enabled = control.closest("li")?.querySelector<HTMLInputElement>(".auto-site-enabled")?.checked ?? site.enabled;
    }
  }

  function renderSites(): void {
    list.replaceChildren(); controls.clear();
    if (!sites.length) { const empty = document.createElement("li"); empty.className = "auto-site-empty"; empty.textContent = "暂无站点，点击下方“＋”添加。"; list.append(empty); }
    sites.forEach((site, index) => {
      const row = document.createElement("li"); row.className = "auto-site-row";
      row.dataset.siteId = site.id;
      const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = site.enabled; checkbox.className = "auto-site-enabled";
      checkbox.setAttribute("aria-label", `启用第 ${index + 1} 条站点规则`);
      if (site.preset) checkbox.dataset.preset = site.preset;
      checkbox.addEventListener("change", () => { site.enabled = checkbox.checked; });
      const editor = document.createElement("div"); editor.className = "auto-site-editor";
      const pattern = document.createElement("input"); pattern.type = "text"; pattern.className = "auto-site-pattern";
      pattern.value = site.pattern; pattern.title = site.pattern; pattern.maxLength = 2048;
      pattern.placeholder = "example.com 或 https://example.com/docs/*";
      pattern.setAttribute("aria-label", `第 ${index + 1} 条站点规则`); pattern.setAttribute("aria-describedby", "autoTranslateSiteHelp autoTranslateSiteStatus");
      const caption = document.createElement("small");
      const updateCaption = (): void => { caption.textContent = AUTO_TRANSLATION_PRESETS.find(preset => preset.domain === site.pattern.trim().toLowerCase())?.label ?? "自定义站点"; };
      updateCaption();
      pattern.addEventListener("input", () => {
        site.pattern = pattern.value; pattern.title = pattern.value; pattern.removeAttribute("aria-invalid"); message.textContent = ""; updateCaption();
        remove.setAttribute("aria-label", `删除站点 ${site.pattern || "未填写"}`);
      });
      controls.set(site.id, pattern);
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "secondary auto-site-remove";
      remove.textContent = "−"; remove.title = "删除站点"; remove.setAttribute("aria-label", `删除站点 ${site.pattern || "未填写"}`);
      remove.addEventListener("click", () => {
        syncDrafts();
        const index = sites.indexOf(site);
        sites = sites.filter(entry => entry.id !== site.id); message.textContent = ""; renderSites();
        const next = sites[Math.min(index, sites.length - 1)];
        (next ? controls.get(next.id) : query<HTMLButtonElement>("#addAutoTranslateSite"))?.focus({ preventScroll: true });
      });
      editor.append(caption, pattern); row.append(checkbox, editor, remove); list.append(row);
    });
    const addRow = document.createElement("li"); addRow.className = "auto-site-add-row";
    const add = document.createElement("button"); add.id = "addAutoTranslateSite"; add.type = "button"; add.textContent = "+";
    add.title = "添加站点"; add.setAttribute("aria-label", "添加站点");
    add.addEventListener("click", () => {
      syncDrafts();
      const site = { id: crypto.randomUUID(), pattern: "", enabled: true };
      sites.push(site); message.textContent = ""; renderSites(); controls.get(site.id)?.focus();
    });
    addRow.append(add); list.append(addRow);
  }

  return {
    render(value): void {
      const settings = normalizeAutoTranslation(value);
      enabled.checked = settings.enabled; foreign.checked = settings.nonTargetLanguage;
      defaultLanguageRule = !settings.enabled && setAutoTranslationEnabled(settings, true).nonTargetLanguage;
      updateLanguageOption();
      sites = AUTO_TRANSLATION_PRESETS.filter(site => !settings.removedPresetSites?.includes(site.domain)).map(site => ({
        id: `preset-${site.domain}`, preset: site.domain, pattern: site.domain, enabled: settings.presetSites.includes(site.domain)
      }));
      for (const site of settings.customSites) {
        const duplicate = sites.find(entry => entry.pattern === site.pattern);
        if (duplicate) duplicate.enabled ||= site.enabled;
        else {
          let id = site.id; while (sites.some(entry => entry.id === id)) id += "-1";
          sites.push({ ...site, id });
        }
      }
      message.textContent = ""; renderSites();
    },
    read(): AutoTranslationSettings {
      const patterns = new Set<string>();
      const normalized = sites.map((site, index) => {
        try {
          const pattern = normalizeSitePattern(controls.get(site.id)?.value ?? site.pattern);
          if (patterns.has(pattern)) throw new Error("这个站点规则已经存在。");
          const checkbox = controls.get(site.id)?.closest("li")?.querySelector<HTMLInputElement>(".auto-site-enabled");
          patterns.add(pattern); return { ...site, pattern, enabled: checkbox?.checked ?? site.enabled };
        } catch (error) {
          const text = `第 ${index + 1} 行：${error instanceof Error ? error.message : String(error)} 请修改或用“−”删除该行。`;
          message.textContent = text; controls.get(site.id)?.setAttribute("aria-invalid", "true"); controls.get(site.id)?.focus();
          throw new Error(text);
        }
      });
      const remaining = new Set(normalized.filter(site => site.preset === site.pattern).map(site => site.preset));
      const removed = AUTO_TRANSLATION_PRESETS.filter(site => !remaining.has(site.domain)).map(site => site.domain);
      return { enabled: enabled.checked, nonTargetLanguage: foreign.checked,
        presetSites: normalized.filter(site => site.preset === site.pattern && site.enabled).map(site => site.pattern),
        customSites: normalized.filter(site => site.preset !== site.pattern).map(({ id, pattern, enabled }) => ({ id, pattern, enabled })),
        ...(removed.length ? { removedPresetSites: removed } : {}) };
    }
  };
}
