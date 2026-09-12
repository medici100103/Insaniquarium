(function (Aqua) {
  'use strict';
  const C = Aqua.CONFIG, { random, clamp, distance, move } = Aqua;
  class Game {
    constructor(rng = Math.random) {
      this.rng = rng;
      this.nextId = 1;
      this.events = [];
      this.restart();
    }
    emit(type, data = {}) { this.events.push({ type, ...data }); }
    drainEvents() { return this.events.splice(0); }
    restart() {
      this.events.length = 0;
      this.stats = { collected: 0, fed: 0, aliens: 0, elapsed: 0 };
      this.startStage(1);
    }
    startStage(stage) {
      this.stage = stage;
      this.state = 'PLAYING';
      this.scene = 'STAGE';
      this.paused = false;
      this.speed = 1;
      this.time = 0;
      this.money = C.stages[stage - 1].initialMoney;
      this.capacity = C.initialCapacity;
      this.egg = 0;
      this.unlocks = { guppy: false, capacity: false, piranha: false, egg: false };
      this.fish = [];
      this.food = [];
      this.coins = [];
      this.alien = null;
      this.portal = null;
      this.alienTimer = 0;
      this.warning = false;
      this.hatchTime = 0;
      this.clam = stage > 1 ? { id: this.nextId++, x: random(350, 950, this.rng), y: 597, phase: 'CLOSED', timer: 0, pearlId: null } : null;
      this.marlin = stage > 2 ? { id: this.nextId++, x: 980, y: 390, target: Aqua.target(this.rng), direction: -1, attackTimer: 0 } : null;
      this.addFish('GUPPY', true, { x: 490, y: 340 });
      this.addFish('GUPPY', true, { x: 790, y: 430 });
      this.emit('stage', { stage });
    }
    get active() { return this.state === 'PLAYING' && this.scene === 'STAGE' && !this.paused; }
    get living() { return this.fish.filter(f => f.alive); }
    get threat() { return Boolean(this.alien || this.portal); }
    addFish(type = 'GUPPY', initial = false, position) {
      const fish = Aqua.createFish(this.nextId++, type, this.rng, initial, position);
      this.fish.push(fish);
      return fish;
    }
    fail(message) { this.emit('notice', { message, tone: 'error' }); return false; }
    feed(x, y) {
      if (!this.active) return false;
      if (this.threat) return this.fail('에일리언을 먼저 클릭해 물리쳐 주세요!');
      if (this.food.filter(f => !f.removed).length >= this.capacity) return this.fail('물속의 사료를 다 먹을 때까지 기다려 주세요.');
      if (this.money < C.feedPrice) return this.fail('사료는 $5예요. 물고기가 떨어뜨린 동전을 모아 주세요.');
      this.money -= C.feedPrice;
      this.food.push({ id: this.nextId++, x: clamp(x, 35, 1245), y: clamp(y, 165, 610), floorTime: 0, removed: false });
      this.emit('feed', { x, y });
      return true;
    }
    price(item) {
      return { guppy: C.guppyPrice, capacity: C.capacityPrice, piranha: C.piranhaPrice, egg: C.stages[this.stage - 1].eggPrice }[item];
    }
    purchase(item) {
      if (!this.active || !this.unlocks[item]) return false;
      if (item === 'capacity' && this.capacity >= C.maxCapacity) return false;
      if (item === 'egg' && this.egg >= 3) return false;
      const price = this.price(item);
      if (price === undefined) return false;
      if (this.money < price) return this.fail(`$${(price - this.money).toLocaleString()} 더 모으면 구매할 수 있어요.`);
      this.money -= price;
      if (item === 'guppy') this.addFish();
      if (item === 'piranha') this.addFish('PIRANHA');
      if (item === 'capacity') this.capacity++;
      if (item === 'egg') this.egg++;
      this.emit('purchase', { item });
      if (this.egg === 3) this.clearStage();
      return true;
    }
    drop(type, x, y) {
      const coin = { id: this.nextId++, type, value: C.values[type], x, y, collected: false, removed: false, floorTime: 0, flyTime: 0 };
      this.coins.push(coin);
      return coin;
    }
    collect(id) {
      if (!this.active) return false;
      const coin = this.coins.find(c => c.id === id);
      if (!coin || coin.collected || coin.removed) return false;
      coin.collected = true;
      coin.startX = coin.x; coin.startY = coin.y;
      this.money += coin.value;
      this.stats.collected += coin.value;
      this.emit('collect', { x: coin.x, y: coin.y, value: coin.value });
      return true;
    }
    eat(fish) {
      fish.hunger = 0;
      fish.hungerState = 'NORMAL';
      fish.hungerThreshold = random(C.hungerMin, C.hungerMax, this.rng);
      fish.mealTimer = C.mealCooldown;
      if (fish.type === 'GUPPY') {
        this.stats.fed++;
        fish.meals++;
        if (fish.growth < 3 && fish.meals >= C.growthMeals[fish.growth - 1]) {
          fish.growth++;
          fish.meals = 0;
          this.emit('grow', { x: fish.x, y: fish.y, growth: fish.growth });
          this.checkUnlocks();
        }
      }
      this.emit('eat', { x: fish.x, y: fish.y });
    }
    checkUnlocks() {
      const max = Math.max(1, ...this.living.filter(f => f.type === 'GUPPY').map(f => f.growth));
      if (max >= 2 && !this.unlocks.guppy) {
        this.unlocks.guppy = this.unlocks.capacity = true;
        this.emit('unlock', { message: '구피와 사료 확장이 열렸어요! 동전을 모아 수족관을 키워 보세요.' });
      }
      if (max >= 3 && !this.unlocks.egg) {
        this.unlocks.egg = true;
        this.unlocks.piranha = this.stage >= 2;
        this.emit('unlock', { message: '첫 성체 구피 탄생! 이제 알 조각을 모을 수 있어요.' });
      }
    }
    kill(fish, eaten = false) {
      if (!fish.alive) return;
      fish.alive = false;
      fish.hungerState = 'DEAD';
      fish.deathTime = 0;
      if (eaten) { fish.removed = true; this.emit('chomp', { x: fish.x, y: fish.y }); }
      else this.emit('death', { x: fish.x, y: fish.y });
    }
    wander(fish, dt, speed = fish.speed) {
      if (fish.idle > 0) { fish.idle -= dt; return; }
      if (move(fish, fish.target, speed, dt) < 10) {
        fish.target = Aqua.target(this.rng);
        fish.idle = random(0, 1.8, this.rng);
      }
    }
    updateFish(fish, dt) {
      if (!fish.alive) {
        fish.y = Math.min(C.floor, fish.y + 45 * dt);
        if (fish.y >= C.floor) { fish.deathTime += dt; if (fish.deathTime >= C.floorFadeTime) fish.removed = true; }
        return;
      }
      fish.mealTimer = Math.max(0, fish.mealTimer - dt);
      if (!this.threat) {
        fish.hunger += dt;
        const hungry = fish.hunger - fish.hungerThreshold;
        fish.hungerState = hungry < 0 ? 'NORMAL' : hungry < C.hungryDuration ? 'HUNGRY' : 'STARVING';
        if (hungry >= C.hungryDuration + C.starvingDuration) { this.kill(fish); return; }
      }
      let food = null;
      if (!this.threat && fish.mealTimer <= 0) {
        const candidates = fish.type === 'GUPPY'
          ? this.food.filter(f => !f.removed)
          : fish.hungerState !== 'NORMAL' ? this.living.filter(f => f.type === 'GUPPY' && f.growth === 1) : [];
        food = candidates.reduce((best, f) => !best || distance(fish, f) < distance(fish, best) ? f : best, null);
      }
      if (food) {
        move(fish, food, C.chaseSpeed, dt);
        if (distance(fish, food) < (fish.type === 'GUPPY' ? 22 : 31)) {
          if (fish.type === 'GUPPY') food.removed = true;
          else this.kill(food, true);
          this.eat(fish);
        }
      } else this.wander(fish, dt);
      if (fish.type === 'PIRANHA' || fish.growth >= 2) {
        fish.coinTimer += dt;
        const interval = fish.type === 'PIRANHA' ? C.diamondInterval : C.coinInterval;
        if (fish.coinTimer >= interval) {
          fish.coinTimer -= interval;
          this.drop(fish.type === 'PIRANHA' ? 'DIAMOND' : fish.growth === 2 ? 'SILVER' : 'GOLD', fish.x, fish.y + 24);
        }
      }
    }
    updateClam(dt) {
      const clam = this.clam;
      if (!clam) return;
      clam.timer += dt;
      if (clam.phase === 'CLOSED' && clam.timer >= C.clamInterval) {
        clam.phase = 'OPENING'; clam.timer = 0;
      } else if (clam.phase === 'OPENING' && clam.timer >= C.clamAnimationDuration) {
        clam.phase = 'OPEN'; clam.timer = 0;
        clam.pearlId = this.drop('PEARL', clam.x, clam.y - 22).id;
        this.emit('pearl', { x: clam.x, y: clam.y });
      } else if (clam.phase === 'OPEN' && clam.timer >= C.clamOpenDuration) {
        const pearl = this.coins.find(c => c.id === clam.pearlId);
        if (pearl && !pearl.collected) pearl.removed = true;
        clam.pearlId = null; clam.phase = 'CLOSING'; clam.timer = 0;
      } else if (clam.phase === 'CLOSING' && clam.timer >= C.clamAnimationDuration) {
        clam.phase = 'CLOSED'; clam.timer = 0;
      }
    }
    spawnPortal() {
      // Prefer open water so spawning never consumes a fish in the same frame.
      let point = Aqua.target(this.rng), bestGap = -1;
      for (let i = 0; i < 20; i++) {
        const candidate = Aqua.target(this.rng);
        const gap = Math.min(...this.living.map(f => distance(f, candidate)));
        if (gap > bestGap) { point = candidate; bestGap = gap; }
      }
      this.portal = { id: this.nextId++, ...point, time: 0 };
      this.speed = 1;
      this.emit('portal', point);
    }
    hitAlien(x, y, source = 'player') {
      if (!this.active || !this.alien) return false;
      const alien = this.alien;
      alien.hp--;
      if (source === 'player') {
        const front = (x - alien.x) * alien.direction >= -10;
        alien.stun = C.alienStun;
        if (front) {
          alien.x = clamp(alien.x - alien.direction * C.alienKnockback, C.bounds.left, C.bounds.right);
          alien.knocks++;
          if (alien.knocks >= 4) { alien.retreat = 0.55; alien.direction *= -1; alien.knocks = 0; }
        }
      }
      this.emit('hit', { x, y });
      if (alien.hp <= 0) {
        this.emit('defeat', { x: alien.x, y: alien.y });
        this.alien = null; this.alienTimer = 0; this.warning = false;
        this.stats.aliens++;
      }
      return true;
    }
    updateThreat(dt) {
      if (this.stage === 1) return;
      if (this.portal) {
        this.portal.time += dt;
        if (this.portal.time >= C.portalDuration) {
          this.alien = { id: this.nextId++, x: this.portal.x, y: this.portal.y, hp: C.alienHP, direction: -1, stun: 0, knocks: 0, retreat: 0 };
          this.portal = null;
          this.emit('alien');
        }
      } else if (!this.alien) {
        this.alienTimer += dt;
        if (!this.warning && this.alienTimer >= C.alienInterval - C.warningDuration) {
          this.warning = true; this.speed = 1; this.emit('warning');
        }
        if (this.alienTimer >= C.alienInterval) this.spawnPortal();
      } else {
        const alien = this.alien;
        if (alien.stun > 0) { alien.stun -= dt; return; }
        if (alien.retreat > 0) {
          alien.retreat -= dt;
          alien.x = clamp(alien.x + alien.direction * C.alienSpeed * dt, C.bounds.left, C.bounds.right);
          return;
        }
        const target = this.living.reduce((best, f) => !best || distance(alien, f) < distance(alien, best) ? f : best, null);
        if (target) {
          move(alien, target, C.alienSpeed, dt);
          if (distance(alien, target) < C.alienContact) this.kill(target, true);
        }
      }
    }
    updateMarlin(dt) {
      if (!this.marlin) return;
      const marlin = this.marlin;
      if (this.alien) {
        move(marlin, this.alien, C.marlinSpeed, dt);
        if (distance(marlin, this.alien) < 65) {
          marlin.attackTimer += dt;
          if (marlin.attackTimer >= C.marlinAttackInterval) {
            marlin.attackTimer -= C.marlinAttackInterval;
            this.hitAlien(this.alien.x, this.alien.y, 'marlin');
          }
        } else marlin.attackTimer = 0;
      } else { marlin.attackTimer = 0; this.wander(marlin, dt, 48); }
    }
    clearStage() {
      this.scene = 'HATCHERY'; this.hatchTime = 0; this.speed = 1;
      this.emit('clear', { stage: this.stage });
    }
    continueStage() {
      if (this.scene !== 'HATCHERY' || this.hatchTime < C.hatchDuration) return false;
      if (this.stage < 3) this.startStage(this.stage + 1);
      return true;
    }
    togglePause() {
      if (this.state !== 'PLAYING' || this.scene !== 'STAGE') return;
      this.paused = !this.paused;
      this.emit('pause');
    }
    toggleSpeed() {
      if (!this.active) return;
      if (this.threat || this.warning) return this.fail('전투 중에는 1배속으로 진행돼요.');
      this.speed = this.speed === 1 ? 4 : 1;
      this.emit('speed');
    }
    update(dt) {
      if (!Number.isFinite(dt) || dt <= 0 || this.paused || this.state !== 'PLAYING') return;
      if (this.scene === 'HATCHERY') {
        this.hatchTime += dt;
        if (this.stage === 3 && this.hatchTime >= C.hatchDuration) { this.scene = 'ENDING'; this.emit('ending'); }
        return;
      }
      if (this.scene !== 'STAGE') return;
      this.time += dt; this.stats.elapsed += dt;
      this.updateThreat(dt);
      for (const food of this.food) {
        food.y = Math.min(C.floor, food.y + C.foodFallSpeed * dt);
        if (food.y >= C.floor) { food.floorTime += dt; if (food.floorTime >= C.floorFadeTime) food.removed = true; }
      }
      // Feed the hungriest fish first when several touch the same pellet.
      for (const fish of [...this.fish].sort((a, b) => b.hunger - a.hunger)) this.updateFish(fish, dt);
      this.updateClam(dt);
      this.updateMarlin(dt);
      for (const coin of this.coins) {
        if (coin.collected) {
          coin.flyTime += dt;
          const t = Math.min(1, coin.flyTime / 0.45), eased = 1 - (1 - t) ** 3;
          coin.x = coin.startX + (1110 - coin.startX) * eased;
          coin.y = coin.startY + (65 - coin.startY) * eased - Math.sin(t * Math.PI) * 90;
          if (t >= 1) coin.removed = true;
        } else if (coin.type !== 'PEARL') {
          coin.y = Math.min(C.floor, coin.y + C.moneyFallSpeed * dt);
          if (coin.y >= C.floor) { coin.floorTime += dt; if (coin.floorTime >= C.floorFadeTime) coin.removed = true; }
        }
      }
      this.fish = this.fish.filter(f => !f.removed);
      this.food = this.food.filter(f => !f.removed);
      this.coins = this.coins.filter(c => !c.removed);
      if (this.living.length === 0) {
        this.state = 'GAME_OVER'; this.speed = 1; this.emit('gameover');
      }
    }
  }
  Aqua.Game = Game;
})(globalThis.Aqua);
