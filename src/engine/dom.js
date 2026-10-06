// Tiny DOM builder. All text goes through textContent — content JSON is never injected as HTML.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') for (const [p, val] of Object.entries(v)) { if (p.startsWith('--')) el.style.setProperty(p, val); else el.style[p] = val; }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false || c === '') continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Only http(s) links are rendered as anchors. */
export function safeUrl(u) {
  if (typeof u !== 'string') return null;
  try { const url = new URL(u); return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null; } catch { return null; }
}

export function link(url, label) {
  const href = safeUrl(url);
  if (!href) return null;
  return h('a', { href, target: '_blank', rel: 'noopener noreferrer', class: 'src-link' }, label || new URL(href).hostname);
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
