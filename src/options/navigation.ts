/** Switch categories without rebuilding the form or discarding unsaved edits. */
export function setupSettingsNavigation(root: HTMLElement): {
  reveal: (element: HTMLElement) => void;
} {
  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>(".settings-nav a"));
  const panels = Array.from(root.querySelectorAll<HTMLElement>(".settings-panel"));
  const controller = new AbortController();

  function panelForHash(): HTMLElement {
    let id = location.hash.slice(1);
    try { id = decodeURIComponent(id); } catch { /* Fall back to the default category. */ }
    const target = document.getElementById(id);
    return panels.find(panel => panel === target || panel.contains(target)) ?? panels[0];
  }

  function activate(panel: HTMLElement): void {
    for (const entry of panels) entry.hidden = entry !== panel;
    for (const link of links) {
      if (link.getAttribute("aria-controls") === panel.id) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
  }

  function reveal(element: HTMLElement): void {
    const panel = element.closest<HTMLElement>(".settings-panel");
    if (!panel || !panels.includes(panel) || !panel.hidden) return;
    history.pushState(null, "", `#${panel.id}`);
    activate(panel);
  }

  for (const link of links) {
    link.addEventListener("click", event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (location.hash !== link.hash) history.pushState(null, "", link.hash);
      activate(panelForHash());
      root.scrollIntoView?.({ block: "start" });
    }, { signal: controller.signal });
  }
  window.addEventListener("hashchange", () => {
    activate(panelForHash());
  }, { signal: controller.signal });
  window.addEventListener("pagehide", event => {
    if (!event.persisted) controller.abort();
  }, { signal: controller.signal });
  activate(panelForHash());
  return { reveal };
}
