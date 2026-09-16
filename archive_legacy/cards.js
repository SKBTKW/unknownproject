// src/cards.js - Card Databases and Draw Weight Calculations
import { TERRAINS, ATTRIBUTES, BONUSES, ROLES } from './state.js?v=260722_3';

export const CARD_CATEGORIES = {
  LAND: 'land',           // 🧭 Land Discovery
  ATTRIBUTE: 'attribute', // 🍎 Land Attribute/Bonus
  CRISIS: 'crisis',       // ☠️ Crisis/Disaster
  SOCIETY: 'society',     // 👥 Human/Society/Morale
  MYSTIC: 'mystic',       // ✨ Mystical/Revelation
  MILITARY: 'military'    // ⚔️ Military/Tactics
};

// Database of card designs
export const CARD_DATABASE = {
  [CARD_CATEGORIES.LAND]: [
    { id: 'land-plains-jungle', name: '森林', type: CARD_CATEGORIES.LAND, terrain: TERRAINS.PLAINS, attribute: ATTRIBUTES.JUNGLE, rarity: 'r', weight: 4, desc: '森林を獲得。食料🌾+5、資材🧱+5、防衛🛡️+20、神秘✨+5。' },
    { id: 'land-plains-forest', name: '森', type: CARD_CATEGORIES.LAND, terrain: TERRAINS.PLAINS, attribute: ATTRIBUTES.FOREST, rarity: 'uc', weight: 12, desc: '森を獲得。食料🌾+10、資材🧱+10、防衛🛡️+10。' },
    { id: 'land-plains-standard', name: '平地', type: CARD_CATEGORIES.LAND, terrain: TERRAINS.PLAINS, attribute: null, rarity: 'c', weight: 30, desc: '平地を獲得。食料🌾+20。' },
    { id: 'land-plains-desert', name: '砂漠', type: CARD_CATEGORIES.LAND, terrain: TERRAINS.PLAINS, attribute: ATTRIBUTES.DESERT, rarity: 'r', weight: 3, desc: '砂漠を獲得。神秘✨+10。' },
    { id: 'land-hills-jungle', name: '森林丘陵', type: CARD_CATEGORIES.LAND, terrain: TERRAINS.HILLS, attribute: ATTRIBUTES.JUNGLE, rarity: 'r', weight: 4, desc: '森林丘陵を獲得。食料🌾-5、資材🧱+15、防衛🛡️+30、神秘✨+5。' },
    { id: 'land-hills-forest', name: '森丘陵', type: CARD_CATEGORIES.LAND, terrain: TERRAINS.HILLS, attribute: ATTRIBUTES.FOREST, rarity: 'uc', weight: 7, desc: '森丘陵を獲得。資材🧱+20、防衛🛡️+20。' },
    { id: 'land-hills-standard', name: '丘陵', type: CARD_CATEGORIES.LAND, terrain: TERRAINS.HILLS, attribute: null, rarity: 'c', weight: 10, desc: '丘陵を獲得。食料🌾+10、資材🧱+10、防衛🛡️+10。' },
    { id: 'land-hills-desert', name: '砂丘', type: CARD_CATEGORIES.LAND, terrain: TERRAINS.HILLS, attribute: ATTRIBUTES.DESERT, rarity: 'r', weight: 2, desc: '砂丘を獲得。食料🌾-10、資材🧱+10、防衛🛡️+10、神秘✨+10。' },
    { id: 'land-mountains-jungle', name: '森林山岳', type: CARD_CATEGORIES.LAND, terrain: TERRAINS.MOUNTAINS, attribute: ATTRIBUTES.JUNGLE, rarity: 'r', weight: 1, desc: '森林山岳を獲得。食料🌾-15、資材🧱+25、防衛🛡️+40、神秘✨+5。' },
    { id: 'land-mountains-forest', name: '森山岳', type: CARD_CATEGORIES.LAND, terrain: TERRAINS.MOUNTAINS, attribute: ATTRIBUTES.FOREST, rarity: 'uc', weight: 3, desc: '森山岳を獲得。食料🌾-10、資材🧱+30、防衛🛡️+30。' },
    { id: 'land-mountains-standard', name: '山岳', type: CARD_CATEGORIES.LAND, terrain: TERRAINS.MOUNTAINS, attribute: null, rarity: 'uc', weight: 6, desc: '山岳を獲得。資材🧱+20、防衛🛡️+20。' },
    { id: 'land-mountains-desert', name: '砂漠山岳', type: CARD_CATEGORIES.LAND, terrain: TERRAINS.MOUNTAINS, attribute: ATTRIBUTES.DESERT, rarity: 'r', weight: 1, desc: '砂漠山岳を獲得。食料🌾-20、資材🧱+20、防衛🛡️+20、神秘✨+10。' },
    { id: 'land-lake', name: '清らかな湖', type: CARD_CATEGORIES.LAND, terrain: TERRAINS.LAKE, attribute: null, rarity: 'r', weight: 4, desc: '湖を獲得（開発不可）。食料🌾+10、防衛🛡️+10。周辺強化（水源）。' }
  ],
  [CARD_CATEGORIES.ATTRIBUTE]: [
    { id: 'bonus-fruit', name: '野生果実の発見', type: CARD_CATEGORIES.ATTRIBUTE, bonus: BONUSES.FRUIT, rarity: 'c', desc: '土地を調査し、野生の「果実」を発見します。食料🌾+15。' },
    { id: 'bonus-grain', name: '野生穀物の発見', type: CARD_CATEGORIES.ATTRIBUTE, bonus: BONUSES.GRAIN, rarity: 'c', desc: '平地を調査し、野生の「穀物」を発見します。食料🌾+15。' },
    { id: 'bonus-livestock', name: '野生ヤギの発見', type: CARD_CATEGORIES.ATTRIBUTE, bonus: BONUSES.LIVESTOCK, rarity: 'c', desc: '平地を調査し、飼育可能な「野生ヤギ（家畜）」を発見します。食料🌾+15。' },
    { id: 'bonus-vein', name: '有望な鉱脈の発見', type: CARD_CATEGORIES.ATTRIBUTE, bonus: BONUSES.VEIN, rarity: 'uc', desc: '丘陵/山岳を調査し、隠れた「鉱脈」を発見します。資材🧱+15。' },
    { id: 'bonus-timber', name: '巨木群の発見', type: CARD_CATEGORIES.ATTRIBUTE, bonus: BONUSES.TIMBER, rarity: 'uc', desc: '森/森林を調査し、建築に適した「高級木材」を発見します。資材🧱+20。' },
    { id: 'bonus-precious', name: '貴金属床の発見', type: CARD_CATEGORIES.ATTRIBUTE, bonus: BONUSES.PRECIOUS, rarity: 'r', desc: '丘陵/山岳を調査し、希少な「貴金属」を発見します。資材🧱+10、神秘✨+5。' },
    { id: 'bonus-marine', name: '豊か漁場の発見', type: CARD_CATEGORIES.ATTRIBUTE, bonus: BONUSES.MARINE, rarity: 'uc', desc: '川/湖を調査し、豊富な「水産資源」を発見します。食料🌾+15。' }
  ],
  [CARD_CATEGORIES.CRISIS]: [],
  [CARD_CATEGORIES.SOCIETY]: [
    { id: 'soc-migration', name: '民の移住', type: CARD_CATEGORIES.SOCIETY, rarity: 'uc', desc: '平地3枚以上で発生可。最後の平地に人々が集まり希望の灯が強まる。(🌾+30, 🔥+3)' },
    { id: 'soc-trade', name: '交易の風', type: CARD_CATEGORIES.SOCIETY, rarity: 'uc', desc: '神秘5以上or果実/穀物で発生可。砂漠の交易ルートより物資と情報を獲得。(🌾+35か🧱+30、✨+5)' },
    { id: 'soc-hero', name: '英雄の帰還', type: CARD_CATEGORIES.SOCIETY, rarity: 'r', desc: '直近の試練防衛成功で発生可。試練を生き延びた若者が希望となる。(🔥+5, 🛡️+50, 無料軍事カード獲得)' },
    { id: 'soc-prophet', name: '預言者の託宣', type: CARD_CATEGORIES.SOCIETY, rarity: 'uc', desc: '神秘15以上で発生可。民が集まり預言者が大地の声を聞く。(✨+10, 無料神秘カード獲得)' },
    { id: 'soc-clearing', name: '開拓者の開墾祭', type: CARD_CATEGORIES.SOCIETY, rarity: 'uc', desc: '平地/森4枚以上で発生可。民が一丸となって土地を豊かにする。(🌾+25, ランダム土地開発度+1)' },
    { id: 'soc-ghost', name: '亡者の記憶', type: CARD_CATEGORIES.SOCIETY, rarity: 'r', desc: '砂漠ありで発生。亜人の遺跡から禁断の知識が漏れ出す。(✨+20, 🔥-2)' },
    { id: 'soc-bonds', name: '家族の絆', type: CARD_CATEGORIES.SOCIETY, rarity: 'c', desc: '残り火12以下で発生可。苦境の中で家族や共同体が結束を強める。(🔥+6, 🌾+15)' },
    { id: 'soc-artisans', name: '職人の目覚め', type: CARD_CATEGORIES.SOCIETY, rarity: 'uc', desc: '資材30以上で発生可。民の職人が失われた技術を蘇らせる。(🧱+30, 次の施設建設コスト-20)' },
    { id: 'soc-feast', name: '最後の宴', type: CARD_CATEGORIES.SOCIETY, rarity: 'r', desc: 'T40以降且つ食料100以上で発生。最後の希望を胸に宴を開く。(🌾-50, 🔥+10, 🛡️+100)' },
    { id: 'soc-refugees', name: '流民の受け入れ', type: CARD_CATEGORIES.SOCIETY, rarity: 'uc', unique: true, desc: '流民を受け入れる。食料🌾-25、残り火🔥+2、資材🧱+20。' },
    { id: 'soc-communal-fusion', name: '共同体の融和', type: CARD_CATEGORIES.SOCIETY, rarity: 'uc', unique: true, desc: 'マージを活性化。このターンの土地開発（マージ）コストが0🔥になる。食料🌾+15。' },
    { id: 'soc-festival', name: '残り火の祝祭', type: CARD_CATEGORIES.SOCIETY, rarity: 'r', unique: true, desc: '祝祭を開催。食料🌾-30、次の試練防衛力🛡️+20。' },
    { id: 'soc-artisan-eye', name: '職人の目利き', type: CARD_CATEGORIES.SOCIETY, rarity: 'uc', unique: true, desc: '手札の素材を価値ある物資へ。資材🧱+30。' },
    { id: 'soc-restoration', name: '宮廷の復興', type: CARD_CATEGORIES.SOCIETY, rarity: 'r', unique: true, desc: '本拠地周辺★1以上が3つ以上で発生可。本拠地を修築する。資材🧱-40、本拠地全資源産出恒久+5。' }
  ],
  [CARD_CATEGORIES.MYSTIC]: [
    { id: 'mys-revelation', name: '天の神託', type: CARD_CATEGORIES.MYSTIC, rarity: 'uc', desc: '祈りにより天啓を受ける。神秘✨+25。' },
    { id: 'mys-shrine', name: '古の祠の再建', type: CARD_CATEGORIES.MYSTIC, rarity: 'uc', desc: '古い信仰を修復する。資材🧱-20、神秘✨+40。' },
    { id: 'mys-blessing', name: '精霊の加護', type: CARD_CATEGORIES.MYSTIC, rarity: 'r', desc: '土地の精霊の祝福。神秘✨+30、およびランダムな土地の生産力を3ターン+30%。' },
    { id: 'mys-fire-ritual', name: '火精の儀式', type: CARD_CATEGORIES.MYSTIC, rarity: 'uc', unique: true, desc: '火の精霊の祈祷。神秘✨-20、残り火🔥+5。' },
    { id: 'mys-soothing', name: '大地の怒りの鎮め', type: CARD_CATEGORIES.MYSTIC, rarity: 'r', unique: true, desc: '盤面に荒廃した土地があるとき発生可。地脈を癒す。神秘✨-15、全土地の荒廃を解除。' },
    { id: 'mys-mana-well', name: 'マナの湧出', type: CARD_CATEGORIES.MYSTIC, rarity: 'uc', unique: true, desc: '盤面に「湖」か「川」があるとき発生可。水源から霊気を得る。神秘✨+30。' },
    { id: 'mys-revelation-extra', name: '天啓の予知', type: CARD_CATEGORIES.MYSTIC, rarity: 'uc', unique: true, desc: '未来を垣間見る。神秘✨-10。次のターン、ドラフト提示枠が5枚に増加。' },
    { id: 'mys-soul-smelt', name: '魂の還元', type: CARD_CATEGORIES.MYSTIC, rarity: 'uc', unique: true, desc: '還元の効率を上げる。神秘✨-15。3ターンの間、カード還元時に得られる残り火が+2🔥になる。' }
  ],
  [CARD_CATEGORIES.MILITARY]: [
    { id: 'mil-scouts', name: '斥候の派遣', type: CARD_CATEGORIES.MILITARY, rarity: 'c', desc: '外の世界を偵察する。防衛力🛡️+20、および次の試練の敵戦力を少し弱体化。' },
    { id: 'mil-recruits', name: '義勇兵の招集', type: CARD_CATEGORIES.MILITARY, rarity: 'c', desc: '若者を訓練する。食料🌾-15、防衛力🛡️+40。' },
    { id: 'mil-fortify', name: '柵の急造', type: CARD_CATEGORIES.MILITARY, rarity: 'c', desc: '防塁を補強する。資材🧱-15、防衛力🛡️+45。' },
    { id: 'mil-tactician', name: '百戦錬磨の戦術家', type: CARD_CATEGORIES.MILITARY, rarity: 'r', desc: '優秀な軍師を雇う。資材🧱-25、食料🌾-25。試練期間中、防衛力🛡️+100。' },
    { id: 'mil-barricade-reinforce', name: '前線防壁の強化', type: CARD_CATEGORIES.MILITARY, rarity: 'uc', unique: true, desc: '監視塔または砦があるとき発生可。防塁を強固にする。防衛力🛡️+35。' },
    { id: 'mil-hasty-outpost', name: '前線砦の突貫工事', type: CARD_CATEGORIES.MILITARY, rarity: 'uc', unique: true, desc: '試練まで5ターン以内で発生可。防衛陣地を急造する。資材🧱-30、防衛力🛡️+60。' },
    { id: 'mil-scorched-prep', name: '焦土の備え', type: CARD_CATEGORIES.MILITARY, rarity: 'r', unique: true, desc: '防衛を固め、焦土作戦の荒廃期間を恒久的に1ターンへ短縮。防衛力🛡️+40。' },
    { id: 'mil-river-trap', name: '渡河の罠', type: CARD_CATEGORIES.MILITARY, rarity: 'uc', unique: true, desc: '盤面に川か湖があるとき発生可。即座に防衛力🛡️+50。' },
    { id: 'mil-conscription', name: '緊急徴兵', type: CARD_CATEGORIES.MILITARY, rarity: 'c', unique: true, desc: '残り火を削り兵を募る。残り火🔥-3、防衛力🛡️+60。' }
  ]
};

