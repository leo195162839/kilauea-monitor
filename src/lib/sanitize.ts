import DOMPurify from 'dompurify';

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/** Cleans notice HTML from USGS before it is rendered: no scripts, styles or event handlers. */
export function sanitizeNoticeHtml(html: string): string {
  return DOMPurify.sanitize(html, { FORBID_TAGS: ['style', 'img'], FORBID_ATTR: ['style'] });
}
