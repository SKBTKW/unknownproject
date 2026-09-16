// src/components.js - Reusable TCG Card components (Connected Playmat format)
import { CARD_CATEGORIES } from './cards.js';
import { TERRAINS, ATTRIBUTES, BONUSES } from './state.js';

export function getFacilityEmoji(facId) {
  switch (facId) {
    case 'granary': return '🌾';
    case 'workshop': return '🧱';
    case 'temple': return '✨';
    case 'watchtower': return '📡';
    case 'barracks': return '⚔️';
    default: return '🏠';
  }
}

export function getFacilityName(facId) {
  switch (facId) {
    case 'granary': return '穀物庫';
    case 'workshop': return '作業場';
    case 'temple': return '木造の神殿';
    case 'watchtower': return '監視塔';
    case 'barracks': return '兵舎';
    default: return '';
  }
}

export function getCardImageUrl(card) {
  let cardImageUrl = 'images/plains.png?v=260715';
  if (card.terrain) {
    let imgName = card.terrain;
    if (card.attribute === ATTRIBUTES.FOREST) {
      imgName = `${card.terrain}_forest`;
    } else if (card.attribute === ATTRIBUTES.JUNGLE) {
      imgName = `${card.terrain}_jungle`;
    } else if (card.attribute === ATTRIBUTES.DESERT) {
      imgName = `${card.terrain}_desert`;
    }
    cardImageUrl = `images/${imgName}.png?v=260715`;
  } else if (card.type === CARD_CATEGORIES.ATTRIBUTE) {
    let imgName = 'plains';
    if (card.attribute === ATTRIBUTES.FOREST) {
      imgName = 'plains_forest';
    } else if (card.attribute === ATTRIBUTES.JUNGLE) {
      imgName = 'plains_jungle';
    } else if (card.attribute === ATTRIBUTES.DESERT) {
      imgName = 'plains_desert';
    }
    cardImageUrl = `images/${imgName}.png?v=260715`;
  } else if (card.type === CARD_CATEGORIES.MYSTIC) {
    cardImageUrl = 'images/lake.png?v=260715';
  } else if (card.type === CARD_CATEGORIES.MILITARY || card.type === CARD_CATEGORIES.CRISIS) {
    cardImageUrl = 'images/mountains.png?v=260715';
  }
  return cardImageUrl;
}

// Renders a card for hand/offerings
export function renderCard(card, state, isFaceDown = false) {
  const cardEl = document.createElement('div');
  cardEl.className = `game-card rarity-${card.rarity} ${card.type === CARD_CATEGORIES.CRISIS ? 'disaster' : ''} ${isFaceDown ? 'face-down' : ''}`;
  cardEl.dataset.cardId = card.id;
  cardEl.dataset.instanceId = card.instanceId;
  cardEl.draggable = true; // Enable HTML5 drag

  // Icon mapping
  let categoryIcon = '🧭';
  if (card.type === CARD_CATEGORIES.ATTRIBUTE) categoryIcon = '🔍';
  if (card.type === CARD_CATEGORIES.CRISIS) categoryIcon = '☠️';
  if (card.type === CARD_CATEGORIES.SOCIETY) categoryIcon = '👥';
  if (card.type === CARD_CATEGORIES.MYSTIC) categoryIcon = '✨';
  if (card.type === CARD_CATEGORIES.MILITARY) categoryIcon = '⚔️';

  const rarityName = getRarityName(card.rarity);
  const cardImageUrl = getCardImageUrl(card);

  if (isFaceDown) {
    cardEl.innerHTML = `
      <div class="card-image-area" style="background-image: url('images/card_back.png?v=260715'); filter: brightness(0.85);"></div>
      <div class="card-frame-overlay"></div>
      <div class="card-content-layer">
        <div class="card-header">
          <span class="card-category-icon">${categoryIcon}</span>
          <span class="card-rarity-badge">${rarityName}</span>
        </div>
        <div class="card-title">? ? ?</div>
        <div class="card-desc-text">? ? ?</div>
      </div>
    `;
  } else {
    cardEl.innerHTML = `
      <div class="card-image-area" style="background-image: url('${cardImageUrl}');"></div>
      <div class="card-frame-overlay"></div>
      <div class="card-content-layer">
        <div class="card-header">
          <span class="card-category-icon">${categoryIcon}</span>
          <span class="card-rarity-badge">${rarityName}</span>
        </div>
        <div class="card-title">${card.name}</div>
        <div class="card-desc-text">${card.desc}</div>
      </div>
    `;
  }

  return cardEl;
}

