(function (Aqua) {
  'use strict';
  const C = Aqua.CONFIG;
  Aqua.random = (min, max, rng = Math.random) => min + rng() * (max - min);
  Aqua.clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  Aqua.distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  Aqua.target = rng => ({
    x: Aqua.random(C.bounds.left + 30, C.bounds.right - 30, rng),
    y: Aqua.random(C.bounds.top, C.bounds.bottom - 25, rng)
  });
  Aqua.createFish = (id, type, rng, initial = false, position) => {
    const point = position || Aqua.target(rng);
    const threshold = Aqua.random(C.hungerMin, C.hungerMax, rng);
    return {
      id, type, ...point, target: Aqua.target(rng), direction: -1,
      speed: Aqua.random(C.swimSpeedMin, C.swimSpeedMax, rng),
      growth: 1, meals: 0, alive: true, removed: false, arrival: null,
      hunger: initial ? threshold : 0, hungerThreshold: threshold,
      hungerState: initial ? 'HUNGRY' : 'NORMAL',
      coinTimer: 0, mealTimer: 0, idle: 0, deathTime: 0,
      phase: rng() * 9
    };
  };
  Aqua.move = (entity, target, speed, dt) => {
    const dx = target.x - entity.x, dy = target.y - entity.y;
    const distance = Math.hypot(dx, dy);
    if (Math.abs(dx) > 1) entity.direction = dx < 0 ? -1 : 1;
    if (distance > 0.1) {
      const step = Math.min(distance, speed * dt);
      entity.x += dx / distance * step;
      entity.y += dy / distance * step;
    }
    return distance;
  };
})(globalThis.Aqua);
