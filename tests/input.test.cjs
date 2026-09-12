const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../js/config.js');
require('../js/entities.js');
require('../js/game.js');
require('../js/input.js');

class Surface extends EventTarget {
  setPointerCapture(id) { this.captured = id; }
}
function event(target, type, data = {}) {
  const e = new Event(type, { cancelable: true });
  Object.assign(e, data); target.dispatchEvent(e); return e;
}
function setup() {
  const document = new Surface(), window = new Surface(), button = new Surface();
  const game = new Aqua.Game(() => .5);
  let ready = true;
  new Aqua.SpeedHoldInput({ document, window, button, enabled: () => ready, onChange: held => game.setSpeedHeld(held) });
  return { document, window, button, game, setReady: value => { ready = value; } };
}
test('Space is a repeat-safe 3x hold and keyup releases even after focus or scene changes', () => {
  const { document, game } = setup();
  assert.equal(event(document, 'keydown', { code: 'Space' }).defaultPrevented, true);
  assert.equal(game.speed, 3);
  event(document, 'keydown', { code: 'Space', repeat: true }); assert.equal(game.speed, 3);
  game.togglePause(); game.clearStage(); assert.equal(game.speed, 3);
  event(document, 'keyup', { code: 'Space' }); assert.equal(game.speed, 1);
  event(document, 'keydown', { code: 'Space' }); assert.equal(game.speed, 3);
  event(document, 'keyup', { code: 'Space', ctrlKey: true }); assert.equal(game.speed, 1);
});
test('pointer hold releases outside the button, cancels safely and coexists with Space', () => {
  const { document, window, button, game } = setup();
  event(button, 'pointerdown', { button: 0, pointerId: 7 });
  assert.equal(button.captured, 7); assert.equal(game.speed, 3);
  event(document, 'keydown', { code: 'Space' });
  event(window, 'pointerup', { pointerId: 7 }); assert.equal(game.speed, 3);
  event(document, 'keyup', { code: 'Space' }); assert.equal(game.speed, 1);
  event(button, 'click'); assert.equal(game.speed, 1);
  event(button, 'pointerdown', { button: 0, pointerId: 8 });
  event(window, 'pointercancel', { pointerId: 8 }); assert.equal(game.speed, 1);
  event(button, 'pointerdown', { button: 0, pointerId: 9 });
  event(button, 'lostpointercapture', { pointerId: 9 }); assert.equal(game.speed, 1);
});
test('blur and hidden tabs clear held inputs so missed releases cannot leave 3x stuck', () => {
  const { document, window, button, game } = setup();
  event(document, 'keydown', { code: 'Space' });
  event(button, 'pointerdown', { button: 0, pointerId: 1 });
  event(window, 'blur'); assert.equal(game.speed, 1);
  event(document, 'keydown', { code: 'Space', repeat: true }); assert.equal(game.speed, 1);
  event(document, 'keydown', { code: 'Space' }); assert.equal(game.speed, 3);
  document.hidden = true; event(document, 'visibilitychange'); assert.equal(game.speed, 1);
  document.hidden = false; event(document, 'visibilitychange'); assert.equal(game.speed, 1);
});
test('loading and modified shortcuts do not activate speed; Enter holds only the speed button', () => {
  const { document, button, game, setReady } = setup();
  setReady(false); event(document, 'keydown', { code: 'Space' });
  event(button, 'pointerdown', { button: 0, pointerId: 1 }); assert.equal(game.speed, 1);
  setReady(true); event(document, 'keydown', { code: 'Space', ctrlKey: true });
  event(document, 'keydown', { code: 'Enter' });
  event(button, 'pointerdown', { button: 2, pointerId: 1 }); assert.equal(game.speed, 1);
  // The DOM bubbles a focused button's keydown to document with that same target.
  const enter = new Event('keydown', { cancelable: true });
  Object.defineProperties(enter, { code: { value: 'Enter' }, target: { value: button } });
  document.dispatchEvent(enter); assert.equal(game.speed, 3);
  event(document, 'keyup', { code: 'Enter' }); assert.equal(game.speed, 1);
});
