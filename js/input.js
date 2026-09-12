(function (Aqua) {
  'use strict';
  // Keyboard and pointer holds coexist, so releasing one cannot cancel the other.
  class SpeedHoldInput {
    constructor({ document, window, button, enabled, onChange }) {
      const sources = new Set();
      let held = false;
      const update = () => {
        const next = sources.size > 0;
        if (next === held) return;
        held = next; onChange(held);
      };
      const release = source => { sources.delete(source); update(); };
      const reset = () => { sources.clear(); update(); };
      document.addEventListener('keydown', e => {
        const key = e.code === 'Space' ? 'space' : e.code === 'Enter' && e.target === button ? 'enter' : null;
        if (!key || !enabled() || e.altKey || e.ctrlKey || e.metaKey) return;
        e.preventDefault();
        if (e.repeat) return;
        sources.add(key); update();
      });
      document.addEventListener('keyup', e => {
        if (e.code === 'Space') { e.preventDefault(); release('space'); }
        if (e.code === 'Enter') release('enter');
      }, true);
      button.addEventListener('pointerdown', e => {
        if (e.button !== 0 || !enabled()) return;
        e.preventDefault();
        button.setPointerCapture(e.pointerId);
        sources.add(`pointer:${e.pointerId}`); update();
      });
      const releasePointer = e => release(`pointer:${e.pointerId}`);
      window.addEventListener('pointerup', releasePointer, true);
      window.addEventListener('pointercancel', releasePointer, true);
      button.addEventListener('lostpointercapture', releasePointer);
      window.addEventListener('blur', reset);
      document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
    }
  }
  Aqua.SpeedHoldInput = SpeedHoldInput;
})(globalThis.Aqua);
