(function (Aqua) {
  'use strict';
  const C = Aqua.CONFIG.audio;

  class AudioManager {
    constructor(createAudio = src => new Audio(src)) {
      this.enabled = true;
      this.unlocked = false;
      this.suspended = true;
      this.track = null;
      this.music = {};
      this.effects = {};
      this.pending = new Set();
      for (const [name, file] of Object.entries(C.music)) {
        const audio = createAudio(`Sounds/${file}.mp3`);
        audio.preload = 'auto'; audio.loop = true; audio.volume = C.musicVolume;
        this.music[name] = audio;
      }
      for (const [event, file] of Object.entries(C.effects)) {
        this.effects[event] = {
          next: 0,
          voices: Array.from({ length: C.effectVoices }, () => {
            const audio = createAudio(`Sounds/${file}.mp3`);
            audio.preload = 'auto'; audio.volume = C.effectVolumes[event] ?? C.effectVolume;
            return audio;
          })
        };
      }
    }
    play(audio) {
      if (this.pending.has(audio)) return;
      this.pending.add(audio);
      try {
        // A rejected autoplay attempt is retried on the next user gesture.
        Promise.resolve(audio.play()).catch(() => {}).finally(() => this.pending.delete(audio));
      } catch { this.pending.delete(audio); }
    }
    unlock() {
      this.unlocked = true;
      this.refreshMusic();
    }
    setEnabled(enabled) {
      this.enabled = enabled;
      if (!enabled) this.stopEffects();
      this.refreshMusic();
    }
    sync(track, suspended) {
      if (track === this.track && suspended === this.suspended) return;
      if (track !== this.track) {
        if (this.track) this.music[this.track].pause();
        this.track = track;
        if (this.track) this.music[this.track].currentTime = 0;
      }
      if (suspended && !this.suspended) this.stopEffects(false);
      this.suspended = suspended;
      this.refreshMusic();
    }
    refreshMusic() {
      for (const [name, audio] of Object.entries(this.music)) {
        const shouldPlay = this.enabled && this.unlocked && !this.suspended && name === this.track;
        if (shouldPlay) {
          if (audio.paused) this.play(audio);
        } else if (!audio.paused || this.pending.has(audio)) audio.pause();
      }
    }
    effect(event) {
      const pool = this.effects[event];
      if (!this.enabled || !this.unlocked || !pool || (this.suspended && event !== 'ui')) return;
      const audio = pool.voices.find(voice => voice.paused || voice.ended) || pool.voices[pool.next];
      pool.next = (pool.next + 1) % pool.voices.length;
      audio.currentTime = 0;
      this.play(audio);
    }
    stopEffects(includeUI = true) {
      for (const [event, { voices }] of Object.entries(this.effects)) {
        if (!includeUI && event === 'ui') continue;
        for (const audio of voices) if (!audio.paused || this.pending.has(audio)) audio.pause();
      }
    }
  }
  Aqua.AudioManager = AudioManager;
})(globalThis.Aqua);
