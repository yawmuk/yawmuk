// A ~minimal DOM, just enough to run src/engine/dom.js + src/engine/ui/rulingCard.js under node:test.
// Not a general DOM implementation: supports createElement/createTextNode, attributes, classes, style,
// events (stored only), append and textContent, plus a few query helpers for assertions.
class Node {
  constructor() { this.childNodes = []; this.parentNode = null; }
  append(...nodes) { for (const n of nodes) { const c = typeof n === 'string' ? new Text(n) : n; c.parentNode = this; this.childNodes.push(c); } }
  appendChild(n) { this.append(n); return n; }
  get textContent() { return this.childNodes.map((c) => c.textContent).join(''); }
  set textContent(v) { this.childNodes = []; if (v !== '' && v != null) this.append(new Text(String(v))); }
}
class Text extends Node { constructor(t) { super(); this.data = t; } get textContent() { return this.data; } set textContent(v) { this.data = String(v); } }
class Element extends Node {
  constructor(tag) {
    super();
    this.tagName = tag.toUpperCase();
    this.attributes = {};
    this.listeners = {};
    const styleStore = {};
    this.style = new Proxy(styleStore, { get: (o, k) => (k === 'setProperty' ? (p, v) => { o[p] = v; } : o[k]), set: (o, k, v) => { o[k] = v; return true; } });
    this.classList = {
      add: (...c) => { const s = new Set(this.className.split(/\s+/).filter(Boolean)); c.forEach((x) => s.add(x)); this.className = [...s].join(' '); },
      remove: (...c) => { this.className = this.className.split(/\s+/).filter((x) => x && !c.includes(x)).join(' '); },
      toggle: (c, on) => { const has = this.classList.contains(c); if (on ?? !has) this.classList.add(c); else this.classList.remove(c); },
      contains: (c) => this.className.split(/\s+/).includes(c)
    };
  }
  get className() { return this.attributes.class || ''; }
  set className(v) { this.attributes.class = String(v); }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] ?? null; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  get children() { return this.childNodes.filter((c) => c instanceof Element); }
  set tabIndex(v) { this.attributes.tabindex = String(v); }
  get tabIndex() { return Number(this.attributes.tabindex ?? -1); }
  focus() {}
  /** depth-first list of descendant elements matching pred */
  findAll(pred) { const out = []; const walk = (n) => { for (const c of n.children) { if (pred(c)) out.push(c); walk(c); } }; walk(this); return out; }
  byClass(c) { return this.findAll((e) => e.classList.contains(c)); }
  byTag(t) { return this.findAll((e) => e.tagName === t.toUpperCase()); }
}

export function installDomShim() {
  const documentElement = new Element('html');
  globalThis.Node = Node;
  globalThis.document = {
    documentElement,
    createElement: (t) => new Element(t),
    createTextNode: (t) => new Text(t)
  };
  return globalThis.document;
}
