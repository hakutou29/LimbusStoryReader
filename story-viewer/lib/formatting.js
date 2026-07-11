export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function formatRichText(value) {
  let text = escapeHtml(value);
  text = text.replace(/&lt;color=(&quot;)?(#[0-9a-fA-F]+)\1&gt;/gi, '<span style="color: $2;">');
  text = text.replace(/&lt;\/color&gt;/gi, '</span>');
  text = text.replace(/&lt;(\/??)(b|i|u|s)&gt;/gi, '<$1$2>');
  return text;
}