// River Discovery special card
export const RIVER_DISCOVERY_CARD = {
  id: 'event-river-discovery',
  name: '川の発見',
  type: CARD_CATEGORIES.LAND,
  rarity: 'r',
  desc: '【特別イベント】川特性（開発不可、🌾+10、🛡️+20）を持つ土地を1枚発見。下流探索への投資が可能になる。'
};

export const RIVER_DISCOVERY_UC_CARD = {
  id: 'event-river-discovery-uc',
  name: '豊かな川の発見',
  type: CARD_CATEGORIES.LAND,
  rarity: 'uc',
  desc: '【特別イベント】川（開発不可）とランダムな資源を持つ土地を獲得。'
};

// Calculate dynamic category weights based on game state
export function calculateCategoryWeights(state) {
  const weights = {
    [CARD_CATEGORIES.LAND]: 30,
    [CARD_CATEGORIES.ATTRIBUTE]: 25,
    [CARD_CATEGORIES.CRISIS]: 0, // Disaster category is disabled / removed from card offers
    [CARD_CATEGORIES.SOCIETY]: 20,
    [CARD_CATEGORIES.MYSTIC]: 12,
    [CARD_CATEGORIES.MILITARY]: 15
  };

  const outerLandsCount = state.board.slice(1).filter(l => l && l.terrain).length;
  const hasLandInReserve = state.reserve.some(c => c && c.type === CARD_CATEGORIES.LAND);

  // Calculate effective lands count considering development levels (★0 is 1.0, ★1 is 1.5, etc.)
  let effectiveLandsCount = 0;
  state.board.slice(1).forEach(l => {
    if (l && l.terrain) {
      effectiveLandsCount += 1 + l.devLevel * 0.5;
    }
  });

  if (outerLandsCount === 0 && !hasLandInReserve) {
    weights[CARD_CATEGORIES.LAND] = 100;
    weights[CARD_CATEGORIES.ATTRIBUTE] = 0;
    weights[CARD_CATEGORIES.SOCIETY] = 0;
    weights[CARD_CATEGORIES.MYSTIC] = 0;
    weights[CARD_CATEGORIES.MILITARY] = 0;
    return weights;
  }

  if (outerLandsCount === 0) {
    weights[CARD_CATEGORIES.ATTRIBUTE] = 0;
  }

  // Boost land discovery weight if outer lands are low and no land is in hand
  if (outerLandsCount <= 2 && !hasLandInReserve) {
    weights[CARD_CATEGORIES.LAND] += 40;
  }

  // Adjust weights by turn number
  const turnsToTrial = state.upcomingTrial ? (state.upcomingTrial.turn - state.currentTurn) : 99;
  
  if (state.currentTurn <= 8) {
    weights[CARD_CATEGORIES.LAND] += 15;
    weights[CARD_CATEGORIES.ATTRIBUTE] += 10;
    weights[CARD_CATEGORIES.MILITARY] -= 5;
  } else if (state.currentTurn >= 40) {
    weights[CARD_CATEGORIES.LAND] -= 15;
    weights[CARD_CATEGORIES.MILITARY] += 10;
    weights[CARD_CATEGORIES.MYSTIC] += 5;
  }

  // Adjust weight near trial
  if (turnsToTrial >= 0 && turnsToTrial <= 4) {
    const militaryBoost = (5 - turnsToTrial) * 15; // +15 to +75 weight
    weights[CARD_CATEGORIES.MILITARY] += militaryBoost;
    weights[CARD_CATEGORIES.LAND] -= 10;
    weights[CARD_CATEGORIES.ATTRIBUTE] -= 10;
  }

  // Adjust weight by Role selection
  if (state.role === ROLES.GENERAL) {
    weights[CARD_CATEGORIES.MILITARY] += 15;
  } else if (state.role === ROLES.PROPHET) {
    weights[CARD_CATEGORIES.MYSTIC] += 20;
  } else if (state.role === ROLES.PIONEER) {
    weights[CARD_CATEGORIES.LAND] += 15;
  }

  // Apply tribal_accord polity bonus (only when effectiveLandsCount is low)
  if (state.activePolity === 'tribal_accord' && effectiveLandsCount <= 4) {
    weights[CARD_CATEGORIES.LAND] = Math.round(weights[CARD_CATEGORIES.LAND] * 1.15);
  }

  const hasDesert = state.board.some(l => l && l.attribute === ATTRIBUTES.DESERT);
  if (hasDesert) {
    weights[CARD_CATEGORIES.MYSTIC] += 5;
  }

  let landMultiplier = 1.0;
  if (effectiveLandsCount === 0) {
    landMultiplier = 1.6;
  } else if (effectiveLandsCount <= 3) {
    landMultiplier = 1.25;
  } else if (effectiveLandsCount <= 6) {
    landMultiplier = 0.75;
  } else {
    landMultiplier = 0.15;
  }
  
  weights[CARD_CATEGORIES.LAND] = Math.max(1, Math.round(weights[CARD_CATEGORIES.LAND] * landMultiplier));

  return weights;
}

