(function (Aqua) {
  'use strict';
  const C = Aqua.CONFIG;
  const $ = selector => document.querySelector(selector);
  const tank = $('#tank'), layer = $('#entities'), effectLayer = $('#effects');
  const arrivalLayer = $('#arrivals');
  const game = new Aqua.Game();
  const audio = new Aqua.AudioManager(src => {
    const media = new Audio(src);
    $('#game-audio').append(media);
    return media;
  });
  const nodes = new Map();
  const transient = [];
  const buttons = [...document.querySelectorAll('[data-buy]')];
  let ready = false, lastFrame = 0, accumulator = 0, uiKey = '', sceneKey = '';
  let notice = { text: '', tone: '', until: 0 };
  let uiTime = 0, guidePaused = false;
  let lastFocus = null, manualHelp = false;

  function text(el, value) { if (el.textContent !== String(value)) el.textContent = value; }
  function icon(el, name) { el.querySelector('use').setAttribute('href', `#i-${name}`); }
  function sprite(el, asset, frame = 0, columns = 3, rows = 3) {
    const key = `${asset}/${columns}/${rows}`;
    if (el.dataset.sheet !== key) {
      el.style.backgroundImage = `url("Images/${asset}.png")`;
      el.style.backgroundSize = `${columns * 100}% ${rows * 100}%`;
      el.dataset.sheet = key;
    }
    frame = Math.max(0, Math.min(columns * rows - 1, Math.floor(frame)));
    const col = frame % columns, row = Math.floor(frame / columns);
    el.style.backgroundPosition = `${columns > 1 ? col * 100 / (columns - 1) : 0}% ${rows > 1 ? row * 100 / (rows - 1) : 0}%`;
  }
  function position(el, entity, width, height = width) {
    el.style.width = `${width}px`; el.style.height = `${height}px`;
    el.style.transform = `translate3d(${entity.x - width / 2}px,${entity.y - height / 2}px,0)`;
  }
  function entityNode(id, className, build) {
    if (!nodes.has(id)) {
      const el = build ? build() : document.createElement('div');
      el.className = `entity ${className}`;
      layer.append(el); nodes.set(id, el);
    }
    const el = nodes.get(id); el.dataset.seen = '1'; return el;
  }
  function announce(message, tone = '', duration = 5) { notice = { text: message, tone, until: uiTime + duration }; }
  function syncAudio() {
    const track = game.scene === 'STAGE' && game.threat ? 'alien' : 'default';
    audio.sync(track, !ready || game.paused || manualHelp || document.hidden || game.state === 'GAME_OVER');
  }
  function sound(kind) {
    audio.effect(kind);
  }
  function effect(className, x, y, duration = 1, content = '') {
    const el = document.createElement('span');
    el.className = `effect ${className}`; el.style.left = `${x}px`; el.style.top = `${y}px`;
    el.textContent = content; effectLayer.append(el);
    transient.push({ el, remaining: duration, duration });
    return el;
  }
  function sparkles(x, y) {
    for (let i = 0; i < 12; i++) {
      const el = effect('spark-particle', x, y, .9);
      el.style.setProperty('--dx', `${Math.cos(i / 6 * Math.PI) * (40 + Math.random() * 35)}px`);
      el.style.setProperty('--dy', `${Math.sin(i / 6 * Math.PI) * (40 + Math.random() * 35)}px`);
    }
  }
  function animatedEffect(asset, x, y, size = 110) {
    const el = effect('sprite', x - size / 2, y - size / 2, .55);
    el.style.width = el.style.height = `${size}px`;
    transient[transient.length - 1].asset = asset;
  }
  function events() {
    syncAudio();
    for (const event of game.drainEvents()) {
      if (event.type === 'stage') {
        layer.replaceChildren(); arrivalLayer.replaceChildren(); nodes.clear(); effectLayer.replaceChildren(); transient.length = 0;
        accumulator = 0; uiKey = ''; sceneKey = ''; notice.until = 0;
        if (event.stage > 1) announce(event.stage === 2 ? '조개가 함께해요! 입이 열리면 진주를 클릭하세요.' : '청새치가 합류했어요! 마지막 알을 완성해 보세요.', 'success', 7);
      }
      if (event.type === 'notice') { announce(event.message, event.tone, 3); if (event.tone === 'error') sound('error'); }
      if (event.type === 'feed') effect('ring', event.x, event.y, .6);
      if (event.type === 'splash') {
        effect('splash-ring', event.x, event.y, .65);
        for (let i = 0; i < 10; i++) {
          const drop = effect('water-drop', event.x, event.y, .65);
          drop.style.setProperty('--dx', `${(i - 4.5) * 13}px`);
          drop.style.setProperty('--dy', `${-30 - Math.random() * 45}px`);
        }
      }
      if (event.type === 'collect') {
        effect('float-text', event.x, event.y - 12, 1, `+$${event.value}`);
        $('.wallet').classList.remove('bump');
        void $('.wallet').offsetWidth;
        $('.wallet').classList.add('bump');
      }
      if (event.type === 'grow') { sparkles(event.x, event.y); effect('float-text grow', event.x, event.y - 35, 1, event.growth === 3 ? '성체로 성장!' : '쑥쑥! 2/3'); }
      if (event.type === 'unlock') { announce(event.message, 'success', 6); sound('grow'); }
      if (event.type === 'purchase') {
        const messages = { guppy: '새 아기 구피가 찾아왔어요. 먹이로 쑥쑥 키워 주세요!', capacity: `사료를 동시에 ${game.capacity}개까지 줄 수 있어요.`, piranha: '피라냐는 아기 구피를 먹고 보석을 만들어요.', egg: `알 구매 ${game.egg} / 3회! 조금씩 완성되고 있어요.` };
        announce(messages[event.item], 'success', 4);
      }
      if (event.type === 'death') announce('구피가 굶주리고 있어요. 초록색 물고기에게 먹이를 주세요.', 'error', 5);
      if (event.type === 'hit') animatedEffect('Effect_Hit', event.x, event.y, 100);
      if (event.type === 'chomp') animatedEffect('Effect_Carnivore', event.x, event.y, 115);
      if (event.type === 'defeat') { sparkles(event.x, event.y); announce('에일리언을 물리쳤어요! 다시 구피들을 돌봐 주세요.', 'success', 5); }
      if (event.type === 'pearl') announce('조개가 입을 열었어요. 반짝이는 진주를 클릭하세요!', 'success', 5);
      if (event.type === 'clear') { sceneKey = ''; accumulator = 0; }
      if (event.type === 'gameover') { text($('#gameover-coins'), `$${game.stats.collected.toLocaleString()}`); }
      sound(event.type);
    }
  }
  function drawFish(fish) {
    const el = entityNode(fish.id, 'fish-entity', () => {
      const node = document.createElement('div');
      node.innerHTML = '<div class="fish-visual sprite"></div><span class="fish-label"></span>';
      return node;
    });
    const size = fish.type === 'GUPPY' ? C.growthSize[fish.growth - 1] : 135;
    const parent = fish.arrival ? arrivalLayer : layer;
    if (el.parentElement !== parent) parent.append(el);
    position(el, fish, size, size);
    const visual = el.children[0];
    const base = fish.type === 'GUPPY' ? 'Guppy' : 'Piranha';
    const state = !fish.alive ? 'Dead' : fish.hungerState === 'STARVING' ? 'Starvation' : 'Default';
    sprite(visual, `${base}_${state}`, fish.alive ? Math.floor(game.time * 7 + fish.phase) % 9 : 0, fish.alive ? 3 : 1, fish.alive ? 3 : 1);
    const facing = `scaleX(${fish.direction === 1 ? -1 : 1})`;
    const entryTilt = fish.arrival?.phase === 'FALLING' ? -65
      : fish.arrival ? -65 * Math.max(0, 1 - fish.arrival.time / C.fishDropSettleDuration) : null;
    const tilt = entryTilt ?? Math.sin(game.time * 2 + fish.phase) * 3;
    visual.style.transform = fish.alive ? `${facing} rotate(${tilt}deg)` : facing;
    el.style.opacity = fish.alive ? '1' : String(Math.max(0, 1 - fish.deathTime / C.floorFadeTime));
    const label = el.children[1];
    label.hidden = !fish.alive || fish.hungerState === 'NORMAL';
    label.className = `fish-label ${fish.hungerState === 'STARVING' ? 'starving' : 'hungry'}`;
    text(label, fish.hungerState === 'STARVING' ? '먹이가 급해요!' : fish.type === 'PIRANHA' ? '아기 구피가 필요해요' : '배고파요');
  }
  function drawWorld() {
    for (const el of nodes.values()) el.dataset.seen = '0';
    for (const fish of game.fish) drawFish(fish);
    for (const food of game.food) {
      const el = entityNode(food.id, 'food-entity', () => { const node = document.createElement('div'); node.innerHTML = '<img src="Images/Prey.png" alt="">'; return node; });
      position(el, food, 27); el.style.opacity = String(1 - food.floorTime / C.floorFadeTime);
    }
    for (const coin of game.coins) {
      const filenames = { SILVER: 'SilverCoin', GOLD: 'GoldCoin', DIAMOND: 'Diamond', PEARL: 'Pearl' };
      const names = { SILVER: '은화', GOLD: '금화', DIAMOND: '보석', PEARL: '진주' };
      const el = entityNode(coin.id, `coin-entity ${coin.type === 'PEARL' ? 'pearl' : ''}`, () => {
        const node = document.createElement('button'); node.type = 'button';
        node.setAttribute('aria-label', `${names[coin.type]} $${coin.value} 획득`);
        node.innerHTML = `<img src="Images/Money_${filenames[coin.type]}.png" alt="">`;
        node.addEventListener('pointerdown', e => { e.stopPropagation(); game.collect(coin.id); events(); });
        node.addEventListener('click', e => { e.stopPropagation(); if (e.detail === 0) { game.collect(coin.id); events(); } });
        return node;
      });
      const visualSize = C.moneySizes[coin.type];
      const hitSize = Math.max(visualSize + 24, 32 / (tank.clientWidth / C.width));
      position(el, coin, hitSize);
      el.style.padding = `${(hitSize - visualSize) / 2}px`;
      el.disabled = coin.collected || !game.active;
      el.style.pointerEvents = coin.collected ? 'none' : 'auto';
      el.style.opacity = String(coin.collected ? 1 - coin.flyTime / .55 : 1 - coin.floorTime / C.floorFadeTime);
    }
    if (game.clam) {
      const clam = game.clam;
      const el = entityNode(clam.id, 'clam-entity sprite'); position(el, clam, 132);
      let frame = Math.floor(game.time * C.clamAnimationFPS) % 9;
      if (clam.phase === 'OPENING') frame = Math.min(3, Math.floor(clam.timer / C.clamAnimationDuration * 4));
      if (clam.phase === 'OPEN') frame = 4;
      if (clam.phase === 'CLOSING') frame = Math.min(8, 5 + Math.floor(clam.timer / C.clamAnimationDuration * 4));
      sprite(el, clam.phase === 'CLOSED' ? 'Clam_Default' : 'Clam_Open', frame);
    }
    if (game.marlin) {
      const el = entityNode(game.marlin.id, 'marlin-entity', () => { const node = document.createElement('div'); node.innerHTML = '<div class="fish-visual sprite"></div>'; return node; });
      position(el, game.marlin, 195, 175);
      sprite(el.firstChild, game.alien ? 'StripedMarlin_Anger' : 'StripedMarlin_Default', Math.floor(game.time * 8) % 9);
      el.firstChild.style.transform = `scaleX(${game.marlin.direction === 1 ? -1 : 1})`;
    }
    if (game.portal) {
      const el = entityNode(game.portal.id, 'portal-entity sprite'); position(el, game.portal, 205);
      sprite(el, 'Alien_Portal', Math.floor(game.portal.time / C.portalDuration * 9));
    }
    if (game.alien) {
      const alien = game.alien;
      const el = entityNode(alien.id, 'alien-entity', () => {
        const node = document.createElement('button'); node.type = 'button';
        node.innerHTML = '<span class="sprite"></span><span class="alien-health"><i></i><span></span></span>';
        node.addEventListener('pointerdown', e => { e.stopPropagation(); const p = coordinates(e); game.hitAlien(p.x, p.y); events(); });
        node.addEventListener('click', e => { e.stopPropagation(); if (e.detail === 0 && game.alien) { game.hitAlien(game.alien.x, game.alien.y); events(); } });
        return node;
      });
      position(el, alien, C.alienSize.width, C.alienSize.height);
      sprite(el.firstChild, 'Alien', Math.floor(game.time * 9) % 9);
      el.firstChild.style.transform = `scaleX(${alien.direction === 1 ? -1 : 1})`;
      el.children[1].firstChild.style.width = `${alien.hp / C.alienHP * 100}%`;
      text(el.children[1].lastChild, `HP ${alien.hp} / ${C.alienHP}`);
      el.setAttribute('aria-label', `에일리언 공격. 남은 체력 ${alien.hp}`);
    }
    for (const [id, el] of nodes) if (el.dataset.seen === '0') { el.remove(); nodes.delete(id); }
  }
  function defaultMessage() {
    if (!game.unlocks.guppy) return '화면을 눌러 구피에게 사료를 주세요! 사료 3개면 성장해요.';
    if (!game.unlocks.egg) return '반짝이는 동전을 클릭하세요. 먹이를 4개 더 먹으면 성체가 돼요!';
    if (game.egg === 0) return '구피를 늘려 코인을 모으고, 신비한 알 조각을 구매하세요.';
    return `알 구매 ${game.egg} / 3회! ${3 - game.egg}번 더 구매하면 새로운 바다가 열려요.`;
  }
  function updateUI() {
    const key = [game.stage, game.money, game.capacity, game.food.length, game.living.length, game.egg, game.speed, game.paused, game.state, game.scene, ...Object.values(game.unlocks)].join('|');
    if (key !== uiKey) {
      uiKey = key;
      text($('#money'), game.money.toLocaleString()); text($('#fish-count'), game.living.length);
      text($('#food-count'), `${game.food.length} / ${game.capacity}`);
      text($('#stage-label'), `1-${game.stage}`); text($('#stage-name'), C.stages[game.stage - 1].name);
      text($('#stage-subtitle'), C.stages[game.stage - 1].subtitle);
      text($('#egg-count'), `구매 ${game.egg} / 3`);
      $('#egg-goal').hidden = game.stage === 1 && !game.unlocks.egg;
      $('.egg-progress').setAttribute('aria-label', `알 구매 ${game.egg} / 3회`);
      document.querySelectorAll('.egg-progress i').forEach((el, i) => el.classList.toggle('filled', i < game.egg));
      document.querySelectorAll('.journey-step').forEach(el => {
        const stage = Number(el.dataset.stage);
        el.classList.toggle('current', stage === game.stage);
        el.classList.toggle('complete', stage < game.stage || game.scene === 'ENDING');
        if (stage === game.stage) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
      });
      buttons.forEach(button => {
        const item = button.dataset.buy, unlocked = game.unlocks[item];
        const maxed = item === 'capacity' && game.capacity >= C.maxCapacity;
        const poor = game.money < game.price(item);
        button.classList.toggle('locked', !unlocked);
        button.classList.toggle('poor', unlocked && poor);
        button.classList.toggle('affordable', !poor && unlocked && !maxed);
        button.classList.toggle('maxed', maxed);
        button.setAttribute('aria-disabled', String(!unlocked || maxed || !game.active || poor));
        button.disabled = !unlocked || maxed || !game.active;
        let detail = '';
        if (unlocked) detail = { guppy: '작은 친구 +1', capacity: maxed ? '최대 확장 완료' : `동시 사료 ${game.capacity} → ${game.capacity + 1}`, piranha: '아기 구피를 먹어요', egg: `알 ${game.eggFrame + 1} / 3` }[item];
        text(button.querySelector('.item-detail'), detail);
        text(button.querySelector('.price'), maxed ? 'MAX' : `$${game.price(item).toLocaleString()}`);
        button.title = unlocked ? `${button.querySelector('.shop-label').textContent} · ${detail}${poor ? ' · 코인이 부족해요' : ''}` : '';
      });
      sprite($('#shop-egg'), 'Egg', game.eggFrame, 3, 1);
      text($('#speed-label'), `${game.speed}×`); $('#speed-button').classList.toggle('fast', game.speed === C.developerSpeed);
      $('#speed-button').setAttribute('aria-pressed', String(game.speed !== 1));
      $('#speed-button').disabled = !ready;
      $('#pause-button').disabled = game.scene !== 'STAGE' || game.state !== 'PLAYING';
      icon($('#pause-button'), game.paused ? 'play' : 'pause');
      $('#pause-button').setAttribute('aria-label', game.paused ? '계속 플레이' : '일시정지');
      $('#pause-button').title = game.paused ? '계속 플레이 (P)' : '일시정지 (P)';
      $('#pause-overlay').hidden = !game.paused || $('#guide-dialog').open;
      $('#gameover-overlay').hidden = game.state !== 'GAME_OVER';
      if (game.state === 'GAME_OVER') $('#gameover-overlay [data-restart]').focus({ preventScroll: true });
    }
    const threat = game.warning || game.threat;
    $('#threat-banner').hidden = !threat || game.scene !== 'STAGE';
    tank.classList.toggle('danger', threat && game.scene === 'STAGE');
    if (threat) {
      text($('#threat-title'), game.alien ? '에일리언을 클릭해 공격하세요!' : game.portal ? '포탈이 열리고 있어요!' : `에일리언 접근 · ${Math.max(1, Math.ceil(C.alienInterval - game.alienTimer))}초`);
      text($('#threat-detail'), game.alien ? '클릭 1회 = 1 피해' : '포탈이 열리는 위치를 지켜보세요');
    }
    const warningText = game.threat ? '구피를 지켜 주세요! 에일리언을 빠르게 클릭하면 물리칠 수 있어요.' : game.warning ? '주의! 에일리언이 곧 등장해요. 포탈을 지켜보세요.' : '';
    const message = warningText || (notice.until > uiTime ? notice.text : defaultMessage());
    text($('#message span'), message);
    $('#message').className = `message ${warningText ? 'error' : notice.until > uiTime ? notice.tone : ''}`;
    renderScene();
  }
  function renderScene() {
    const visible = game.scene === 'HATCHERY' || game.scene === 'ENDING';
    $('#hatchery').hidden = !visible;
    if (!visible) { sceneKey = ''; return; }
    const hatched = game.hatchTime >= C.hatchDuration;
    const key = `${game.stage}/${hatched}/${game.scene}`;
    const frame = hatched ? 0 : game.hatchTime < C.eggCrackTime ? 2 : game.hatchTime < 1.6 ? 1 : 0;
    sprite($('#reward-egg'), 'Egg', frame, 3, 1);
    if (hatched && game.stage < 3) sprite($('#reward-pet'), game.stage === 1 ? 'Clam_Default' : 'StripedMarlin_Default', Math.floor(uiTime * (game.stage === 1 ? C.clamAnimationFPS : 7)) % 9);
    if (key === sceneKey) return;
    sceneKey = key;
    $('#reward-egg').hidden = hatched && game.stage < 3;
    $('#reward-pet').hidden = !hatched || game.stage === 3;
    $('#next-stage').hidden = !hatched || game.stage === 3;
    $('#ending-restart').hidden = game.scene !== 'ENDING';
    $('#ending-stats').hidden = game.scene !== 'ENDING';
    if (!hatched) {
      text($('#hatch-kicker'), `STAGE 1-${game.stage} COMPLETE`);
      text($('#hatch-title'), '알에서 무언가 깨어나고 있어요');
      text($('#hatch-description'), '새로운 친구를 만날 준비를 해 주세요.');
    } else if (game.stage < 3) {
      text($('#hatch-kicker'), 'SAY HELLO TO YOUR NEW FRIEND');
      text($('#hatch-title'), game.stage === 1 ? '반가워, 진주 조개!' : '어서 와, 용감한 청새치!');
      text($('#hatch-description'), game.stage === 1 ? '다음 바다부터 함께해요. 입을 열면 5초 안에 진주를 클릭하세요!' : '다음 바다부터 에일리언을 함께 물리쳐 줄 든든한 친구예요.');
      $('#next-stage').focus({ preventScroll: true });
    } else {
      text($('#hatch-kicker'), 'EVERY LITTLE LIFE, A BIG ADVENTURE');
      text($('#hatch-title'), '작은 바다를 지켜냈어요!');
      text($('#hatch-description'), '모든 알을 부화시켰습니다. 구피들과 함께한 당신의 바다가 완성됐어요.');
      sprite($('#reward-egg'), 'Egg', 2, 3, 1);
      $('#reward-egg').style.animation = 'none';
      $('#ending-stats').innerHTML = `<span>모은 코인 <b>$${game.stats.collected.toLocaleString()}</b></span><span>먹이 주기 <b>${game.stats.fed}회</b></span><span>지킨 바다 <b>3 / 3</b></span>`;
      $('#ending-restart').focus({ preventScroll: true });
    }
  }
  function coordinates(e) {
    const bounds = tank.getBoundingClientRect();
    return { x: (e.clientX - bounds.left) / bounds.width * C.width, y: (e.clientY - bounds.top) / bounds.height * C.height };
  }
  tank.addEventListener('pointerdown', e => {
    if (!ready || e.button !== 0 || e.target.closest('button,.shop,.wallet,.tank-bottom,.tank-counters,.egg-goal,.threat-banner,.overlay,.hatchery')) return;
    const point = coordinates(e); game.feed(point.x, point.y); events(); updateUI();
  });
  buttons.forEach(button => button.addEventListener('click', e => {
    e.stopPropagation();
    if (!game.active) return;
    const item = button.dataset.buy;
    if (!game.unlocks[item]) return;
    game.purchase(item);
    events(); updateUI();
  }));
  document.querySelectorAll('[data-restart]').forEach(button => button.addEventListener('click', () => {
    $('#reward-egg').style.animation = ''; game.restart(); events(); updateUI(); drawWorld(); $('#pause-button').focus({ preventScroll: true });
  }));
  $('#next-stage').addEventListener('click', () => { game.continueStage(); events(); updateUI(); drawWorld(); $('#pause-button').focus({ preventScroll: true }); });
  const pause = () => { game.togglePause(); accumulator = 0; events(); updateUI(); };
  $('#pause-button').addEventListener('click', pause);
  $('#resume-button').addEventListener('click', pause);
  new Aqua.SpeedHoldInput({
    document, window, button: $('#speed-button'), enabled: () => ready,
    onChange: held => {
      game.setSpeedHeld(held); accumulator = 0; events(); updateUI();
      if (held) sound('ui');
    }
  });
  function updateSoundButton() {
    icon($('#sound-button'), audio.enabled ? 'sound' : 'muted');
    $('#sound-button').setAttribute('aria-pressed', String(audio.enabled));
    $('#sound-button').setAttribute('aria-label', audio.enabled ? '게임 소리 끄기' : '게임 소리 켜기');
    $('#sound-button').title = audio.enabled ? '배경음·효과음 끄기' : '배경음·효과음 켜기';
  }
  $('#sound-button').addEventListener('click', () => {
    audio.setEnabled(!audio.enabled); updateSoundButton();
    if (audio.enabled) sound('ui');
  });
  // Browsers allow sound after the first click/touch/key; no start menu is needed.
  document.addEventListener('pointerdown', () => audio.unlock(), true);
  document.addEventListener('keydown', () => audio.unlock(), true);
  document.addEventListener('click', e => {
    const button = e.target.closest('button');
    if (button && !button.disabled && !button.matches('.coin-entity,.alien-entity,#sound-button,#speed-button')) sound('ui');
  }, true);
  updateSoundButton();
  $('#fullscreen-button').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if ($('.game-section').requestFullscreen) await $('.game-section').requestFullscreen();
      else announce('이 브라우저에서는 전체 화면을 지원하지 않아요.', '', 4);
    } catch { announce('전체 화면을 열 수 없어요. 브라우저 창을 넓혀 주세요.', '', 4); }
  });
  function openGuide() {
    if ($('#guide-dialog').open) return;
    lastFocus = document.activeElement;
    guidePaused = game.active;
    if (guidePaused) game.togglePause();
    $('#guide-dialog').showModal();
    manualHelp = true; uiKey = ''; events(); updateUI();
  }
  $('#help-button').addEventListener('click', openGuide);
  $('#close-guide').addEventListener('click', () => $('#guide-dialog').close());
  $('#guide-play').addEventListener('click', () => $('#guide-dialog').close());
  $('#guide-dialog').addEventListener('close', () => {
    if (guidePaused && game.paused) game.togglePause();
    guidePaused = false; manualHelp = false; uiKey = ''; accumulator = 0;
    events(); updateUI(); if (lastFocus) lastFocus.focus({ preventScroll: true });
  });
  document.addEventListener('keydown', e => {
    if (!ready || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    if (manualHelp) return;
    if (e.code === 'KeyP' || e.code === 'Escape' && !document.fullscreenElement) { e.preventDefault(); pause(); sound('ui'); }
  });
  document.addEventListener('visibilitychange', () => {
    lastFrame = 0; accumulator = 0;
    if (document.hidden && game.active) { game.togglePause(); events(); updateUI(); }
    syncAudio();
    if (document.hidden) audio.stopEffects();
  });
  const resize = () => tank.style.setProperty('--world-scale', tank.clientWidth / C.width);
  new ResizeObserver(resize).observe(tank); resize();
  for (let i = 0; i < 22; i++) {
    const bubble = document.createElement('span'); bubble.className = 'bubble';
    const size = 3 + Math.random() * 11;
    bubble.style.cssText = `left:${Math.random() * 1280}px;width:${size}px;height:${size}px;animation-duration:${12 + Math.random() * 20}s;animation-delay:${-Math.random() * 30}s;`;
    $('#bubbles').append(bubble);
  }
  function frame(now) {
    const dt = lastFrame ? Math.min(.1, (now - lastFrame) / 1000) : 0;
    lastFrame = now;
    if (ready && !document.hidden) {
      uiTime += dt;
      if (game.active) {
        accumulator += dt * game.speed;
        const oldScene = game.scene, oldSpeed = game.speed;
        while (accumulator >= .025 && game.active) { game.update(.025); accumulator -= .025; }
        if (oldScene !== game.scene || oldSpeed !== game.speed) accumulator = 0;
      } else {
        accumulator = 0;
        if (!manualHelp) game.update(dt * game.speed);
      }
      events(); drawWorld(); updateUI();
      for (let i = transient.length - 1; i >= 0; i--) {
        const effect = transient[i]; effect.remaining -= dt;
        if (effect.asset) sprite(effect.el, effect.asset, Math.floor((1 - effect.remaining / effect.duration) * 9));
        if (effect.remaining <= 0) { effect.el.remove(); transient.splice(i, 1); }
      }
    }
    requestAnimationFrame(frame);
  }
  let loaded = 0;
  const images = C.assets.map(name => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { loaded++; text($('#load-progress'), `${loaded} / ${C.assets.length}`); resolve(img); };
    img.onerror = () => reject(new Error(`Images/${name}.png`));
    img.src = `Images/${name}.png`;
  }));
  Promise.allSettled(images).then(results => {
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length) {
      $('.loading-overlay p').textContent = `이미지를 불러오지 못했어요. Images 폴더를 확인해 주세요: ${failures.map(f => f.reason.message).join(', ')}`;
      return;
    }
    ready = true; $('#loading').hidden = true;
    // Initial hunger begins only when every asset is available.
    game.restart(); events(); drawWorld(); updateUI();
    if (document.hidden) { game.togglePause(); events(); updateUI(); }
  });
  requestAnimationFrame(frame);
})(globalThis.Aqua);
