// All document HTML passes through this allowlist before it is stored.
// Anything not listed (scripts, event handlers, iframes, styles, javascript: URLs) is stripped,
// which prevents stored XSS when the document is later rendered for another user.
import sanitizeHtml from 'sanitize-html';

const OPTIONS = {
  allowedTags: [
    'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'code', 'pre', 'blockquote',
    'ul', 'ol', 'li', 'hr', 'a',
  ],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow', target: '_blank' }),
  },
};

export function cleanHtml(html) {
  return sanitizeHtml(String(html ?? ''), OPTIONS);
}

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
