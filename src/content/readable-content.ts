export const READABLE_ROOT_SELECTOR = [
  "main", "article", "[role='main']", ".markdown-body", ".docblock", "#main-content",
  ".entry-content", ".post-content", ".article-content"
].join(",");

// A div can be a paragraph in either a semantic document or an application.
// Cards containing headings, controls or other blocks need independent segments.
export function isDivProseBlock(element: Element): boolean {
  return element.matches("div") && Boolean(element.closest(READABLE_ROOT_SELECTOR))
    && !element.querySelector(
      "div,p,h1,h2,h3,h4,h5,h6,li,table,ul,ol,blockquote,section,article,header,footer,aside,nav,"
      + "button,input,textarea,select,[role='button'],[contenteditable]"
    );
}
