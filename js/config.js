/* All balance values live here. Classic scripts also work from file://. */
(function (root) {
  'use strict';
  const Aqua = root.Aqua = root.Aqua || {};
  Aqua.CONFIG = Object.freeze({
    width: 1280, height: 720,
    bounds: { left: 65, right: 1215, top: 185, bottom: 598 },
    floor: 624, initialMoney: 100, initialFish: 2,
    feedPrice: 5, guppyPrice: 100, capacityPrice: 100, piranhaPrice: 1000,
    initialCapacity: 3, maxCapacity: 9,
    growthMeals: [3, 4], growthSize: [76, 106, 140],
    hungerMin: 10, hungerMax: 15, hungryDuration: 5, starvingDuration: 7,
    mealCooldown: 1.1, coinInterval: 10, diamondInterval: 15,
    foodFallSpeed: 25, moneyFallSpeed: 22, floorFadeTime: 2,
    swimSpeedMin: 24, swimSpeedMax: 52, chaseSpeed: 165,
    alienInterval: 60, warningDuration: 5, portalDuration: 1.2,
    alienHP: 30, alienSpeed: 120, alienContact: 35,
    alienKnockback: 20, alienStun: 0.13,
    clamInterval: 20, clamOpenDuration: 5, clamAnimationDuration: 0.5,
    marlinSpeed: 215, marlinAttackInterval: 1,
    hatchDuration: 2.4,
    values: { SILVER: 15, GOLD: 25, DIAMOND: 200, PEARL: 350 },
    stages: [
      { name: '첫 번째 물결', subtitle: '작은 구피와 시작하는 바다', eggPrice: 750, initialMoney: 100 },
      { name: '진주빛 친구', subtitle: '조개와 함께, 더 깊은 바다로', eggPrice: 1500, initialMoney: 100 },
      { name: '푸른 바다의 수호자', subtitle: '친구들과 마지막 알을 지켜요', eggPrice: 2500, initialMoney: 100 }
    ],
    assets: [
      'Background_Stage', 'Background_Hatchery', 'UI_ItemSlot', 'UI_MoneySlot',
      'Guppy_Default', 'Guppy_Starvation', 'Guppy_Dead',
      'Piranha_Default', 'Piranha_Starvation', 'Piranha_Dead',
      'Prey', 'Egg', 'Money_SilverCoin', 'Money_GoldCoin', 'Money_Diamond', 'Money_Pearl',
      'Alien', 'Alien_Portal', 'Effect_Hit', 'Effect_Carnivore',
      'Clam_Default', 'Clam_Open', 'StripedMarlin_Default', 'StripedMarlin_Anger'
    ]
  });
})(globalThis);
