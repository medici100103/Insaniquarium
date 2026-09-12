/* Run with: node --test tests/game.test.cjs (no installed packages required). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../js/config.js');
require('../js/entities.js');
require('../js/game.js');
const { Game, CONFIG: C } = globalThis.Aqua;

function seeded(seed = 42) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
function advance(game, seconds, beforeStep) {
  for (let t = 0; t < seconds - .00001; t += .025) { beforeStep?.(game, t); game.update(.025); }
}
function adult(game, fish = game.fish[0]) {
  meals(game, fish, 7);
  return fish;
}
function meals(game, fish, count) {
  // Fixture setup: each meal follows a separate hunger cycle.
  for (let i = 0; i < count; i++) {
    fish.hunger = fish.hungerThreshold;
    fish.hungerState = 'HUNGRY';
    game.eat(fish);
  }
}

test('fresh game matches the supplied starting conditions', () => {
  const g = new Game(seeded());
  assert.equal(g.stage, 1); assert.equal(g.money, 100); assert.equal(g.capacity, 3);
  assert.equal(g.living.length, 2); assert.equal(g.egg, 0);
  assert.ok(g.fish.every(f => f.growth === 1 && f.hungerState === 'HUNGRY'));
  assert.ok(Object.values(g.unlocks).every(v => v === false));
});
test('feed respects cost, capacity, pause, and active threat', () => {
  const g = new Game(seeded());
  for (let i = 0; i < 3; i++) assert.equal(g.feed(400, 300), true);
  assert.equal(g.feed(400, 300), false); assert.equal(g.money, 85);
  g.food = []; g.money = 4; assert.equal(g.feed(400, 300), false); assert.equal(g.money, 4);
  g.money = 100; g.togglePause(); assert.equal(g.feed(400, 300), false);
  g.togglePause(); g.spawnPortal(); assert.equal(g.feed(400, 300), false);
});
test('real collision consumes a pellet only once and drives growth unlocks', () => {
  const g = new Game(seeded());
  g.fish.forEach(f => { f.x = 500; f.y = 350; });
  g.feed(500, 350); advance(g, .05);
  assert.equal(g.food.length, 0); assert.equal(g.fish.reduce((n, f) => n + f.meals, 0), 1);
  const fish = g.fish.find(f => f.meals === 1);
  meals(g, fish, 2);
  assert.equal(fish.growth, 2); assert.equal(g.unlocks.guppy, true); assert.equal(g.unlocks.capacity, true);
  assert.equal(g.unlocks.egg, false);
  meals(g, fish, 4);
  assert.equal(fish.growth, 3); assert.equal(g.unlocks.egg, true); assert.equal(g.unlocks.piranha, false);
});
test('silver, gold, diamonds and pearls have correct values and cannot be collected twice', () => {
  const g = new Game(seeded());
  for (const type of Object.keys(C.values)) {
    const coin = g.drop(type, 400, 300), oldMoney = g.money;
    assert.equal(g.collect(coin.id), true); assert.equal(g.collect(coin.id), false);
    assert.equal(g.money, oldMoney + C.values[type]);
  }
  advance(g, .5); assert.equal(g.coins.length, 0);
});
test('grown fish produce coins at ten seconds and expired items disappear', () => {
  const g = new Game(seeded());
  meals(g, g.fish[0], 3);
  adult(g, g.fish[1]); advance(g, 10.05);
  assert.ok(g.coins.some(c => c.type === 'SILVER')); assert.ok(g.coins.some(c => c.type === 'GOLD'));
  const coin = g.drop('GOLD', 50, C.floor), id = coin.id;
  g.feed(50, 610); advance(g, 3);
  assert.ok(!g.coins.find(c => c.id === id)); assert.equal(g.food.length, 0);
});
test('hunger progresses to starvation, food recovers it, and dead fish cannot eat', () => {
  const g = new Game(seeded());
  advance(g, 5.05); assert.ok(g.fish.every(f => f.hungerState === 'STARVING'));
  const fish = g.fish[0]; g.feed(fish.x, fish.y); advance(g, .05);
  assert.equal(fish.hungerState, 'NORMAL');
  advance(g, 7.1); assert.equal(g.living.length, 1);
  assert.equal(g.fish.find(f => f.id !== fish.id).hungerState, 'DEAD');
  advance(g, 30); assert.equal(g.state, 'GAME_OVER');
});
test('purchases are atomic, capacity stops at nine, and unlocks persist after death', () => {
  const g = new Game(seeded()); adult(g); g.money = 100;
  assert.equal(g.purchase('guppy'), true); assert.equal(g.purchase('guppy'), false);
  assert.equal(g.money, 0); assert.equal(g.living.length, 3);
  g.money = 1000;
  for (let i = 0; i < 10; i++) g.purchase('capacity');
  assert.equal(g.capacity, 9); assert.equal(g.money, 400);
  g.kill(g.fish[0]); assert.equal(g.unlocks.egg, true);
});
test('piranhas eat only baby guppies and never pellets or adults', () => {
  const g = new Game(seeded()); g.startStage(2);
  const big = adult(g); big.x = 600; big.y = 350;
  const baby = g.fish[1]; baby.x = 600; baby.y = 350;
  const p = g.addFish('PIRANHA', true, { x: 600, y: 350 });
  g.feed(100, 200); advance(g, .05);
  assert.equal(baby.alive, false); assert.equal(big.alive, true);
  assert.equal(p.hungerState, 'NORMAL'); assert.equal(g.food.length, 1);
  p.coinTimer = C.diamondInterval - .05; advance(g, .1);
  const diamond = g.coins.find(c => c.type === 'DIAMOND');
  assert.ok(diamond);
  assert.equal(diamond.value, 500);
  const beforeCollect = g.money;
  g.collect(diamond.id);
  assert.equal(g.money, beforeCollect + 500);
});
test('alien warning, portal, frozen hunger, click damage and combat recovery', () => {
  const g = new Game(seeded()); g.startStage(2); adult(g); adult(g, g.fish[1]);
  g.alienTimer = 54.9; g.setSpeedHeld(true); advance(g, .2);
  assert.equal(g.warning, true); assert.equal(g.speed, 3);
  g.alienTimer = 59.95; advance(g, .1); assert.ok(g.portal);
  assert.equal(g.speed, 3);
  const hunger = g.fish[0].hunger; advance(g, 1.3);
  assert.ok(g.alien); assert.equal(g.fish[0].hunger, hunger);
  assert.equal(g.speed, 3);
  g.setSpeedHeld(false); assert.equal(g.speed, 1);
  g.setSpeedHeld(true); assert.equal(g.speed, 3);
  const money = g.money; assert.equal(g.feed(300, 300), false); assert.equal(g.money, money);
  for (let i = 0; i < 29; i++) g.hitAlien(g.alien.x, g.alien.y);
  assert.equal(g.alien.hp, 1); g.hitAlien(g.alien.x, g.alien.y);
  assert.equal(g.alien, null); assert.equal(g.stats.aliens, 1);
  assert.equal(g.speed, 3);
  advance(g, .1); assert.ok(g.fish[0].hunger > hunger); assert.equal(g.feed(300, 300), true);
});
test('portal and alien freeze only guppy income and resume the saved timer without a payout backlog', () => {
  const g = new Game(seeded()); g.startStage(2);
  meals(g, g.fish[0], 3); adult(g, g.fish[1]);
  const guppies = [...g.fish];
  guppies.forEach(f => { f.coinTimer = 9.95; });
  g.alienTimer = 55;
  advance(g, .1); assert.equal(g.warning, true);
  assert.equal(g.coins.filter(c => c.type === 'SILVER' || c.type === 'GOLD').length, 2);
  const existing = g.coins.map(c => c.id);
  guppies.forEach(f => { f.coinTimer = 9.5; });
  const piranha = g.addFish('PIRANHA'); piranha.coinTimer = 14.9;
  g.setSpeedHeld(true); g.spawnPortal();
  advance(g, .5);
  assert.ok(g.portal); assert.ok(guppies.every(f => f.coinTimer === 9.5));
  assert.ok(g.coins.some(c => c.type === 'DIAMOND'));
  assert.equal(g.collect(existing[0]), true);
  advance(g, .75); assert.ok(g.alien); g.alien.stun = 30;
  advance(g, 21);
  assert.ok(guppies.every(f => f.alive && f.coinTimer === 9.5));
  assert.ok(!g.coins.some(c => c.type === 'SILVER' || c.type === 'GOLD'));
  assert.ok(g.coins.some(c => c.type === 'PEARL'));
  assert.equal(g.speed, 3);
  while (g.alien) g.hitAlien(g.alien.x, g.alien.y);
  advance(g, .4);
  assert.ok(!g.coins.some(c => c.type === 'SILVER' || c.type === 'GOLD'));
  advance(g, .2);
  assert.equal(g.coins.filter(c => c.type === 'SILVER').length, 1);
  assert.equal(g.coins.filter(c => c.type === 'GOLD').length, 1);
  assert.ok(guppies.every(f => f.coinTimer < .2));
  assert.equal(g.speed, 3);
});
test('alien consumes live fish and pets do not prevent game over', () => {
  const g = new Game(seeded()); g.startStage(3);
  g.fish.forEach(f => { f.x = 400; f.y = 350; });
  g.alien = { id: 999, x: 400, y: 350, hp: 30, direction: -1, stun: 0, retreat: 0, knocks: 0 };
  advance(g, .1); assert.equal(g.state, 'GAME_OVER'); assert.ok(g.clam); assert.ok(g.marlin);
});
test('clam opens and closes at half speed while retaining its 20 second wait and 5 second pearl window', () => {
  const g = new Game(seeded()); g.startStage(2);
  const keepFed = game => game.fish.forEach(f => { f.hunger = 0; });
  advance(g, 19.9, keepFed); assert.equal(g.clam.phase, 'CLOSED');
  advance(g, .7, keepFed); assert.equal(g.clam.phase, 'OPENING');
  assert.equal(g.coins.filter(c => c.type === 'PEARL').length, 0);
  advance(g, .5, keepFed);
  assert.equal(g.clam.phase, 'OPEN'); assert.equal(g.coins.filter(c => c.type === 'PEARL').length, 1);
  assert.equal(g.coins[0].y, g.clam.y - 22);
  advance(g, 4.8, keepFed); assert.equal(g.clam.phase, 'OPEN');
  assert.equal(g.coins.filter(c => c.type === 'PEARL').length, 1);
  advance(g, .2, keepFed); assert.equal(g.coins.length, 0); assert.equal(g.clam.phase, 'CLOSING');
  advance(g, .5, keepFed); assert.equal(g.clam.phase, 'CLOSING');
  advance(g, .5, keepFed); assert.equal(g.clam.phase, 'CLOSED');
});
test('marlin deals three damage per second of contact without knockback and can finish an alien', () => {
  const g = new Game(seeded()); g.startStage(3);
  g.alien = { id: 999, x: 1000, y: 300, hp: 30, direction: -1, stun: 10, retreat: 0, knocks: 0 };
  g.marlin.x = 1000; g.marlin.y = 300;
  advance(g, 2.05);
  assert.equal(g.alien.hp, 24); assert.equal(g.alien.x, 1000); assert.equal(g.alien.knocks, 0);
  g.alien.hp = 2;
  advance(g, 1);
  assert.equal(g.alien, null); assert.equal(g.stats.aliens, 1);
});
test('hatchery blocks actions, resets stage objects, unlocks pets and reaches ending', () => {
  const g = new Game(seeded());
  for (let stage = 1; stage <= 3; stage++) {
    assert.equal(g.price('egg'), [300, 1000, 2500][stage - 1]);
    adult(g); g.money = g.price('egg') * 4;
    const startingMoney = g.money;
    g.purchase('egg'); g.purchase('egg'); g.purchase('egg');
    assert.equal(g.money, startingMoney - [300, 1000, 2500][stage - 1] * 3);
    assert.equal(g.scene, 'HATCHERY'); const money = g.money;
    assert.equal(g.purchase('egg'), false); assert.equal(g.feed(500, 300), false); assert.equal(g.money, money);
    assert.equal(g.continueStage(), false); advance(g, 2.5);
    if (stage < 3) {
      assert.equal(g.continueStage(), true); assert.equal(g.stage, stage + 1);
      assert.equal(g.money, 100); assert.equal(g.living.length, 2); assert.equal(g.egg, 0);
      assert.equal(g.food.length, 0); assert.equal(g.coins.length, 0); assert.equal(g.alien, null);
      assert.ok(g.clam); assert.equal(Boolean(g.marlin), stage === 2);
    } else assert.equal(g.scene, 'ENDING');
  }
  g.restart(); assert.equal(g.stage, 1); assert.equal(g.clam, null); assert.equal(g.marlin, null);
  assert.equal(g.stats.collected, 0); assert.equal(g.speed, 1);
});
test('pause freezes all clocks and rejects gameplay input', () => {
  const g = new Game(seeded()); adult(g); g.togglePause();
  const before = JSON.stringify({ fish: g.fish, time: g.time, money: g.money });
  advance(g, 100); assert.equal(g.purchase('guppy'), false); assert.equal(g.feed(500, 300), false);
  assert.equal(JSON.stringify({ fish: g.fish, time: g.time, money: g.money }), before);
});
test('complete campaign is economically playable from $100 using only normal actions', () => {
  const g = new Game(seeded(182));
  let nextFeed = 0, nextHit = 0, elapsed = 0;
  const stages = [];
  for (; elapsed < 2400 && g.scene !== 'ENDING' && g.state !== 'GAME_OVER'; elapsed += .025) {
    if (g.scene === 'HATCHERY') {
      g.update(.025);
      if (g.continueStage()) { nextFeed = 0; nextHit = 0; }
      continue;
    }
    for (const coin of g.coins) g.collect(coin.id);
    if (g.alien && g.time >= nextHit) { g.hitAlien(g.alien.x, g.alien.y); nextHit = g.time + .1; }
    const needs = g.living.filter(f => f.type === 'GUPPY' && g.needsFood(f));
    needs.sort((a, b) => b.hunger - a.hunger);
    if (needs.length && !g.threat && g.time >= nextFeed && !g.food.length) {
      g.feed(needs[0].x, needs[0].y); nextFeed = g.time + .3;
    }
    if (g.unlocks.guppy && g.living.length < 8 && g.money >= 170) g.purchase('guppy');
    if (g.unlocks.egg && g.money >= g.price('egg') + 100) {
      g.purchase('egg');
      if (g.scene === 'HATCHERY') stages.push({ stage: g.stage, seconds: Math.round(g.time), fish: g.living.length });
    }
    g.update(.025); g.drainEvents();
  }
  assert.equal(g.scene, 'ENDING', `Campaign failed: ${JSON.stringify({ state: g.state, stage: g.stage, money: g.money, fish: g.living.length, elapsed, stages })}`);
  assert.equal(stages.length, 3);
  console.log('Campaign simulation:', JSON.stringify({ stages, simulatedSeconds: Math.round(elapsed), defeatedAliens: g.stats.aliens }));
});

test('satiated guppies neither pursue nor consume food, then eat when hungry', () => {
  const g = new Game(seeded());
  const fish = g.fish[0];
  g.eat(fish);
  fish.x = 400; fish.y = 350; fish.idle = 5; fish.mealTimer = 0;
  g.fish[1].x = 1200; g.fish[1].y = 550;
  g.eat(g.fish[1]);
  g.feed(430, 350);
  advance(g, 1);
  assert.equal(fish.x, 400); assert.equal(fish.y, 350);
  assert.equal(g.food.length, 1); assert.equal(fish.meals, 1);
  assert.equal(g.eat(fish), false); assert.equal(fish.meals, 1);
  fish.hunger = fish.hungerThreshold;
  advance(g, .5);
  assert.equal(g.food.length, 0); assert.equal(fish.meals, 2);
  assert.equal(fish.hungerState, 'NORMAL');
  g.feed(fish.x, fish.y); advance(g, 1.5);
  assert.equal(fish.meals, 2); assert.equal(g.food.length, 1);
});
test('starving guppies can eat, but dead guppies cannot', () => {
  const g = new Game(seeded());
  const fish = g.fish[0];
  fish.hunger = fish.hungerThreshold + C.hungryDuration + 1;
  advance(g, .025); assert.equal(fish.hungerState, 'STARVING');
  g.feed(fish.x, fish.y); advance(g, .05);
  assert.equal(fish.hungerState, 'NORMAL'); assert.equal(fish.meals, 1);
  g.kill(fish); assert.equal(g.eat(fish), false); assert.equal(fish.meals, 1);
});
test('unlock gates are independent of funds and piranha stays locked throughout 1-1', () => {
  for (let stage = 1; stage <= 3; stage++) {
    const g = new Game(seeded()); g.startStage(stage); g.money = 10000;
    for (const item of ['guppy', 'capacity', 'piranha', 'egg']) assert.equal(g.purchase(item), false);
    meals(g, g.fish[0], 3);
    assert.deepEqual(g.unlocks, { guppy: true, capacity: true, piranha: false, egg: false });
    g.money = 0; assert.equal(g.purchase('guppy'), false); assert.equal(g.unlocks.guppy, true);
    meals(g, g.fish[0], 4);
    assert.deepEqual(g.unlocks, { guppy: true, capacity: true, piranha: stage > 1, egg: true });
    if (stage === 1) { g.money = 10000; assert.equal(g.purchase('piranha'), false); }
  }
});
test('egg UI shows thirds before purchase, after first purchase and after second purchase', () => {
  const g = new Game(seeded()); adult(g); g.money = g.price('egg') * 3;
  assert.equal(g.eggFrame, 0);
  g.purchase('egg'); assert.equal(g.eggFrame, 1); assert.equal(g.scene, 'STAGE');
  g.purchase('egg'); assert.equal(g.eggFrame, 2); assert.equal(g.scene, 'STAGE');
  g.purchase('egg'); assert.equal(g.eggFrame, 2); assert.equal(g.scene, 'HATCHERY');
});
test('held developer speed survives gameplay transitions and releases in every scene', () => {
  const g = new Game(seeded());
  g.togglePause(); g.setSpeedHeld(true); assert.equal(g.speed, 3);
  g.setSpeedHeld(true); assert.equal(g.speed, 3);
  g.togglePause(); g.clearStage(); assert.equal(g.speed, 3);
  g.setSpeedHeld(false); assert.equal(g.speed, 1); g.setSpeedHeld(true);
  advance(g, 2.5); g.continueStage(); assert.equal(g.speed, 3); assert.equal(g.stage, 2);
  g.fish.forEach(f => g.kill(f)); advance(g, .025);
  assert.equal(g.state, 'GAME_OVER'); assert.equal(g.speed, 3);
  g.setSpeedHeld(false); assert.equal(g.speed, 1); g.setSpeedHeld(true);
  g.restart(); assert.equal(g.stage, 1); assert.equal(g.speed, 3);
  g.setSpeedHeld(false); assert.equal(g.speed, 1);
  g.startStage(3); g.setSpeedHeld(true); g.clearStage(); advance(g, 2.5);
  assert.equal(g.scene, 'ENDING'); assert.equal(g.speed, 3);
  g.setSpeedHeld(false); assert.equal(g.speed, 1);
});

test('purchased guppy falls from above, splashes once and settles before swimming', () => {
  const g = new Game(seeded()); adult(g); g.money = 100;
  assert.equal(g.purchase('guppy'), true); assert.equal(g.money, 0);
  const fish = g.fish.at(-1);
  assert.ok(fish.y < 0); assert.equal(fish.arrival.phase, 'FALLING');
  assert.equal(g.underwater.includes(fish), false); assert.equal(g.needsFood(fish), false);
  g.drainEvents(); const startingY = fish.y;
  advance(g, .1); assert.ok(fish.y > startingY); assert.equal(fish.hunger, 0);
  advance(g, 1);
  assert.equal(fish.arrival, null); assert.ok(fish.y >= C.fishDropSurfaceY);
  assert.equal(g.underwater.includes(fish), true);
  assert.equal(g.drainEvents().filter(e => e.type === 'splash').length, 1);
  advance(g, 1); assert.equal(g.drainEvents().filter(e => e.type === 'splash').length, 0);
});
test('arrival pauses with the game, preserves developer speed, and counts as a living fish', () => {
  const g = new Game(seeded()); adult(g); g.money = 100; g.purchase('guppy');
  const incoming = g.fish.at(-1);
  g.fish.filter(f => f !== incoming).forEach(f => g.kill(f, true));
  g.setSpeedHeld(true); g.togglePause(); const y = incoming.y;
  advance(g, 5); assert.equal(incoming.y, y);
  g.togglePause(); advance(g, .1); assert.equal(g.state, 'PLAYING');
  assert.equal(g.speed, 3); assert.ok(incoming.y > y);
  g.restart(); assert.equal(g.fish.some(f => f.arrival), false);
});
test('egg cracking emits its sound cue once at the cracking frame, including fast steps', () => {
  const g = new Game(seeded()); g.clearStage(); g.drainEvents();
  advance(g, .75); assert.equal(g.drainEvents().filter(e => e.type === 'hatch').length, 0);
  g.update(.3); assert.equal(g.drainEvents().filter(e => e.type === 'hatch').length, 1);
  advance(g, 3); assert.equal(g.drainEvents().filter(e => e.type === 'hatch').length, 0);
});