// Renders a board slot (rendered as a flat TCG card on the playmat)
export function renderBoardSlot(slot, index, state) {
  const slotEl = document.createElement('div');
  slotEl.className = `board-slot slot-${index} ${!slot.terrain ? 'empty' : ''}`;
  slotEl.dataset.slotIndex = index;
  if (slot.x !== null && slot.y !== null) {
    slotEl.style.left = `${slot.x}%`;
    slotEl.style.top = `${slot.y}%`;
  }

  if (slot.seaOccupied) {
    slotEl.style.display = 'none'; // hidden because the main slot spans over it
    return slotEl;
  }

  // A. Empty slot
  if (!slot.terrain) {
    return slotEl; // Empty slot styling is handled in CSS (shows '+' icon)
  }

  // B. Active Land (Layered TCG Card visual)
  const yields = state.calculateLandYield(slot);
  const terrainName = slot.terrain === TERRAINS.PALACE ? state.getPalaceName() : getTerrainDisplayName(slot.terrain, slot.attribute);
  const rarityName = getRarityName(slot.rarity);

  let imgName = slot.terrain;
  if (slot.attribute === ATTRIBUTES.FOREST) {
    imgName = `${slot.terrain}_forest`;
  } else if (slot.attribute === ATTRIBUTES.JUNGLE) {
    imgName = `${slot.terrain}_jungle`;
  } else if (slot.attribute === ATTRIBUTES.DESERT) {
    imgName = `${slot.terrain}_desert`;
  }
  const cardImageUrl = `images/${imgName}.png?v=260715`;

  // Capacity & Occupied dots
  const capacity = state.getSlotCapacity(slot);
  const occupied = state.getSlotOccupiedCount(slot);
  let slotDots = '';
  if (slot.terrain !== TERRAINS.PALACE) {
    for (let i = 0; i < capacity; i++) {
      if (i < occupied) {
        slotDots += '<span class="slot-dot occupied">●</span>';
      } else {
        slotDots += '<span class="slot-dot empty">○</span>';
      }
    }
  }

  const wrapper = document.createElement('div');
  const attrClass = slot.attribute ? `attr-${slot.attribute}` : '';
  const extraClasses = [];
  if (slot.isNew) extraClasses.push('tile-placed');
  if (yields.mystic > 0) extraClasses.push('has-mystic');

  wrapper.className = `board-card terrain-${slot.terrain} dev-level-${slot.devLevel} rarity-${slot.rarity || 'c'} ${attrClass} ${slot.disasterTurns > 0 || slot.damagedTurns > 0 ? 'disaster-affected' : ''} ${extraClasses.join(' ')}`;
  wrapper.draggable = slot.terrain !== TERRAINS.PALACE; // Palace cannot be dragged

  wrapper.innerHTML = `
    <!-- Lowest Layer: Retro SNES Pixel Art Illustration -->
    <div class="card-image-area" style="background-image: url('${cardImageUrl}');"></div>

    <!-- Middle Layer: High-Res Glassy Frame Overlay -->
    <div class="card-frame-overlay"></div>

    <!-- Upper Layer: Parameters & Text -->
    <div class="card-content-layer">
      <div class="card-header">
        <span class="card-category-icon">🧭</span>
        <span class="card-rarity-badge">${rarityName}</span>
      </div>
      
      <div class="card-title">${terrainName}</div>

      <!-- Stars level badge (Except for Palace) -->
      ${slot.terrain !== TERRAINS.PALACE ? `
        <div class="card-level-stars">
          ${'★'.repeat(slot.devLevel)}${'☆'.repeat(4 - slot.devLevel)}
        </div>
      ` : ''}

      <!-- Yield Stats Bubble -->
      <div class="card-yields-bar">
        ${yields.food > 0 ? `<div class="yield-badge food">🌾 ${yields.food}</div>` : ''}
        ${yields.materials > 0 ? `<div class="yield-badge materials">🧱 ${yields.materials}</div>` : ''}
        ${yields.defense > 0 ? `<div class="yield-badge defense">🛡️ ${yields.defense}</div>` : ''}
        ${yields.mystic > 0 ? `<div class="yield-badge mystic">✨ ${yields.mystic}</div>` : ''}
      </div>

      <!-- Capacity indicators at the bottom -->
      ${slot.terrain !== TERRAINS.PALACE ? `
        <div class="card-slots-indicator" title="空き容量: 資源/施設スロット">
          ${slotDots}
        </div>
      ` : ''}
    </div>

    <!-- Top Overlay Layer: Land Attributes & Facility Badges -->
    <div class="card-badges-layer">
      ${slot.attribute ? `<span class="badge attr">${getAttributeName(slot.attribute)}</span>` : ''}
      ${slot.bonus ? `<span class="badge bonus">${getBonusName(slot.bonus)}</span>` : ''}
      ${slot.facility ? `<span class="badge facility">${getFacilityEmoji(slot.facility)} ${getFacilityName(slot.facility)}</span>` : ''}
      ${slot.overlayLevel > 0 ? `<span class="badge memory">⚔️ ${slot.overlayLevel}</span>` : ''}
      ${slot.disasterTurns > 0 || slot.damagedTurns > 0 ? `<span class="badge disaster-warn">⚠ 荒廃</span>` : ''}
    </div>
  `;

  slotEl.appendChild(wrapper);
  return slotEl;
}

