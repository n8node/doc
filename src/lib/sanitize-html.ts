import DOMPurify from "isomorphic-dompurify";

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "u", "s", "a", "ul", "ol", "li",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "pre", "code", "blockquote",
      "table", "thead", "tbody", "tr", "th", "td",
      "img",
      "mark",
      "span",
      "ul[data-type=taskList]", "li[data-type=taskItem]", "label", "input",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "title", "style", "data-type", "data-checked", "contenteditable"],
  });
}