// Helper for attribute eligibility
export function canAttachCardToBoard(card, state) {
  return state.board.some((slot, idx) => {
    if (!slot || !slot.terrain || slot.seaOccupied) return false;
    if (idx === 0) return false;
    if (slot.terrain === TERRAINS.SEA) return false;
    if (slot.terrain === TERRAINS.LAKE && (!card.bonus || card.bonus !== BONUSES.MARINE)) return false;
    if (slot.attribute === ATTRIBUTES.RIVER && card.attribute) return false;

    if (card.attribute) {
      if (slot.attribute) return false;
      const newCapacity = state.getSlotCapacityWithAttribute(slot, card.attribute);
      const occupied = state.getSlotOccupiedCount(slot);
      if (newCapacity < occupied) return false;
    }

    if (card.bonus) {
      if (slot.bonus) return false;
      if (card.bonus === BONUSES.FRUIT && slot.terrain !== TERRAINS.PLAINS && slot.attribute !== ATTRIBUTES.FOREST && slot.attribute !== ATTRIBUTES.JUNGLE) return false;
      if (card.bonus === BONUSES.GRAIN && slot.terrain !== TERRAINS.PLAINS) return false;
      if (card.bonus === BONUSES.LIVESTOCK && slot.terrain !== TERRAINS.PLAINS) return false;
      if (card.bonus === BONUSES.VEIN && slot.terrain !== TERRAINS.HILLS && slot.terrain !== TERRAINS.MOUNTAINS) return false;
      if (card.bonus === BONUSES.PRECIOUS && slot.terrain !== TERRAINS.HILLS && slot.terrain !== TERRAINS.MOUNTAINS) return false;
      if (card.bonus === BONUSES.TIMBER && slot.attribute !== ATTRIBUTES.FOREST && slot.attribute !== ATTRIBUTES.JUNGLE) return false;
      if (card.bonus === BONUSES.MARINE && slot.attribute !== ATTRIBUTES.RIVER && slot.terrain !== TERRAINS.LAKE) return false;
      if (state.getSlotEmptyCount(slot) < 1) return false;
    }
    
    return true;
  });
}