// Renders the list of buildable facilities in the right sidebar
export function renderFacilities(state, buildHandler) {
  const container = document.getElementById('facility-build-list');
  container.innerHTML = '';

  const facilityDefs = [
    { id: 'granary', name: '穀物庫', cost: 60, fireCost: 1, icon: '🌾', effect: '食料🌾産出 +15 / ターン', desc: '集落に安定した食料供給をもたらす。', policy: 'agriculture', policyName: '集約農業' },
    { id: 'watchtower', name: '監視塔', cost: 70, fireCost: 1, icon: '📡', effect: '防衛🛡️ +10 / ターン、試練の事前予知 +1T', desc: '遠方の敵をいち早く警戒する。', policy: 'forestry', policyName: '近代林業' },
    { id: 'workshop', name: '作業場', cost: 80, fireCost: 1, icon: '🧱', effect: '資材🧱産出 +15 / ターン', desc: '道具を改良し、インフラ開発力を高める。', policy: 'masonry', policyName: '石造建築' },
    { id: 'barracks', name: '兵舎', cost: 90, fireCost: 2, icon: '⚔️', effect: '防衛🛡️ +15 / ターン、軍備カードの優先出現', desc: '衛兵を訓練し、試練に備える。', policy: 'tactics', policyName: '防衛戦術' },
    { id: 'temple', name: '木造の神殿', cost: 100, fireCost: 2, icon: '✨', effect: '神秘✨産出 +5 / ターン', desc: '信仰心を高め、残り火の奇跡を引き寄せる。', policy: 'mysticism', policyName: '神秘主義' }
  ];

  facilityDefs.forEach(fac => {
    const isBuilt = state.facilities[fac.id];
    const isUnlocked = (state.unlockedFacilities && state.unlockedFacilities[fac.id]) || state.policies[fac.policy];
    let actualCost = fac.cost;
    const fireCost = fac.fireCost;

    // General discount for military structures
    if (state.role === 'general' && (fac.id === 'watchtower' || fac.id === 'barracks')) {
      actualCost = Math.round(fac.cost * 0.7);
    }

    // Society event discount (Artisans' Awakening)
    if (state.facilitiesDiscount > 0) {
      actualCost = Math.max(0, actualCost - state.facilitiesDiscount);
    }

    const canAfford = state.materials >= actualCost && state.fire >= fireCost;
    const hasEmptySlot = state.board.some((slot, idx) => idx > 0 && slot && slot.terrain && state.getSlotEmptyCount(slot) >= 1);
    const canBuild = canAfford && hasEmptySlot && isUnlocked;

    const itemEl = document.createElement('div');
    itemEl.className = `facility-item ${isBuilt ? 'built' : ''} ${!isUnlocked && !isBuilt ? 'locked' : ''}`;

    if (isBuilt) {
      itemEl.innerHTML = `
        <div>
          <div class="fac-name">${fac.icon} ${fac.name} <span class="built-tag">✓ 建設済</span></div>
          <div class="fac-effect">${fac.effect}</div>
        </div>
      `;
    } else if (!isUnlocked) {
      itemEl.innerHTML = `
        <div style="opacity: 0.6;">
          <div class="fac-name" style="color: #9ca3af;">🔒 ${fac.icon} ${fac.name} (ロック中)</div>
          <div class="fac-effect" style="color: #6b7280; font-size: 0.65rem;">要: 制度「${fac.policyName}」の解禁 または イベント</div>
        </div>
      `;
    } else {
      itemEl.innerHTML = `
        <div>
          <div class="fac-name">${fac.icon} ${fac.name} <span class="fac-cost">(🔥 ${fireCost}, 🧱 ${actualCost})</span></div>
          <div class="fac-effect">${fac.effect}</div>
        </div>
        <button class="action-btn success fac-build-btn" data-facility-id="${fac.id}" ${canBuild ? '' : 'disabled'}>
          建設
        </button>
      `;
    }

    const btn = itemEl.querySelector('.fac-build-btn');
    if (btn) {
      btn.addEventListener('click', () => buildHandler(fac.id, actualCost));
    }

    container.appendChild(itemEl);
  });
}

