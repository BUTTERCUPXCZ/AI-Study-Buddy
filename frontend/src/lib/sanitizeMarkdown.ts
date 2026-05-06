import DOMPurify from 'dompurify'

/**
 * S3 — XSS sanitization for AI-generated content.
 *
 * Markdown rendered from Gemini output is *user-controlled* — an
 * attacker who poisons the input PDF (or even a PDF link in the source
 * doc) can plant raw HTML / JS in the eventual rendered note. React's
 * built-in escaping covers `{value}` interpolation, but `react-markdown`
 * renders to a DOM tree that can include `<a href>` and (with rehype-raw)
 * arbitrary HTML.
 *
 * Strategy: run the markdown string through DOMPurify *before* it
 * reaches react-markdown. DOMPurify operates on the parsed HTML, so we
 * use it to strip dangerous tags / attributes from any inline HTML the
 * model emits. react-markdown is also configured with
 * `disallowedElements` as a second layer.
 */

const ALLOWED_URI = /^(?:https?:|mailto:|tel:|data:image\/(?:png|jpeg|gif|webp|svg\+xml))/i

const PURIFY_CONFIG = {
  // Markdown produces only this set; anything else is suspicious.
  ALLOWED_TAGS: [
    'a', 'abbr', 'b', 'blockquote', 'br', 'code', 'del', 'em', 'h1', 'h2',
    'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'kbd', 'li', 'ol', 'p', 'pre',
    's', 'strong', 'sub', 'sup', 'table', 'tbody', 'td', 'th', 'thead', 'tr',
    'u', 'ul', 'span', 'div',
  ],
  ALLOWED_ATTR: ['href', 'title', 'alt', 'src', 'colspan', 'rowspan', 'class'],
  ALLOWED_URI_REGEXP: ALLOWED_URI,
  // Forbidden no matter what — closes the door on rehype-raw style payloads.
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
  FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick', 'onmouseover', 'onfocus'],
}

export function sanitizeMarkdown(markdown: string): string {
  // DOMPurify also accepts plain markdown — it parses to HTML internally
  // and strips disallowed nodes. Output is still markdown-safe text
  // because we keep all formatting tags allowed.
  return DOMPurify.sanitize(markdown, PURIFY_CONFIG)
}

// Elements that react-markdown should refuse to render even if they
// somehow survive the DOMPurify pass.
export const REACT_MARKDOWN_DISALLOWED = [
  'script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button',
]