// Check if card eligibility conditions are met
export function isCardEligible(card, state) {
  if (card.unique && state.playedEvents && state.playedEvents.includes(card.id)) {
    return false;
  }

  if (card.id === 'event-river-discovery') {
    const hasRiver = state.board.some(l => l && l.attribute === ATTRIBUTES.RIVER);
    return !hasRiver && state.riverExpedition.step === 0;
  }
  if (card.id === 'event-river-discovery-uc') {
    const hasRiver = state.board.some(l => l && l.attribute === ATTRIBUTES.RIVER);
    return hasRiver;
  }

  if (card.type === CARD_CATEGORIES.LAND) {
    return true;
  }
  if (card.type === CARD_CATEGORIES.ATTRIBUTE) {
    return canAttachCardToBoard(card, state);
  }
  if (card.type === CARD_CATEGORIES.SOCIETY) {
    if (card.id === 'soc-migration') {
      const plainsCount = state.board.filter(l => l && l.terrain === TERRAINS.PLAINS).length;
      return plainsCount >= 3;
    }
    if (card.id === 'soc-trade') {
      const hasFruitOrGrain = state.board.some(l => l && (l.bonus === BONUSES.FRUIT || l.bonus === BONUSES.GRAIN));
      return state.mystic >= 5 || hasFruitOrGrain;
    }
    if (card.id === 'soc-hero') {
      return state.lastTrialVictory === true && state.turnsSinceLastTrial <= 5;
    }
    if (card.id === 'soc-prophet') {
      return state.mystic >= 15;
    }
    if (card.id === 'soc-clearing') {
      const count = state.board.filter(l => l && (l.terrain === TERRAINS.PLAINS || l.attribute === ATTRIBUTES.FOREST)).length;
      return count >= 4;
    }
    if (card.id === 'soc-ghost') {
      const hasDesert = state.board.some(l => l && l.attribute === ATTRIBUTES.DESERT);
      return hasDesert;
    }
    if (card.id === 'soc-bonds') {
      return state.fire <= 12;
    }
    if (card.id === 'soc-artisans') {
      return state.materials >= 30;
    }
    if (card.id === 'soc-feast') {
      return state.currentTurn >= 40 && state.food >= 100;
    }
    if (card.id === 'soc-refugees') {
      const hasEmptySlot = state.board.slice(1).some(l => !l.terrain);
      return hasEmptySlot && state.food >= 50;
    }
    if (card.id === 'soc-communal-fusion') {
      const level1PlusCount = state.board.slice(1).filter(l => l && l.terrain && l.devLevel >= 1).length;
      return level1PlusCount >= 2;
    }
    if (card.id === 'soc-festival') {
      return state.fire >= state.maxFire * 0.7 && state.food >= 40;
    }
    if (card.id === 'soc-artisan-eye') {
      return true;
    }
    if (card.id === 'soc-restoration') {
      const level1PlusCount = state.board.slice(1).filter(l => l && l.terrain && l.devLevel >= 1).length;
      return level1PlusCount >= 3;
    }
    return true;
  }
  if (card.type === CARD_CATEGORIES.MYSTIC) {
    if (card.id === 'mys-shrine') return state.materials >= 20;
    if (card.id === 'mys-blessing') return state.board.some((l, idx) => l && l.terrain && idx !== 0 && !l.seaOccupied);
    if (card.id === 'mys-fire-ritual') {
      return state.mystic >= 20;
    }
    if (card.id === 'mys-soothing') {
      return state.board.some(l => l && (l.damagedTurns > 0 || l.disasterTurns > 0));
    }
    if (card.id === 'mys-mana-well') {
      return state.board.some(l => l && (l.terrain === TERRAINS.LAKE || l.attribute === ATTRIBUTES.RIVER));
    }
    if (card.id === 'mys-revelation-extra') {
      return state.mystic >= 10;
    }
    if (card.id === 'mys-soul-smelt') {
      return state.mystic >= 15;
    }
    return true;
  }
  if (card.type === CARD_CATEGORIES.MILITARY) {
    if (card.id === 'mil-recruits') return state.food >= 15;
    if (card.id === 'mil-fortify') return state.materials >= 15;
    if (card.id === 'mil-tactician') return state.food >= 25 && state.materials >= 25;
    if (card.id === 'mil-barricade-reinforce') {
      return state.board.some(l => l && (l.facility === 'watchtower' || l.facility === 'barracks'));
    }
    if (card.id === 'mil-hasty-outpost') {
      const turnsToTrial = state.upcomingTrial ? (state.upcomingTrial.turn - state.currentTurn) : 99;
      return turnsToTrial >= 0 && turnsToTrial <= 5;
    }
    if (card.id === 'mil-scorched-prep') {
      return true;
    }
    if (card.id === 'mil-river-trap') {
      return state.board.some(l => l && (l.terrain === TERRAINS.LAKE || l.attribute === ATTRIBUTES.RIVER));
    }
    if (card.id === 'mil-conscription') {
      return (state.fire - state.tempFireSpent) > 3;
    }
    return true;
  }
  return true;
}