// Renders the Policy Tree layout inside modal
export function renderPolicyTree(state, unlockHandler) {
  const container = document.getElementById('policy-tree-list');
  container.innerHTML = '';

  const policiesList = [
    { id: 'agriculture', name: '集約農業 (Agriculture)', cost: 50, desc: '平地(Plains)地形からの食料🌾産出量を +25% 増加する。' },
    { id: 'forestry', name: '近代林業 (Forestry)', cost: 60, desc: '森林(Forest)属性の土地からの資材🧱産出量を +25% 増加する。' },
    { id: 'masonry', name: '石造建築 (Masonry)', cost: 70, desc: '丘陵・山岳地形からの資材🧱産出量を +25% 増加する。' },
    { id: 'mysticism', name: '神秘主義 (Mysticism)', cost: 80, desc: '神秘✨を産出するすべての土地の効果を +25% 強化する。' },
    { id: 'tactics', name: '防衛戦術 (Tactics)', cost: 90, desc: '防衛力🛡️を産出するすべての土地・施設の効果を +25% 強化する。' }
  ];

  const rowEl = document.createElement('div');
  rowEl.className = 'policy-row';

  policiesList.forEach(pol => {
    const isUnlocked = state.policies[pol.id];
    const canAfford = state.materials >= pol.cost;
    const canUnlock = !isUnlocked && canAfford;

    const nodeEl = document.createElement('div');
    nodeEl.className = `policy-node ${isUnlocked ? 'unlocked' : canUnlock ? 'can-unlock' : 'locked'}`;
    nodeEl.dataset.policyId = pol.id;

    nodeEl.innerHTML = `
      <div class="pol-name">
        <span>${pol.name}</span>
        ${isUnlocked ? '<span class="status text-food">解禁済</span>' : `<span class="pol-cost">🧱 ${pol.cost}</span>`}
      </div>
      <div class="pol-desc">${pol.desc}</div>
    `;

    if (canUnlock) {
      nodeEl.addEventListener('click', () => unlockHandler(pol.id, pol.cost));
    }

    rowEl.appendChild(nodeEl);
  });

  container.appendChild(rowEl);
}

// Helpers
function getRarityName(rarity) {
  switch (rarity) {
    case 'c': return 'コモン';
    case 'uc': return 'アンコモン';
    case 'r': return 'レア';
    case 'l': return 'レジェンダリ';
    default: return 'ノーマル';
  }
}

export function getTerrainIcon(terrain) {
  switch (terrain) {
    case TERRAINS.PALACE: return '🏰';
    case TERRAINS.PLAINS: return '🌾';
    case TERRAINS.HILLS: return '⛰';
    case TERRAINS.MOUNTAINS: return '🏔';
    case TERRAINS.LAKE: return '💧';
    case TERRAINS.SEA: return '🌊';
    default: return '❔';
  }
}

export function getTerrainDisplayName(terrain, attribute = null) {
  if (terrain === TERRAINS.PALACE) return '宮殿';
  if (terrain === TERRAINS.LAKE) return '湖';
  if (terrain === TERRAINS.SEA) return '海';

  if (terrain === TERRAINS.PLAINS) {
    if (attribute === ATTRIBUTES.DESERT) return '砂漠';
    if (attribute === ATTRIBUTES.FOREST) return '森';
    if (attribute === ATTRIBUTES.JUNGLE) return '森林';
    return '平地';
  }
  if (terrain === TERRAINS.HILLS) {
    if (attribute === ATTRIBUTES.DESERT) return '砂丘';
    if (attribute === ATTRIBUTES.FOREST) return '森丘陵';
    if (attribute === ATTRIBUTES.JUNGLE) return '森林丘陵';
    return '丘陵';
  }
  if (terrain === TERRAINS.MOUNTAINS) {
    if (attribute === ATTRIBUTES.DESERT) return '砂漠山岳';
    if (attribute === ATTRIBUTES.FOREST) return '森山岳';
    if (attribute === ATTRIBUTES.JUNGLE) return '森林山岳';
    return '山岳';
  }
  return '未知';
}

export function getAttributeName(attribute) {
  switch (attribute) {
    case ATTRIBUTES.FOREST: return '森';
    case ATTRIBUTES.JUNGLE: return '森林';
    case ATTRIBUTES.DESERT: return '砂漠';
    case ATTRIBUTES.RIVER: return '川';
    default: return '';
  }
}

export function getBonusName(bonus) {
  switch (bonus) {
    case BONUSES.FRUIT: return '果実';
    case BONUSES.GRAIN: return '穀物';
    case BONUSES.LIVESTOCK: return '家畜';
    case BONUSES.VEIN: return '鉱脈';
    case BONUSES.PRECIOUS: return '貴金属';
    case BONUSES.TIMBER: return '高級木材';
    case BONUSES.MARINE: return '水産物';
    default: return '';
  }
}
