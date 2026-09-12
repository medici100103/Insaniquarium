const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../js/config.js');
require('../js/audio.js');
const { AudioManager, CONFIG: C } = globalThis.Aqua;

class Media {
  constructor(src) { this.src = src; this.paused = true; this.ended = false; this.currentTime = 0; this.plays = 0; }
  play() { this.paused = false; this.plays++; return Promise.resolve(); }
  pause() { this.paused = true; }
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('music waits for input, switches between ocean and alien, and obeys pause and mute', async () => {
  const audio = new AudioManager(src => new Media(src));
  assert.ok(Object.values(audio.music).every(media => media.volume === 0.125));
  for (const [event, pool] of Object.entries(audio.effects)) {
    const volume = ['collect', 'ui', 'hit'].includes(event) ? 0.35 : 0.7;
    assert.ok(pool.voices.every(media => media.volume === volume), `${event} volume`);
  }
  audio.sync('default', false);
  assert.equal(audio.music.default.paused, true);
  audio.unlock(); await flush();
  assert.equal(audio.music.default.paused, false);
  assert.equal(audio.music.default.loop, true);
  audio.sync('alien', false); await flush();
  assert.equal(audio.music.default.paused, true); assert.equal(audio.music.alien.paused, false);
  audio.music.alien.currentTime = 12;
  audio.sync('alien', true); assert.equal(audio.music.alien.paused, true);
  audio.sync('alien', false); await flush();
  assert.equal(audio.music.alien.currentTime, 12); assert.equal(audio.music.alien.paused, false);
  audio.sync('default', false); await flush();
  assert.equal(audio.music.alien.paused, true); assert.equal(audio.music.default.paused, false);
  audio.setEnabled(false); assert.equal(audio.music.default.paused, true);
  audio.setEnabled(true); await flush(); assert.equal(audio.music.default.paused, false);
});
test('supplied MP3s are mapped to the correct events with overlapping effects and a shared mute', async () => {
  const audio = new AudioManager(src => new Media(src));
  audio.sync('default', false); audio.unlock(); await flush();
  const expected = { ui: 'UIClick', collect: 'MoneyAcquisition', hit: 'Hit', splash: 'FishDrop', hatch: 'EggDestruction', chomp: 'Carnibore', portal: 'AlienAppearance' };
  for (const [event, file] of Object.entries(expected)) {
    audio.effect(event);
    assert.ok(audio.effects[event].voices.some(voice => !voice.paused && voice.src === `Sounds/${file}.mp3`));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'Sounds', `${file}.mp3`)));
  }
  for (const file of Object.values(C.audio.music)) assert.ok(fs.existsSync(path.join(__dirname, '..', 'Sounds', `${file}.mp3`)));
  audio.effect('hit'); audio.effect('hit'); await flush();
  assert.equal(audio.effects.hit.voices.filter(voice => !voice.paused).length, 3);
  audio.setEnabled(false); audio.effect('splash');
  assert.ok(Object.values(audio.effects).every(pool => pool.voices.every(voice => voice.paused)));
  audio.setEnabled(true); audio.sync('default', true); await flush();
  audio.effect('collect'); assert.ok(audio.effects.collect.voices.every(voice => voice.paused));
  audio.effect('ui'); assert.ok(audio.effects.ui.voices.some(voice => !voice.paused));
});
test('blocked autoplay does not crash and can be retried by the next gesture', async () => {
  let attempts = 0;
  const audio = new AudioManager(src => {
    const media = new Media(src);
    media.play = () => {
      if (++attempts === 1) return Promise.reject(new Error('Autoplay blocked'));
      media.paused = false; return Promise.resolve();
    };
    return media;
  });
  audio.sync('default', false); audio.unlock(); await flush();
  assert.equal(audio.pending.size, 0); assert.equal(audio.music.default.paused, true);
  audio.unlock(); await flush(); assert.equal(audio.music.default.paused, false);
});
