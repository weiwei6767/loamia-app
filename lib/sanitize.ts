import "server-only";
import sanitizeHtml from "sanitize-html";

const ANY_VALUE = [/^[^"<>]*$/];

export function sanitizeReportHtml(html: string): string {
  // Strip leading code fences if AI wrapped output despite instructions
  let cleaned = html.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "");
  }

  return sanitizeHtml(cleaned, {
    allowedTags: [
      "div", "section", "article", "header", "footer", "main", "aside",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "p", "ul", "ol", "li", "blockquote", "pre", "code",
      "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption",
      "strong", "b", "em", "i", "u", "span", "small", "mark", "sup", "sub",
      "hr", "br", "figure", "figcaption",
    ],
    allowedAttributes: {
      "*": ["style", "class", "id", "data-*", "title", "colspan", "rowspan"],
    },
    allowedSchemes: [],
    allowedSchemesByTag: {},
    allowedSchemesAppliedToAttributes: [],
    allowedStyles: {
      "*": {
        color: ANY_VALUE,
        background: ANY_VALUE,
        "background-color": ANY_VALUE,
        "background-image": ANY_VALUE,
        padding: ANY_VALUE,
        "padding-top": ANY_VALUE,
        "padding-right": ANY_VALUE,
        "padding-bottom": ANY_VALUE,
        "padding-left": ANY_VALUE,
        margin: ANY_VALUE,
        "margin-top": ANY_VALUE,
        "margin-right": ANY_VALUE,
        "margin-bottom": ANY_VALUE,
        "margin-left": ANY_VALUE,
        border: ANY_VALUE,
        "border-color": ANY_VALUE,
        "border-width": ANY_VALUE,
        "border-style": ANY_VALUE,
        "border-radius": ANY_VALUE,
        "border-top": ANY_VALUE,
        "border-bottom": ANY_VALUE,
        "border-left": ANY_VALUE,
        "border-right": ANY_VALUE,
        "font-family": ANY_VALUE,
        "font-size": ANY_VALUE,
        "font-weight": ANY_VALUE,
        "font-style": ANY_VALUE,
        "text-align": ANY_VALUE,
        "text-decoration": ANY_VALUE,
        "text-transform": ANY_VALUE,
        "line-height": ANY_VALUE,
        "letter-spacing": ANY_VALUE,
        display: ANY_VALUE,
        flex: ANY_VALUE,
        "flex-direction": ANY_VALUE,
        "flex-wrap": ANY_VALUE,
        "justify-content": ANY_VALUE,
        "align-items": ANY_VALUE,
        "align-content": ANY_VALUE,
        gap: ANY_VALUE,
        grid: ANY_VALUE,
        "grid-template-columns": ANY_VALUE,
        "grid-template-rows": ANY_VALUE,
        "grid-column": ANY_VALUE,
        "grid-row": ANY_VALUE,
        width: ANY_VALUE,
        "max-width": ANY_VALUE,
        "min-width": ANY_VALUE,
        height: ANY_VALUE,
        "max-height": ANY_VALUE,
        "min-height": ANY_VALUE,
        opacity: ANY_VALUE,
        "box-shadow": ANY_VALUE,
        position: [/^(static|relative)$/],
        overflow: [/^(hidden|auto|visible)$/],
        "white-space": ANY_VALUE,
        "word-break": ANY_VALUE,
        cursor: [/^(default|pointer)$/],
      },
    },
  });
}
