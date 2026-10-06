// Tiny event hub shared by the engine and the UI: window.yawmuk.events.
// It is an EventTarget (CustomEvent.detail carries the payload) with an emitter-style .on/.off/.emit on top.
//   'load:progress' { loaded, total, label }   assets loaded so far for the scene being built
//   'load:done'     { location }               the scene is built and visible
//   'quality'       { tier, auto }             render quality tier changed (see world.js QUALITY_TIERS)
//   'scene:ready'   { location }               a location finished loading (after load:done)
class Hub extends EventTarget {
  on(type, fn) {
    const w = (e) => fn(e.detail, e);
    (this._w ||= new Map()).set(fn, w);
    this.addEventListener(type, w);
    return () => this.off(type, fn);
  }
  off(type, fn) { const w = this._w?.get(fn); if (w) this.removeEventListener(type, w); }
  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
}

export const events = new Hub();