// Draw 3 cards based on weights and rarity
export function drawThreeOfferings(state) {
  const drawCount = (state && state.extraDrawsNextTurn) ? 5 : 3;
  if (state && state.extraDrawsNextTurn) {
    state.extraDrawsNextTurn = false;
  }

  const eligibleCardsByCategory = {};
  for (const category of Object.values(CARD_CATEGORIES)) {
    const pool = CARD_DATABASE[category] || [];
    eligibleCardsByCategory[category] = pool.filter(card => isCardEligible(card, state));
  }

  const weights = calculateCategoryWeights(state);
  
  for (const category of Object.values(CARD_CATEGORIES)) {
    if (!eligibleCardsByCategory[category] || eligibleCardsByCategory[category].length === 0) {
      weights[category] = 0;
    }
  }

  const drawnCards = [];

  for (let i = 0; i < drawCount; i++) {
    for (const category of Object.values(CARD_CATEGORIES)) {
      const remainingPool = eligibleCardsByCategory[category].filter(
        c => !drawnCards.some(drawn => drawn.id === c.id)
      );
      if (remainingPool.length === 0) {
        weights[category] = 0;
      }
    }

    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    if (totalWeight <= 0) {
      const fallbackPool = CARD_DATABASE[CARD_CATEGORIES.LAND];
      const chosen = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
      drawnCards.push({
        ...chosen,
        instanceId: `${chosen.id}-${Date.now()}-${i}`
      });
      continue;
    }

    let rand = Math.random() * totalWeight;
    let selectedCategory = CARD_CATEGORIES.LAND;
    
    for (const [category, w] of Object.entries(weights)) {
      rand -= w;
      if (rand <= 0) {
        selectedCategory = category;
        break;
      }
    }

    let pool = eligibleCardsByCategory[selectedCategory].filter(
      c => !drawnCards.some(drawn => drawn.id === c.id)
    );

    if (pool.length === 0) {
      pool = eligibleCardsByCategory[selectedCategory];
    }

    if (pool.length === 0) {
      const eligibleCategories = Object.keys(eligibleCardsByCategory).filter(
        cat => eligibleCardsByCategory[cat] && eligibleCardsByCategory[cat].length > 0
      );
      if (eligibleCategories.length > 0) {
        const fallbackCat = eligibleCategories[Math.floor(Math.random() * eligibleCategories.length)];
        pool = eligibleCardsByCategory[fallbackCat];
      } else {
        pool = CARD_DATABASE[CARD_CATEGORIES.LAND];
      }
    }

    const cardWeights = pool.map(card => {
      if (selectedCategory === CARD_CATEGORIES.LAND && card.weight !== undefined) {
        let w = card.weight;
        if (state.role === ROLES.PIONEER && (card.attribute === ATTRIBUTES.JUNGLE || card.attribute === ATTRIBUTES.DESERT)) {
          w = Math.round(w * 1.5);
        }
        return w;
      }
      
      if (card.rarity === 'c') return 100;
      if (card.rarity === 'uc') return 30;
      if (card.rarity === 'r') return 10;
      if (card.rarity === 'l') return 3;
      return 100;
    });
    const totalCardWeight = cardWeights.reduce((a, b) => a + b, 0);
    
    let cardRand = Math.random() * totalCardWeight;
    let selectedPrototype = pool[0];
    for (let idx = 0; idx < pool.length; idx++) {
      cardRand -= cardWeights[idx];
      if (cardRand <= 0) {
        selectedPrototype = pool[idx];
        break;
      }
    }

    if (selectedPrototype.id === 'event-river-discovery-uc') {
      const bonusOptions = [BONUSES.FRUIT, BONUSES.MARINE, BONUSES.LIVESTOCK];
      const chosenBonus = bonusOptions[Math.floor(Math.random() * bonusOptions.length)];
      selectedPrototype = {
        ...selectedPrototype,
        bonus: chosenBonus,
        desc: `【特別イベント】川（開発不可）と「${getBonusName(chosenBonus)}」を持つ土地を獲得。`
      };
    }

    drawnCards.push({
      ...selectedPrototype,
      instanceId: `${selectedPrototype.id}-${Date.now()}-${i}`
    });
  }

  return drawnCards;
}

function getBonusName(bonus) {
  switch (bonus) {
    case BONUSES.FRUIT: return '果実';
    case BONUSES.GRAIN: return '穀物';
    case BONUSES.LIVESTOCK: return '家畜';
    case BONUSES.VEIN: return '鉱脈';
    case BONUSES.PRECIOUS: return '貴金属';
    case BONUSES.TIMBER: return '高級木材';
    case BONUSES.MARINE: return '水産物';
    default: return '資源';
  }
}
