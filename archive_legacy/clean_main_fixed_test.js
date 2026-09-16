// src/main.js - Game loop and interaction orchestrator (Drag & Drop + 3D Tiles)
import { GameState, ROLES, TERRAINS, ATTRIBUTES, BONUSES } from './state.js';
import { drawThreeOfferings, CARD_CATEGORIES, CARD_DATABASE, RIVER_DISCOVERY_CARD } from './cards.js';
import { resolveTrial, getTrialSettings, executeDisaster, updateTrialPreview } from './trials.js';
import { renderCard, renderBoardSlot, renderFacilities, renderPolicyTree, getTerrainIcon, getFacilityName, getFacilityEmoji } from './components.js?v=2';
import { sound } from './sound.js';

// Global Game State
const state = new GameState();

// Setup Sound Log interceptor
state.onLog = (message, type) => {
  if (type === 'warning') {
    sound.playError();
  } else if (type === 'reward') {
    sound.playMerge();
  }
};

// Bind sound toggle button
document.addEventListener('DOMContentLoaded', () => {
  const btnToggleSound = document.getElementById('btn-toggle-sound');
  if (btnToggleSound) {
    btnToggleSound.addEventListener('click', () => {
      const isMuted = sound.toggleMute();
      btnToggleSound.innerText = isMuted ? '🔇' : '🔊';
      sound.playClick();
    });
  }
});

// Helper: map card rarity to devLevel
function getCardDevLevel(card) {
  if (!card) return 0;
  return card.devLevel || 0;
}

function updateLandRarity(land) {
  if (!land) return;
}

function updateLandRarity(land) {
  if (!land) return;
  if (land.devLevel >= 3) land.rarity = 'l';
  else if (land.devLevel === 2) land.rarity = 'r';
  else if (land.devLevel === 1) land.rarity = 'uc';
  else land.rarity = 'c';
}

function getMaxSelectableTraits(traits) {
  let hasAttr = traits.some(t => t.type === 'attr');
  let hasBonus = traits.some(t => t.type === 'bonus');
  
  // Check duplication
  let hasDup = false;
  const attrs = traits.filter(t => t.type === 'attr');
  if (attrs.length === 2 && attrs[0].val === attrs[1].val) hasDup = true;
  const bonuses = traits.filter(t => t.type === 'bonus');
  if (bonuses.length === 2 && bonuses[0].val === bonuses[1].val) hasDup = true;

  if (hasDup) return Math.min(2, traits.length);

  let maxSelectable = 0;
  if (hasAttr) maxSelectable += 1;
  if (hasBonus) maxSelectable += 1;
  return Math.min(2, maxSelectable);
}

function getDefaultSelectedTraits(traits) {
  const selected = [];
  traits.forEach(t => {
    if (selected.some(item => item.type === t.type && item.val !== t.val)) {
      return;
    }
    if (selected.length < 2) {
      selected.push(t);
    }
  });
  return selected;
}

// UI Elements
const el = {
  currentTurn: document.getElementById('current-turn'),
  valFire: document.getElementById('val-fire'),
  valMaxFire: document.getElementById('val-max-fire'),
  valFood: document.getElementById('val-food'),
  valMaterials: document.getElementById('val-materials'),
  valDefense: document.getElementById('val-defense'),
  valMystic: document.getElementById('val-mystic'),
  
  trialCountdown: document.getElementById('trial-countdown'),
  trialDetails: document.getElementById('trial-details'),
  activeRoleDisplay: document.getElementById('active-role-display'),
  legacyList: document.getElementById('legacy-list'),
  disastersList: document.getElementById('disasters-list'),
  logConsole: document.getElementById('log-console'),
  
  landGrid: document.getElementById('land-grid'),
  cardOfferingsZone: document.getElementById('card-offerings-zone'),
  interactionTitle: document.getElementById('interaction-title'),
  
  btnDrawExtra: document.getElementById('btn-draw-extra'),
  btnMulligan: document.getElementById('btn-mulligan'),
  btnOpenSocial: document.getElementById('btn-open-social'),
  btnEndTurn: document.getElementById('btn-end-turn'),
  
  mysticProgress: document.getElementById('mystic-progress'),
  mysticMeterText: document.getElementById('mystic-meter-text'),
  btnMiracleLow: document.getElementById('btn-miracle-low'),
  btnMiracleMed: document.getElementById('btn-miracle-med'),
  btnMiracleHigh: document.getElementById('btn-miracle-high'),
  
  riverExpeditionPanel: document.getElementById('river-expedition-panel'),
  
  // Modals
  modalRoleSelect: document.getElementById('modal-role-select'),
  modalSocialTree: document.getElementById('modal-social-tree'),
  btnCloseSocial: document.getElementById('btn-close-social'),
  
  modalMergeSelect: document.getElementById('modal-merge-select'),
  btnConfirmMerge: document.getElementById('btn-confirm-merge'),
  btnCancelMerge: document.getElementById('btn-cancel-merge'),
  
  modalRiverEvent: document.getElementById('modal-river-event'),
  modalGenericEvent: document.getElementById('modal-generic-event'),
  
  modalTrialResult: document.getElementById('modal-trial-result'),
  trialResultBadge: document.getElementById('trial-result-badge'),
  trialResultTitle: document.getElementById('trial-result-title'),
  trialResultDesc: document.getElementById('trial-result-desc'),
  trialRewardsZone: document.getElementById('trial-rewards-zone'),
  btnConfirmRewards: document.getElementById('btn-confirm-rewards'),
  trialLossActions: document.getElementById('trial-loss-actions'),
  btnCloseTrialLoss: document.getElementById('btn-close-trial-loss'),
  
  modalGameEnd: document.getElementById('modal-game-end'),
  gameEndTitle: document.getElementById('game-end-title'),
  gameEndDesc: document.getElementById('game-end-desc'),
  scoreBreakdown: document.getElementById('score-breakdown'),

  // Polity Modals
  btnOpenPolity: document.getElementById('btn-open-polity'),
  modalPolitySelect: document.getElementById('modal-polity-select'),
  btnClosePolity: document.getElementById('btn-close-polity'),
  currentPolityStatusCard: document.getElementById('current-polity-status-card'),
  polityOptionsList: document.getElementById('polity-options-list')
};

// Drag and Drop state variables
function initGame() {
  startTurn();
  initGlobalDragAndDropListeners();
}

// Start a turn
function startTurn() {
  const yields = state.calculateTotalProduction();
  state.defense = yields.defense + state.accumulatedDefense;
  state.drawnThisTurn = false;
  state.additionalDrawsCount = 0;
  selectedOffering = null;
  activeAttachmentCard = null;
  activeLandCardToPlace = null;
  selectedMergeSlotAIndex = null;

  // Visual turn start banner
  triggerTurnStartBanner(state.currentTurn);

  // 1. Process Disaster Turn decays
  state.board.forEach(land => {
    if (land && land.disasterTurns > 0) {
      land.disasterTurns--;
      if (land.disasterTurns === 0) {
        state.addLog(`土地 (${getTerrainDisplayName(land.terrain, land.attribute)}) の災害被害が復興しました！生産力が元に戻ります。`, 'system');
      }
    }
    if (land && land.damagedTurns > 0) {
      land.damagedTurns--;
      if (land.damagedTurns === 0) {
        state.addLog(`被災地 (${getTerrainDisplayName(land.terrain, land.attribute)}) が復興しました！生産力に「戦場の記憶」Lv.${land.overlayLevel} バフが乗ります！`, 'system');
      }
    }
  });

  // Remove expired disasters from list
  state.activeDisasters = state.activeDisasters.filter(d => {
    d.turnsRemaining--;
    return d.turnsRemaining > 0;
  });

  // 2. Reserve zone penalty: lose 1 🔥 per turn if any reserve slot is occupied
  const reserveOccupiedCount = state.reserve.filter(c => c !== null).length;
  if (reserveOccupiedCount > 0) {
    state.adjustResource('fire', -1);
    state.addLog(`警告：保留ゾーンにカードが残っているため、残り火が 1 🔥 減少しました。`, 'warning');
  }

  // 3. Increment Turn Draw Offerings
  triggerDrawOfferings();

  // 4. Update trial alerts
  updateTrialPreview(state);
  resolveTrialCountdown();

  // 5. Trigger downstream river search if applicable
  checkRiverExpeditionEvents();

  // 6. Check if a trial is scheduled for the END of this turn!
  if (state.currentTurn === state.upcomingTrial.turn) {
    showTrialApproachingModal();
  }

  updateUI();
}

// Trigger card offerings draw
function triggerDrawOfferings() {
  state.queuedDisasters = [];
  state.offerings = drawThreeOfferings(state);
  renderOfferings();
  el.interactionTitle.innerText = `※ドローエリア (カードを盤面にドラッグするか、保留スロットにドロップできます)`;
  
  // Unlock buttons
  el.btnMulligan.disabled = state.fire < 2;
  el.btnDrawExtra.disabled = state.fire < 1;

  // Process queued disasters sequentially
  if (state.queuedDisasters && state.queuedDisasters.length > 0) {
    const processNextDisaster = () => {
      if (!state.queuedDisasters || state.queuedDisasters.length === 0) return;
      const disasterId = state.queuedDisasters.shift();
      resolveDisasterEvent(disasterId, processNextDisaster);
    };
    processNextDisaster();
  }
}

// Render the 3 card offerings
function renderOfferings() {
  el.cardOfferingsZone.innerHTML = '';
  state.offerings.forEach((card, index) => {
    const cardEl = renderCard(card, state, false);
    
    // Add drag start listener
    cardEl.addEventListener('dragstart', (e) => {
      draggedCard = card;
      draggedSourceType = 'offering';
      draggedSourceIndex = index;
      cardEl.classList.add('dragging');
    });
  checkRiverExpeditionEvents();

  // 6. Check if a trial is scheduled for the END of this turn!
  if (state.currentTurn === state.upcomingTrial.turn) {
    showTrialApproachingModal();
  }

  updateUI();
}

// Trigger card offerings draw
function triggerDrawOfferings() {
  state.queuedDisasters = [];
  state.offerings = drawThreeOfferings(state);
  renderOfferings();
  el.interactionTitle.innerText = `※ドローエリア (カードを盤面にドラッグするか、保留スロットにドロップできます)`;
  
  // Unlock buttons
  el.btnMulligan.disabled = state.fire < 2;
  el.btnDrawExtra.disabled = state.fire < 1;

  // Process queued disasters sequentially
  if (state.queuedDisasters && state.queuedDisasters.length > 0) {
    const processNextDisaster = () => {
      if (!state.queuedDisasters || state.queuedDisasters.length === 0) return;
      const disasterId = state.queuedDisasters.shift();
      resolveDisasterEvent(disasterId, processNextDisaster);
    };
    processNextDisaster();
  }
}
  previewCardEl.draggable = false;
  el.cardOfferingsZone.appendChild(previewCardEl);

  state.addLog(`カード「${card.name}」を獲得しました。`, 'action');

  updateUI();

  if (card.type === CARD_CATEGORIES.LAND) {
    activeLandCardToPlace = card;
    el.interactionTitle.innerText = `配置フェイズ：盤面の空きスロット (+) を選択して配置してください (コスト: 1 🔥)`;
  else if (card.type === CARD_CATEGORIES.SOCIETY || card.type === CARD_CATEGORIES.MYSTIC || card.type === CARD_CATEGORIES.MILITARY) {
    resolveImmediateEvent(card);
    endDrawPhase();
  }
}

// Highlight empty board slots for placement
function highlightEmptySlots() {
  state.board.forEach((slot, index) => {
    endDrawPhase();
  } 
  else if (card.type === CARD_CATEGORIES.SOCIETY || card.type === CARD_CATEGORIES.MYSTIC || card.type === CARD_CATEGORIES.MILITARY) {
    resolveImmediateEvent(card);
    endDrawPhase();
  }
}

// Highlight empty board slots for placement
function highlightEmptySlots() {
  state.board.forEach((slot, index) => {
    if (index !== 0 && (!slot || !slot.seaOccupied)) { // Palace (0) is never empty/replaced
      const slotEl = document.querySelector(`.board-slot.slot-${index}`);
      if (slotEl) slotEl.classList.add('highlight-placement');
    }
  });
}

// Highlight valid land slots for attribute/bonus attachment
function highlightApplicableSlots(card) {
  state.board.forEach((slot, index) => {
    if (slot && slot.terrain && !slot.seaOccupied && index !== 0) { // Palace cannot take traits
      let isValid = true;
      
      // Lake cannot take traits, EXCEPT for Marine bonus which can go to Lake/River!
      if (slot.terrain === TERRAINS.LAKE && (!card.bonus || card.bonus !== BONUSES.MARINE)) {
        if (card.bonus === BONUSES.PRECIOUS && slot.terrain !== TERRAINS.HILLS && slot.terrain !== TERRAINS.MOUNTAINS) isValid = false;
        if (card.bonus === BONUSES.TIMBER && slot.attribute !== ATTRIBUTES.FOREST && slot.attribute !== ATTRIBUTES.JUNGLE) isValid = false;
        if (card.bonus === BONUSES.MARINE && slot.attribute !== ATTRIBUTES.RIVER && slot.terrain !== TERRAINS.LAKE) isValid = false;
      }
      if (card.attribute) {
        if (slot.attribute) isValid = false;
      }

      if (isValid) {
    highlightEmptySlots();
  } 
  else if (card.type === CARD_CATEGORIES.ATTRIBUTE) {
    activeAttachmentCard = card;
    el.interactionTitle.innerText = `資源調査フェイズ：調査・発見を行いたい土地を選択してください (コスト: 1 🔥)`;
    highlightApplicableSlots(card);
  } 
  else if (card.type === CARD_CATEGORIES.CRISIS) {
    resolveDisasterEvent(card.id);
    endDrawPhase();
  } 
  else if (card.type === CARD_CATEGORIES.SOCIETY || card.type === CARD_CATEGORIES.MYSTIC || card.type === CARD_CATEGORIES.MILITARY) {
    resolveImmediateEvent(card);
    endDrawPhase();
  }
}

// Highlight empty board slots for placement
function highlightEmptySlots() {
  state.board.forEach((slot, index) => {
    if (index !== 0 && (!slot || !slot.seaOccupied)) { // Palace (0) is never empty/replaced
        if (resCard === null) {
          const resEl = document.querySelector(`.reserve-slot[data-reserve-index="${idx}"]`);
          if (resEl) resEl.classList.add('highlight-placement');
        }
      });
    }
  } 
  
  // 2. Dragging an active land from the board
  else if (draggedSourceType === 'board') {
  clearHighlights();
  selectedOffering = null;
  activeAttachmentCard = null;
  activeLandCardToPlace = null;
  
  el.interactionTitle.innerText = `アクションフェイズ：土地の開発（ニコイチ）や保留、施設の建設を行えます`;
  el.cardOfferingsZone.innerHTML = `<div class="info-text">TURN RND を押すと、資源生産を獲得して次のターンに進みます。</div>`;
  
  el.btnMulligan.disabled = true;
  el.btnDrawExtra.disabled = true;
}

// Initialize Drag & Drop Target Handlers
function initGlobalDragAndDropListeners() {
  
  el.btnMulligan.disabled = true;
  el.btnDrawExtra.disabled = true;
}

// Initialize Drag & Drop Target Handlers
function initGlobalDragAndDropListeners() {
  // Bind Reserve slots
  document.querySelectorAll('.reserve-slot').forEach(slot => {
    const idx = parseInt(slot.dataset.reserveIndex);
        if (slotEl) slotEl.classList.add('highlight-attachment');
      }
    });
// Highlight valid drop targets during dragging
function highlightValidTargets() {
  clearHighlights();

  // 1. Dragging a card from hand/reserve
  if (draggedCard) {
    if (draggedCard.type === CARD_CATEGORIES.LAND) {
      highlightEmptySlots();
      // Highlight matching lands for direct merging from draw/reserve!
      state.board.forEach((slot, index) => {
        if (slot && slot.terrain === draggedCard.terrain && index !== 0 && slot.terrain !== TERRAINS.LAKE) {
          const slotEl = document.querySelector(`.board-slot.slot-${index}`);
          if (slotEl) slotEl.classList.add('highlight-attachment');
        }
      });
    } else if (draggedCard.type === CARD_CATEGORIES.ATTRIBUTE) {
      highlightApplicableSlots(draggedCard);
    }
    
    // Highlight reserve slots
    if (draggedSourceType === 'offering') {
      state.reserve.forEach((resCard, idx) => {
        if (resCard === null) {
          const resEl = document.querySelector(`.reserve-slot[data-reserve-index="${idx}"]`);
          if (resEl) resEl.classList.add('highlight-placement');
        }
      });
    }
  } 
  
  // 2. Dragging an active land from the board
  else if (draggedSourceType === 'board') {
    const activeLand = state.board[draggedSourceIndex];
    // Highlight matching lands for combining
    state.board.forEach((slot, index) => {
      if (slot && slot.terrain === activeLand.terrain && index !== draggedSourceIndex && index !== 0 && slot.terrain !== TERRAINS.LAKE) {
        const slotEl = document.querySelector(`.board-slot.slot-${index}`);
        if (slotEl) slotEl.classList.add('highlight-attachment');
      }
    });

    // Highlight empty reserve slots
    state.reserve.forEach((resCard, idx) => {
      if (resCard === null) {
        const resEl = document.querySelector(`.reserve-slot[data-reserve-index="${idx}"]`);
        if (resEl) resEl.classList.add('highlight-placement');
      }
    });
  }
}

// Remove highlights from board slots
function clearHighlights() {
      handleDropOnReserveSlot(idx);
    });

    slot.addEventListener('click', () => {
      sound.playClick();
      handleReserveSlotClick(idx);
    });
  });

  // Bind toggle logs button click
  const btnToggleLog = document.getElementById('btn-toggle-log');
  const gameLayout = document.querySelector('.game-layout');
  const sidebarLeft = document.getElementById('sidebar-left-panel');
  if (btnToggleLog && gameLayout && sidebarLeft) {
    btnToggleLog.addEventListener('click', () => {
      const isCollapsed = gameLayout.classList.toggle('log-collapsed');
      sidebarLeft.classList.toggle('collapsed', isCollapsed);
      btnToggleLog.innerText = isCollapsed ? '▶' : '◀';
    });
  }

  // Bind drag & drop listeners to the board canvas container itself
  el.landGrid.addEventListener('dragover', (e) => {
    e.preventDefault();
    
    // Highlight board area as valid drop target
    if (draggedCard && draggedCard.type === CARD_CATEGORIES.LAND) {
      el.landGrid.classList.add('highlight-placement');
    }
    
    // High-performance real-time dragging for repositioning board slots (Comfy style!)
    if (draggedSourceType === 'board') {
      const rect = el.landGrid.getBoundingClientRect();
      const x = Math.max(8, Math.min(92, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(8, Math.min(92, ((e.clientY - rect.top) / rect.height) * 100));
      
      // Update coordinates in state
      state.board[draggedSourceIndex].x = x;
      state.board[draggedSourceIndex].y = y;
      
      // Move DOM element directly for high performance
      const slotEl = document.querySelector(`.board-slot.slot-${draggedSourceIndex}`);
      if (slotEl) {
        slotEl.style.transition = 'none';
        slotEl.style.left = `${x}%`;
        slotEl.style.top = `${y}%`;
      }
      
      // Update SVG connection lines in real-time
      updateConnectionsSVG();
    }
  });

  el.landGrid.addEventListener('dragleave', () => {
    el.landGrid.classList.remove('highlight-placement');
  });

  el.landGrid.addEventListener('drop', (e) => {
    e.preventDefault();
    el.landGrid.classList.remove('highlight-placement');
    
    const rect = el.landGrid.getBoundingClientRect();
    const dropX = Math.max(8, Math.min(92, ((e.clientX - rect.left) / rect.width) * 100));
    const dropY = Math.max(8, Math.min(92, ((e.clientY - rect.top) / rect.height) * 100));

    // A. Placing new land card from offerings or reserve onto the canvas
    if (draggedCard && draggedCard.type === CARD_CATEGORIES.LAND) {
      handlePlaceLandAtCoords(draggedCard, dropX, dropY);
    }
    // B. Repositioning existing land node on the canvas (handled in dragover in real-time, just finalize it here!)
    else if (draggedSourceType === 'board') {
      state.board[draggedSourceIndex].x = dropX;
      state.board[draggedSourceIndex].y = dropY;
      state.addLog(`領土スロット ${draggedSourceIndex} を位置 (${Math.round(dropX)}%, ${Math.round(dropY)}%) へ移動しました。`, 'system');
      updateUI();
      if (draggedSourceType !== 'reserve') {
        draggedSourceType = 'offering';
        draggedSourceIndex = 0;
      }
      handlePlaceLandAtCoords(draggedCard, clickX, clickY);
    }
  });

  // Bind Card Smelter / Discard Slot
  const smelter = document.getElementById('card-smelter');
  if (smelter) {
    smelter.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (draggedCard) {
        smelter.classList.add('drag-over');
      }
    });

    smelter.addEventListener('dragleave', () => {
      smelter.classList.remove('drag-over');
    });

    smelter.addEventListener('drop', (e) => {
      e.preventDefault();
      smelter.classList.remove('drag-over');
      
      if (draggedCard) {
        const cardName = draggedCard.name;
        state.adjustResource('fire', 1);
        
        if (draggedSourceType === 'offering') {
          state.drawnThisTurn = true;
          endDrawPhase();
        }
          state.drawnThisTurn = true;
          endDrawPhase();
        }
        updateUI();
      }
    });

    smelter.addEventListener('click', () => {
      let cardToDiscard = activeLandCardToPlace || activeAttachmentCard;
      if (!cardToDiscard && selectedOffering !== null) {
        cardToDiscard = state.offerings[selectedOffering];
      }
      
      if (cardToDiscard) {
        const cardName = cardToDiscard.name;
        state.adjustResource('fire', 1);
        
        draggedCard = cardToDiscard;
        if (selectedOffering !== null && !activeLandCardToPlace && !activeAttachmentCard) {
          draggedSourceType = 'offering';
          draggedSourceIndex = selectedOffering;
        }
        
        removeDraggedCardFromSource();
        state.addLog(`還元炉：カード「${cardName}」を破棄し、残り火をエネルギーに還元しました (+1 🔥)。`, 'action');
        
        if (draggedSourceType === 'offering') {
          state.drawnThisTurn = true;
          endDrawPhase();
        }
        
        selectedOffering = null;
        activeLandCardToPlace = null;
        activeAttachmentCard = null;
        updateUI();
      } else {
        state.addLog('還元するカードを選択（クリック）してから還元炉をクリックしてください。', 'system');
      }
    });
  }

  // Bind resource details clicking breakdown
  bindResourceDetailsClick();
}

// Helper: check if we can drop dragged item on target board slot
  // 1. Dragging land A from board onto land B
  if (draggedSourceType === 'board') {
    if (draggedSourceIndex === targetIndex) return false;
    const sourceSlot = state.board[draggedSourceIndex];
    return sourceSlot && targetSlot.terrain && 
           sourceSlot.terrain === targetSlot.terrain && 
           targetSlot.terrain !== TERRAINS.LAKE &&
           sourceSlot.devLevel === targetSlot.devLevel;
  }
}

// Helper: check if we can drop dragged item on target board slot
function canDropOnBoardSlot(targetSlot, targetIndex) {
  if (targetSlot.seaOccupied) return false;

  // Palace (slot 0) cannot be replaced, merged or attached traits
  if (targetIndex === 0) return false;



  // 1. Dragging land A from board onto land B
  if (draggedSourceType === 'board') {
    if (draggedSourceIndex === targetIndex) return false;
    const sourceSlot = state.board[draggedSourceIndex];
    return sourceSlot && targetSlot.terrain && 
           sourceSlot.terrain === targetSlot.terrain && 
           targetSlot.terrain !== TERRAINS.LAKE &&
           sourceSlot.devLevel === targetSlot.devLevel;
  }

  // 2. Dragging card from offerings/reserve
  if (draggedCard) {
    // A. Empty slot -> Place Land
    if (!targetSlot.terrain) {
      return draggedCard.type === CARD_CATEGORIES.LAND;
    }
    
    // B. Occupied slot
    // B1. Direct Merge / Overwrite: Drag land card from offering/reserve onto slot
    if (draggedCard.type === CARD_CATEGORIES.LAND) {
      if (targetSlot.terrain === draggedCard.terrain) {
        if (targetSlot.terrain === TERRAINS.LAKE) return false; // Lake cannot merge
        const cardDevLevel = getCardDevLevel(draggedCard);
        return targetSlot.devLevel === cardDevLevel;
      }
      return true; // Overwrite
    }
    // B2. Attachment: Drag trait card onto land
    if (draggedCard.type === CARD_CATEGORIES.ATTRIBUTE) {
}

// Helper: check if we can drop dragged item on target board slot
function canDropOnBoardSlot(targetSlot, targetIndex) {
  if (targetSlot.seaOccupied) return false;

  // Palace (slot 0) cannot be replaced, merged or attached traits
  if (targetIndex === 0) return false;



  // 1. Dragging land A from board onto land B
  if (draggedSourceType === 'board') {
    if (draggedSourceIndex === targetIndex) return false;
    const sourceSlot = state.board[draggedSourceIndex];
    return sourceSlot && targetSlot.terrain && 
           sourceSlot.terrain === targetSlot.terrain && 
           targetSlot.terrain !== TERRAINS.LAKE &&
           sourceSlot.devLevel === targetSlot.devLevel;
  }

  // 2. Dragging card from offerings/reserve
  if (draggedCard) {
    // A. Empty slot -> Place Land
    if (!targetSlot.terrain) {
      return draggedCard.type === CARD_CATEGORIES.LAND;
    }
    
    // B. Occupied slot
    // B1. Direct Merge / Overwrite: Drag land card from offering/reserve onto slot
    if (draggedCard.type === CARD_CATEGORIES.LAND) {
      if (targetSlot.terrain === draggedCard.terrain) {
        if (targetSlot.terrain === TERRAINS.LAKE) return false; // Lake cannot merge
        const cardDevLevel = getCardDevLevel(draggedCard);
        return targetSlot.devLevel === cardDevLevel;
      }
      return true; // Overwrite
    }
    // B2. Attachment: Drag trait card onto land
    if (draggedCard.type === CARD_CATEGORIES.ATTRIBUTE) {
      if (targetIndex === 0) return false; // Palace cannot take traits
      if (targetSlot.terrain === TERRAINS.LAKE && (!draggedCard.bonus || draggedCard.bonus !== BONUSES.MARINE)) return false;
      
      if (draggedCard.attribute && targetSlot.attribute) return false;
      if (draggedCard.bonus) {
        if (targetSlot.bonus) return false;
        if (draggedCard.bonus === BONUSES.FRUIT && targetSlot.terrain !== TERRAINS.PLAINS && targetSlot.attribute !== ATTRIBUTES.FOREST && targetSlot.attribute !== ATTRIBUTES.JUNGLE) return false;
        if (draggedCard.bonus === BONUSES.GRAIN && targetSlot.terrain !== TERRAINS.PLAINS) return false;
        if (draggedCard.bonus === BONUSES.LIVESTOCK && targetSlot.terrain !== TERRAINS.PLAINS) return false;
        if (draggedCard.bonus === BONUSES.VEIN && targetSlot.terrain !== TERRAINS.HILLS && targetSlot.terrain !== TERRAINS.MOUNTAINS) return false;
        if (draggedCard.bonus === BONUSES.PRECIOUS && targetSlot.terrain !== TERRAINS.HILLS && targetSlot.terrain !== TERRAINS.MOUNTAINS) return false;
        if (draggedCard.bonus === BONUSES.TIMBER && targetSlot.attribute !== ATTRIBUTES.FOREST && targetSlot.attribute !== ATTRIBUTES.JUNGLE) return false;
        if (draggedCard.bonus === BONUSES.MARINE && targetSlot.attribute !== ATTRIBUTES.RIVER && targetSlot.terrain !== TERRAINS.LAKE) return false;
      }
      return true;
    }
  }

  return false;
}

// Handle dropping items on board slots
function handleDropOnBoardSlot(targetIndex) {
  const targetSlot = state.board[targetIndex];
  
  if (!canDropOnBoardSlot(targetSlot, targetIndex)) return;

  // Scenario 1: Dragging active land from board to board (Combining / Merge)
  if (draggedSourceType === 'board') {
    openMergeDialog(draggedSourceIndex, targetIndex);
    return;
  }

  // Scenario 2: Placing new land card on empty slot
  if (!targetSlot.terrain && draggedCard.type === CARD_CATEGORIES.LAND) {
    const cost = 1;
    if (state.fire < cost) {
      state.addLog('残り火 🔥 が不足しているため、土地を配置できません！', 'warning');
      return;
    }
    if (state.fire < cost) {
      state.addLog('残り火 🔥 が不足しているため、土地を配置できません！', 'warning');
      return;
    }

    state.adjustResource('fire', -cost);
    
    // Set land parameters
    targetSlot.terrain = draggedCard.terrain;
    targetSlot.attribute = draggedCard.attribute || null;
    targetSlot.bonus = draggedCard.bonus || null;
    targetSlot.devLevel = getCardDevLevel(draggedCard);
    targetSlot.rarity = draggedCard.rarity || 'c';
    targetSlot.isNew = true;
    sound.playPlace();

    // Deduct/remove from source
    removeDraggedCardFromSource();
    
    // Calculate and immediately produce yield
    const landYield = state.calculateLandYield(targetSlot);
    state.adjustResource('food', landYield.food);
    state.adjustResource('materials', landYield.materials);
    state.adjustResource('defense', landYield.defense);
    state.adjustResource('mystic', landYield.mystic);

    state.addLog(`スロット ${targetIndex} に ${getTerrainDisplayName(draggedCard.terrain, draggedCard.attribute)} を配置しました (-${cost} 🔥)。配置時即時産出：🌾 +${landYield.food} / 🧱 +${landYield.materials} / 🛡️ +${landYield.defense} / ✨ +${landYield.mystic}`, 'action');
    triggerMergeFX(targetIndex);

    if (draggedCard.attribute === ATTRIBUTES.RIVER && state.riverExpedition.step === 0) {
      state.riverExpedition.step = 1;
      state.addLog('川を配置しました！「下流探索プロジェクト」が開始されました。', 'system');
    }

    endDrawPhase();
    updateUI();
    if (targetSlot.terrain === TERRAINS.LAKE) return; // Lake cannot merge
    const cardDevLevel = getCardDevLevel(draggedCard);
    if (targetSlot.devLevel !== cardDevLevel) {
      state.addLog('同じ開発段階（レアリティ）の土地同士でのみ開発（結合）が可能です！', 'warning');
      return;
    }
    // Generate dummy source index representing the card so that merge dialog works
    openDirectMergeFromCardDialog(draggedCard, targetIndex);
  }

  // Scenario 3.5: Overwriting existing land of different terrain
  else if (targetSlot.terrain && draggedCard.type === CARD_CATEGORIES.LAND && targetSlot.terrain !== draggedCard.terrain) {
    const cost = 1;
    if (state.fire < cost) {

  // Scenario 3.5: Overwriting existing land of different terrain
  else if (targetSlot.terrain && draggedCard.type === CARD_CATEGORIES.LAND && targetSlot.terrain !== draggedCard.terrain) {
    const cost = 1;
    if (state.fire < cost) {
      state.addLog('残り火 🔥 が不足しているため、土地を上書き配置できません！', 'warning');
      return;
    }
    
    const oldTerrain = targetSlot.terrain;
    const oldAttribute = targetSlot.attribute;
    state.adjustResource('fire', -cost);
    
    // Clear development level, attribute, bonus, and facility, but keep x and y coordinates!
    targetSlot.terrain = draggedCard.terrain;
    targetSlot.attribute = draggedCard.attribute || null;
    targetSlot.bonus = draggedCard.bonus || null;
    targetSlot.facility = null;
    targetSlot.devLevel = getCardDevLevel(draggedCard);
    targetSlot.rarity = draggedCard.rarity || 'c';
    targetSlot.isNew = true;
    sound.playPlace();
    
    removeDraggedCardFromSource();
    
    // Calculate and immediately produce yield
    const landYield = state.calculateLandYield(targetSlot);
    state.adjustResource('food', landYield.food);
    state.adjustResource('materials', landYield.materials);
    state.adjustResource('defense', landYield.defense);
    state.adjustResource('mystic', landYield.mystic);
    if (draggedCard.attribute === ATTRIBUTES.RIVER && state.riverExpedition.step === 0) {
      state.riverExpedition.step = 1;
      state.addLog('川を配置しました！「下流探索プロジェクト」が開始されました。', 'system');
    }
    
    triggerMergeFX(targetIndex);
    endDrawPhase();
    updateUI();
  }

  // Scenario 4: Attaching trait card to land
  else if (targetSlot.terrain && draggedCard.type === CARD_CATEGORIES.ATTRIBUTE) {
    const cost = 1;
    if (state.fire < cost) {
      state.addLog('残り火 🔥 が不足しているため、土地の資源調査を行えません！', 'warning');
      return;
    }

    state.adjustResource('fire', -cost);

    if (draggedCard.attribute) {
      targetSlot.attribute = draggedCard.attribute;
      state.addLog(`${getTerrainDisplayName(targetSlot.terrain, targetSlot.attribute)} を調査し、新たに環境特性「${getAttributeName(targetSlot.attribute)}」を発見しました！ (-${cost} 🔥)`, 'action');
    } else if (draggedCard.bonus) {
      targetSlot.bonus = draggedCard.bonus;
      state.addLog(`${getTerrainDisplayName(targetSlot.terrain, targetSlot.attribute)} を調査し、隠された資源「${getBonusName(targetSlot.bonus)}」を発見しました！ (-${cost} 🔥)`, 'action');
    }
    sound.playPlace();

    triggerMergeFX(targetIndex);
    removeDraggedCardFromSource();
    endDrawPhase();
    updateUI();
  }
}

// Handle dropping items on reserve slots
function handleDropOnReserveSlot(reserveIndex) {
  if (state.reserve[reserveIndex] !== null) return;

  // A. Reserving card from offerings
  if (draggedSourceType === 'offering') {
    state.reserve[reserveIndex] = { ...draggedCard };
    state.offerings = state.offerings.filter(c => c.instanceId !== draggedCard.instanceId);
    state.drawnThisTurn = true; // picking/reserves count as picking card for turn
    
    state.addLog(`カード「${draggedCard.name}」を保留スロット ${reserveIndex + 1} にキープしました。`, 'action');
    
    endDrawPhase();
    updateUI();
  }

  // B. Returning active land from board to reserve (de-activates land!)
  else if (draggedSourceType === 'board') {
    const land = state.board[draggedSourceIndex];
    if (land.terrain === TERRAINS.PALACE) return; // Palace cannot be returned

    // Create a base card version of the land
    const baseCard = {
      id: `land-${land.terrain}`,
      name: `${getTerrainDisplayName(land.terrain, land.attribute)}の開拓`,
      type: CARD_CATEGORIES.LAND,
      terrain: land.terrain,
      rarity: land.devLevel >= 3 ? 'l' : land.devLevel === 2 ? 'r' : land.devLevel === 1 ? 'uc' : 'c',
      desc: `手札に戻された開拓地。開発度: ★${land.devLevel}`
    };

    state.reserve[reserveIndex] = baseCard;
    
    // De-activate board slot
    land.terrain = null;
    land.attribute = null;
    land.bonus = null;
    land.devLevel = 0;
    land.disasterTurns = 0;
    land.damagedTurns = 0;
    land.overlayLevel = 0;
    land.isNew = false;
    land.x = null;
    land.y = null;

    state.addLog(`スロット ${draggedSourceIndex} の土地を保留スロット ${reserveIndex + 1} に戻しました。`, 'action');
    
    endDrawPhase();
    updateUI();
  }
}

// Click Fallback: Select a card from reserve slot
function selectReserveCard(card, idx) {
  selectedOffering = null;
  activeLandCardToPlace = null;
  activeAttachmentCard = null;
  
  draggedCard = card;
  draggedSourceType = 'reserve';
  draggedSourceIndex = idx;
  
  updateUI();
  
  if (card.type === CARD_CATEGORIES.LAND) {
    activeLandCardToPlace = card;
    el.interactionTitle.innerText = `配置フェイズ：盤面の空きスロット (+) を選択して配置してください (コスト: 1 🔥)`;
    highlightEmptySlots();
  } 
  else if (card.type === CARD_CATEGORIES.ATTRIBUTE) {
    activeAttachmentCard = card;
    el.interactionTitle.innerText = `資源調査フェイズ：調査・発見を行いたい土地を選択してください (コスト: 1 🔥)`;
    highlightApplicableSlots(card);
  }
}

// Click Fallback: Handle reserve slot clicks
function handleReserveSlotClick(idx) {
  // If slot is empty and we have a selected offering card, put it in reserve
  if (state.reserve[idx] === null && selectedOffering) {
    draggedCard = selectedOffering;
    draggedSourceType = 'offering';
    draggedSourceIndex = 0;
    selectedOffering = null;
    handleDropOnReserveSlot(idx);
  }
}

// Remove the dragged card from offerings or reserve
function removeDraggedCardFromSource() {
  if (draggedSourceType === 'offering') {
    state.offerings = state.offerings.filter(c => c.instanceId !== draggedCard.instanceId);
    state.drawnThisTurn = true;
  } else if (draggedSourceType === 'reserve') {
    state.reserve[draggedSourceIndex] = null;
  }
}

// Click Fallback: Handle board slot clicks
function handleBoardSlotClick(index) {
  const slot = state.board[index];

  // D. Click-based Facility Placement
  if (activeFacilityToPlace) {
    const slotEl = document.querySelector(`.board-slot.slot-${index}`);
    if (slotEl && slotEl.classList.contains('highlight-placement')) {
      const fac = activeFacilityToPlace;
      activeFacilityToPlace = null;
      
      state.adjustResource('materials', -fac.cost);
      state.adjustResource('fire', -fac.fireCost);
      slot.facility = fac.id;
      state.facilities[fac.id] = true; // compatibility
      
      state.addLog(`スロット ${index} (${getTerrainDisplayName(slot.terrain, slot.attribute)}) に「${getFacilityName(fac.id)}」を建設しました！ (-${fac.cost} 🧱, -${fac.fireCost} 🔥)`, 'reward');
      
      // Consume discount if active
      if (state.facilitiesDiscount > 0) {
        state.facilitiesDiscount = 0;
      }
      
      if (fac.id === 'watchtower') {
        updateTrialPreview(state);
        resolveTrialCountdown();
      }
      
      clearHighlights();
      updateUI();
    }
    return;
  }

  // A. Click-based placement
  if (activeLandCardToPlace) {
    if (index !== 0) {
      draggedCard = activeLandCardToPlace;
      activeLandCardToPlace = null;
      if (draggedSourceType !== 'reserve') {
        draggedSourceType = 'offering';
        draggedSourceIndex = 0;
      }
      handleDropOnBoardSlot(index);
    }
    return;
  }

  // B. Click-based attachment
  if (activeAttachmentCard) {
    const slotEl = document.querySelector(`.board-slot.slot-${index}`);
    if (slotEl && slotEl.classList.contains('highlight-attachment')) {
      draggedCard = activeAttachmentCard;
      activeAttachmentCard = null;
      if (draggedSourceType !== 'reserve') {
        draggedSourceType = 'offering';
        draggedSourceIndex = 0;
      }
      handleDropOnBoardSlot(index);
    }
    return;
  }

  // C. Click-based Merge
  if (slot.terrain && !slot.seaOccupied && index !== 0) {
    if (selectedMergeSlotAIndex === null) {
      selectedMergeSlotAIndex = index;
      highlightMergeCandidates(index);
      state.addLog(`結合候補 A: ${getTerrainDisplayName(slot.terrain, slot.attribute)} を選択。重ねたい土地を選択してください。`, 'system');
      updateUI();
    } else if (selectedMergeSlotAIndex === index) {
      selectedMergeSlotAIndex = null;
      clearHighlights();
      state.addLog('結合をキャンセルしました。', 'system');
      updateUI();
    } else {
      const candidateA = state.board[selectedMergeSlotAIndex];
      if (candidateA.terrain === slot.terrain && slot.terrain !== TERRAINS.LAKE && candidateA.devLevel === slot.devLevel) {
        openMergeDialog(selectedMergeSlotAIndex, index);
      } else {
        selectedMergeSlotAIndex = index;
        clearHighlights();
        highlightMergeCandidates(index);
        updateUI();
      }
    }
  }
}

function highlightMergeCandidates(slotAIndex) {
  clearHighlights();
  const landA = state.board[slotAIndex];
  document.querySelector(`.board-slot.slot-${slotAIndex}`).classList.add('highlight-merge-candidate');
  state.board.forEach((slot, index) => {
    if (slot && slot.terrain === landA.terrain && index !== slotAIndex && index !== 0 && slot.terrain !== TERRAINS.LAKE && slot.devLevel === landA.devLevel) {
      const slotEl = document.querySelector(`.board-slot.slot-${index}`);
      if (slotEl) slotEl.classList.add('highlight-attachment');
    }
  });
}

// Trigger Merge Modal (Combining 2 active lands on board)
function openMergeDialog(idxA, idxB) {
  const landA = state.board[idxA];
  const landB = state.board[idxB];
  const baseCost = state.role === ROLES.PIONEER ? 1 : 2;
  const mergeCost = state.activePolity === 'pioneer_democracy' ? Math.max(0, baseCost - 1) : baseCost;
  
  if (state.fire < mergeCost) {
    state.addLog(`残り火が不足しています！開発には ${mergeCost} 🔥 が必要です。`, 'warning');
    selectedMergeSlotAIndex = null;
    clearHighlights();
    updateUI();
    return;
  }

  document.getElementById('merge-source-a').innerHTML = `
    <h4>スロット ${idxA}</h4>
    <p>${getTerrainIcon(landA.terrain)} ${getTerrainDisplayName(landA.terrain, landA.attribute)}</p>
    <p>開発度: ★${landA.devLevel}</p>
  `;
  document.getElementById('merge-source-b').innerHTML = `
    <h4>スロット ${idxB}</h4>
    <p>${getTerrainIcon(landB.terrain)} ${getTerrainDisplayName(landB.terrain, landB.attribute)}</p>
    <p>開発度: ★${landB.devLevel}</p>
  `;

  // Collect all traits
  const traits = [];
  if (landA.attribute) traits.push({ type: 'attr', val: landA.attribute, source: 'A' });
  if (landA.bonus) traits.push({ type: 'bonus', val: landA.bonus, source: 'A' });
  if (landB.attribute) traits.push({ type: 'attr', val: landB.attribute, source: 'B' });
  if (landB.bonus) traits.push({ type: 'bonus', val: landB.bonus, source: 'B' });

  const optionsList = document.getElementById('merge-traits-options');
  optionsList.innerHTML = '';

  let selectedTraits = [];

  if (traits.length === 0) {
    optionsList.innerHTML = '<div class="empty-text">引き継ぐ特性はありません。</div>';
  } else {
    traits.forEach((t) => {
      const btn = document.createElement('button');
      const name = t.type === 'attr' ? getAttributeName(t.val) : getBonusName(t.val);
      btn.className = 'merge-trait-option';
      btn.innerText = `${name} (${t.source})`;
      
      btn.addEventListener('click', () => {
        if (btn.classList.contains('selected')) {
          btn.classList.remove('selected');
          selectedTraits = selectedTraits.filter(item => item !== t);
        } else {
          if (selectedTraits.length < 2) {
            btn.classList.add('selected');
            selectedTraits.push(t);
          } else {
            const firstBtn = Array.from(optionsList.querySelectorAll('.merge-trait-option.selected'))[0];
            if (firstBtn) firstBtn.classList.remove('selected');
            selectedTraits.shift();
            btn.classList.add('selected');
            selectedTraits.push(t);
          }
        }
        checkDuplicateMergeBonuses(selectedTraits);
        validateMergeConfirmBtn(selectedTraits, traits.length);
      });
      optionsList.appendChild(btn);
    });
  }

  if (traits.length <= 2) {
    selectedTraits = [...traits];
    optionsList.querySelectorAll('.merge-trait-option').forEach(btn => btn.classList.add('selected'));
  }
            btn.classList.add('selected');
            selectedTraits.push(t);
          }
        }
        checkDuplicateMergeBonuses(selectedTraits);
        validateMergeConfirmBtn(selectedTraits, traits);
      });
      optionsList.appendChild(btn);
    });
  }

  checkDuplicateMergeBonuses(selectedTraits);
  validateMergeConfirmBtn(selectedTraits, traits);

  el.btnConfirmMerge.innerText = `開発を実行 (${mergeCost} 🔥)`;

  el.btnConfirmMerge.onclick = () => {
    executeMerge(idxA, idxB, selectedTraits, mergeCost);
    closeMergeDialog();
  };
  el.btnCancelMerge.onclick = closeMergeDialog;
  el.modalMergeSelect.style.display = 'flex';
}

// Open Direct Merge Modal (Combine a land card directly onto an active board land)
function openDirectMergeFromCardDialog(card, targetIndex) {
  const landA = state.board[targetIndex];
  
  const baseCost = state.role === ROLES.PIONEER ? 1 : 2;
  const mergeCost = state.activePolity === 'pioneer_democracy' ? Math.max(0, baseCost - 1) : baseCost;
  
  if (state.fire < mergeCost) {
    state.addLog(`残り火が不足しています！開発には ${mergeCost} 🔥 が必要です。`, 'warning');
    clearHighlights();
    updateUI();
    return;
  }

  document.getElementById('merge-source-a').innerHTML = `
    <h4>スロット ${targetIndex}</h4>
    <p>${getTerrainIcon(landA.terrain)} ${getTerrainDisplayName(landA.terrain, landA.attribute)}</p>
    <p>開発度: ★${landA.devLevel}</p>
  `;
  document.getElementById('merge-source-b').innerHTML = `
    <h4>ドロー/手札カード</h4>
    <p>${getTerrainIcon(card.terrain)} ${card.name}</p>
    <p>開発度: ★0</p>
  `;

  // Collect all traits (card might have traits if drawn with UC river discovery)
  const traits = [];
  if (landA.attribute) traits.push({ type: 'attr', val: landA.attribute, source: '盤面' });
  if (landA.bonus) traits.push({ type: 'bonus', val: landA.bonus, source: '盤面' });
  if (card.attribute) traits.push({ type: 'attr', val: card.attribute, source: 'カード' });
  if (card.bonus) traits.push({ type: 'bonus', val: card.bonus, source: 'カード' });

  const optionsList = document.getElementById('merge-traits-options');
  optionsList.innerHTML = '';

  let selectedTraits = [];

  if (traits.length === 0) {
    optionsList.innerHTML = '<div class="empty-text">引き継ぐ特性はありません。</div>';
  } else {
    traits.forEach((t) => {
      const btn = document.createElement('button');
      const name = t.type === 'attr' ? getAttributeName(t.val) : getBonusName(t.val);
      btn.className = 'merge-trait-option';
      btn.innerText = `${name} (${t.source})`;
      
      btn.addEventListener('click', () => {
        if (btn.classList.contains('selected')) {
          btn.classList.remove('selected');
          selectedTraits = selectedTraits.filter(item => item !== t);
        } else {
          if (selectedTraits.length < 2) {
            btn.classList.add('selected');
            selectedTraits.push(t);
          } else {
            const firstBtn = Array.from(optionsList.querySelectorAll('.merge-trait-option.selected'))[0];
            if (firstBtn) firstBtn.classList.remove('selected');
            selectedTraits.shift();
            btn.classList.add('selected');
            selectedTraits.push(t);
          }
        }
        checkDuplicateMergeBonuses(selectedTraits);
        validateMergeConfirmBtn(selectedTraits, traits.length);
      });
      optionsList.appendChild(btn);
    });
  }

  if (traits.length <= 2) {
    selectedTraits = [...traits];
    optionsList.querySelectorAll('.merge-trait-option').forEach(btn => btn.classList.add('selected'));
  }

  checkDuplicateMergeBonuses(selectedTraits);
  validateMergeConfirmBtn(selectedTraits, traits.length);

  el.btnConfirmMerge.innerText = `直接開発を実行 (${mergeCost} 🔥)`;

  el.btnConfirmMerge.onclick = () => {
    // Deduct cost and execute upgrade on targetIndex, then clear card source
    state.adjustResource('fire', -mergeCost);
    landA.devLevel = Math.min(4, landA.devLevel + 1);
    updateLandRarity(landA);

    // Apply chosen traits
    const hasDupAttr = selectedTraits.length === 2 && 
  el.modalMergeSelect.style.display = 'none';
  selectedMergeSlotAIndex = null;
  clearHighlights();
  updateUI();
}

function executeMerge(idxA, idxB, selectedTraits, cost) {
  state.adjustResource('fire', -cost);
  
  selectedMergeSlotAIndex = null;
  clearHighlights();
  updateUI();
}

function executeMerge(idxA, idxB, selectedTraits, cost) {
  state.adjustResource('fire', -cost);
  
  const landA = state.board[idxA];
  const landB = state.board[idxB];
    // Calculate and immediately produce yield with the developed parameters
    const landYield = state.calculateLandYield(landA);
    state.adjustResource('food', landYield.food);
    state.adjustResource('materials', landYield.materials);
    state.adjustResource('defense', landYield.defense);
    state.adjustResource('mystic', landYield.mystic);

    state.addLog(`直接開発：カードからスロット ${targetIndex} の ${getTerrainDisplayName(landA.terrain, landA.attribute)} を直接開発（★ ${landA.devLevel}）しました。開発時即時産出：🌾 +${landYield.food} / 🧱 +${landYield.materials} / 🛡️ +${landYield.defense} / ✨ +${landYield.mystic}`, 'reward');
    triggerMergeFX(targetIndex);
    
    closeMergeDialog();
  };
  el.btnCancelMerge.onclick = closeMergeDialog;
  el.modalMergeSelect.style.display = 'flex';
}

function checkDuplicateMergeBonuses(selected) {
  const infoDiv = document.getElementById('merge-bonus-info');
  infoDiv.innerText = '';

  if (selected.length === 2 && selected[0].val === selected[1].val) {
    infoDiv.innerText = `✦ 重複ボーナス発生！ 「${selected[0].type === 'attr' ? getAttributeName(selected[0].val) : getBonusName(selected[0].val)}」の効果が大幅強化されます（効果1.5倍）！`;
  }
}

function validateMergeConfirmBtn(selected, totalTraits) {
  const maxCanSelect = Math.min(2, totalTraits);
  el.btnConfirmMerge.disabled = selected.length < maxCanSelect;
}

function closeMergeDialog() {
  el.modalMergeSelect.style.display = 'none';
  selectedMergeSlotAIndex = null;
  clearHighlights();
  updateUI();
}
  landB.facility = null;
  landB.devLevel = 0;
  landB.disasterTurns = 0;
  landB.damagedTurns = 0;
  landB.overlayLevel = 0;

  state.addLog(`土地開発：スロット ${idxA} と ${idxB} を結合し、開発度★ ${landA.devLevel} へ強化しました (-${cost} 🔥)。開発時即時産出：🌾 +${landYield.food} / 🧱 +${landYield.materials} / 🛡️ +${landYield.defense} / ✨ +${landYield.mystic}`, 'reward');
  triggerMergeFX(idxA);
  
  updateUI();
}

// Particle/Shockwave Merge FX Animation
function triggerMergeFX(slotIndex) {
  const slotEl = document.querySelector(`.board-slot.slot-${slotIndex}`);
  if (!slotEl) return;

  // 1. Shake/Bump animation
  slotEl.classList.add('merge-FX-shake');
  setTimeout(() => slotEl.classList.remove('merge-FX-shake'), 400);

  // 2. CSS Shockwave
  const shock = document.createElement('div');
  shock.className = 'merge-shockwave';
  slotEl.appendChild(shock);
  setTimeout(() => shock.remove(), 600);

  // 3. Spawning particles (sparks) shooting out
  const rect = slotEl.getBoundingClientRect();
  const centerX = rect.width / 2;
  
  if (card.type === CARD_CATEGORIES.MYSTIC) img = "lake.png";
  if (card.type === CARD_CATEGORIES.MILITARY) img = "mountains.png";
  if (card.type === CARD_CATEGORIES.CRISIS) img = "crisis.png";
});

// Resolve Immediate Event cards
function resolveImmediateEvent(card) {
  let title = card.name;
  let text = "";
  let img = "plains.png"; // default
  
  if (card.type === CARD_CATEGORIES.MYSTIC) img = "lake.png";
  if (card.type === CARD_CATEGORIES.MILITARY) img = "mountains.png";
    slotEl.appendChild(spark);
    setTimeout(() => spark.remove(), 800);
  }
}

// Mulligan
el.btnMulligan.addEventListener('click', () => {
  if (state.fire < 2) return;
  sound.playClick();
  state.adjustResource('fire', -2);
  state.addLog('マリガン：提示されたカードをすべて引き直しました (-2 🔥)。', 'action');
  triggerDrawOfferings();
  updateUI();
});

// Additional Draw
el.btnDrawExtra.addEventListener('click', () => {
  if (state.fire < 1) return;
  sound.playClick();
  state.adjustResource('fire', -1);
  state.additionalDrawsCount++;
  state.addLog(`追加ドロー：新たなカードの選択肢を生成しました (-1 🔥)。`, 'action');
  
  triggerDrawOfferings();
  state.drawnThisTurn = false;
  updateUI();
});

// Resolve Immediate Event cards
function resolveImmediateEvent(card) {
  let title = card.name;
  let text = "";
  let img = "plains.png"; // default
  
  if (card.type === CARD_CATEGORIES.MYSTIC) img = "lake.png";
  if (card.type === CARD_CATEGORIES.MILITARY) img = "mountains.png";
  if (card.type === CARD_CATEGORIES.CRISIS) img = "crisis.png";

  if (card.id === 'soc-harvest') {
    state.adjustResource('food', 40);
    text = "豊かな実りに感謝する大祭が執り行われました。民衆の笑顔が広がり、食料が 40 蓄積されます。(🌾 +40)";
  } 
  else if (card.id === 'soc-woodcutters') {
    state.adjustResource('materials', 40);
    text = "勇敢な杣人たちが森の奥深くから良質な木材を大量に持ち帰りました。資材が 40 蓄積されます。(🧱 +40)";
  } 
  else if (card.id === 'soc-inspection') {
    state.adjustResource('defense', 30);
    text = "集落を取り囲む防壁と見張り台の総点検が実施されました。防衛体制が 30 強化されます。(🛡️ +30)";
  } 
  else if (card.id === 'soc-immigrants') {
    if (state.food >= 15) {
      state.adjustResource('food', -15);
      state.adjustResource('materials', 40);
      text = "荒野から逃れてきた人々を同胞の労働者として受け入れました。彼らの熱心な労働により、資材が獲得されました。(🌾 -15, 🧱 +40)";
    } else {
      state.addLog('食料不足により労働力の受け入れに失敗しました（食料🌾が15必要でした）。', 'warning');
      text = "労働を希望する難民の集団がやってきましたが、食料が不足しているため受け入れることができませんでした...(食料が15必要でした)";
    }
  } 
  else if (card.id === 'soc-birth') {
    state.adjustResource('food', 25);
    state.adjustResource('materials', 25);
    text = "全員が団結し、集落を発展させるために新しい資源を開拓しました。食料と資材を獲得します。(🌾 +25, 🧱 +25)";
  } 
  else if (card.id === 'mys-revelation') {
    state.adjustResource('mystic', 25);
    text = "天より聖なる光の柱が降り注ぎ、神聖なる予言がもたらされました。神秘が 25 高まります。(✨ +25)";
    triggerMysticMiracleFX();
  } 
    
    spark.style.setProperty('--dx', `${dx}px`);
    spark.style.setProperty('--dy', `${dy}px`);
    
    spark.style.left = `${centerX}px`;
    spark.style.top = `${centerY}px`;
    
    slotEl.appendChild(spark);
    setTimeout(() => spark.remove(), 800);
  }
}

// Mulligan
el.btnMulligan.addEventListener('click', () => {
  if (state.fire < 2) return;
  sound.playClick();
  state.adjustResource('fire', -2);
  state.addLog('マリガン：提示されたカードをすべて引き直しました (-2 🔥)。', 'action');
  triggerDrawOfferings();
  updateUI();
});

// Additional Draw
el.btnDrawExtra.addEventListener('click', () => {
  if (state.fire < 1) return;
  sound.playClick();
  state.adjustResource('fire', -1);
  state.additionalDrawsCount++;
  state.addLog(`追加ドロー：新たなカードの選択肢を生成しました (-1 🔥)。`, 'action');
  
  triggerDrawOfferings();
  state.drawnThisTurn = false;
  updateUI();
});

// Resolve Immediate Event cards
function resolveImmediateEvent(card) {
  let title = card.name;
  let text = "";
  let img = "plains.png"; // default
  
  if (card.type === CARD_CATEGORIES.MYSTIC) img = "lake.png";
  if (card.type === CARD_CATEGORIES.MILITARY) img = "mountains.png";
  if (card.type === CARD_CATEGORIES.CRISIS) img = "crisis.png";

  if (card.id === 'soc-migration') {
    state.adjustResource('food', 30);
    state.adjustResource('fire', 3);
    text = "平野に集まった移民たちが残り火の周囲で結束しました。食料🌾+30、残り火🔥+3を獲得します。(🌾+30, 🔥+3)";
  } 
  else if (card.id === 'soc-trade') {
    let randVal = Math.random() < 0.5;
    if (randVal) {
      state.adjustResource('food', 35);
      text = "交易商人から大量の穀物と乾物を買い付けました。食料🌾+35、神秘✨+5を獲得。(🌾+35, ✨+5)";
    } else {
      state.adjustResource('materials', 30);
      text = "交易路から貴重な建築材や鉱石を調達しました。資材🧱+30、神秘✨+5を獲得。(🧱+30, ✨+5)";
    }
    state.adjustResource('mystic', 5);
  } 
  else if (card.id === 'soc-hero') {
    state.adjustResource('fire', 5);
    state.adjustResource('defense', 50);
    let milCardText = "保留ゾーンが満杯のため軍事カードを獲得できませんでした。";
    const emptyIdx = state.reserve.indexOf(null);
    if (emptyIdx !== -1) {
      const milPool = CARD_DATABASE[CARD_CATEGORIES.MILITARY];
      const freeCard = milPool[Math.floor(Math.random() * milPool.length)];
      state.reserve[emptyIdx] = { ...freeCard, instanceId: `${freeCard.id}-${Date.now()}` };
    let milCardText = "保留ゾーンが満杯のため軍事カードを獲得できませんでした。";
    const emptyIdx = state.reserve.indexOf(null);
    if (emptyIdx !== -1) {
      const milPool = CARD_DATABASE[CARD_CATEGORIES.MILITARY];
      const freeCard = milPool[Math.floor(Math.random() * milPool.length)];
      state.reserve[emptyIdx] = { ...freeCard, instanceId: `${freeCard.id}-${Date.now()}` };
      milCardText = `無料の軍事カード「${freeCard.name}」が保留スロット ${emptyIdx + 1} に追加されました！`;
    }
    text = `試練を防衛した英雄たちが熱狂と安全をもたらしました。残り火🔥+5、防衛力🛡️+50を獲得。さらに${milCardText} (🔥+5, 🛡️+50)`;
  } 
  else if (card.id === 'soc-plague') {
    state.adjustResource('food', -20);
    state.adjustResource('fire', -2);
    state.legacies.plague_experience = (state.legacies.plague_experience || 0) + 1;
    text = "過密な集落内で疫病の影が広がりました。食料🌾-20、残り火🔥-2の被害を受けますが、教訓として「衛生知識 (災害率半減)」レガシーを獲得します。(🌾-20, 🔥-2)";
  } 
  else if (card.id === 'soc-prophet') {
    state.adjustResource('mystic', 10);
    let mysCardText = "保留ゾーンが満杯のため神秘カードを獲得できませんでした。";
    const emptyIdx = state.reserve.indexOf(null);
    if (emptyIdx !== -1) {
  } 
  else if (card.id === 'soc-clearing') {
    state.adjustResource('food', 25);
    const eligibleSlots = state.board.filter((l, idx) => l && l.terrain && idx !== 0 && (l.terrain === TERRAINS.PLAINS || l.terrain === TERRAINS.HILLS));
    let devText = "対象となる土地がないため開発度は上昇しませんでした。";
    if (eligibleSlots.length > 0) {
      const targetSlot = eligibleSlots[Math.floor(Math.random() * eligibleSlots.length)];
      targetSlot.devLevel = Math.min(4, targetSlot.devLevel + 1);
      updateLandRarity(targetSlot);
      devText = `さらに、${getTerrainDisplayName(targetSlot.terrain, targetSlot.attribute)} の開発レベルが ★${targetSlot.devLevel} に上昇しました！`;
    }
    text = `開拓者主導の開墾祭により、食料🌾+25を獲得。${devText} (🌾+25)`;
  } 
  else if (card.id === 'soc-ghost') {
    state.adjustResource('mystic', 20);
    state.adjustResource('fire', -2);
    text = "砂漠に眠る古代の遺跡から亜人の記憶が漏れ出し、民衆を惑わせました。残り火🔥-2のペナルティを受ける代わりに、神秘✨+20を獲得。(✨+20, 🔥-2)";
  } 
  else if (card.id === 'soc-bonds') {
    state.adjustResource('fire', 6);
    state.adjustResource('food', 15);
    text = "残り火が消えかける極限状態の中で、人々が互いに食料を分け合い結束を高めました。残り火🔥+6、食料🌾+15を獲得！(🔥+6, 🌾+15)";
  } 
  else if (card.id === 'soc-artisans') {
    state.adjustResource('materials', 30);
    state.facilitiesDiscount = 20;
    text = "腕利きの職人たちが目覚め、技術を共有しました。資材🧱+30を獲得し、さらに次の施設建設の資材コストが 🧱-20 割引されます。(🧱+30, 施設割引獲得)";
  } 
  else if (card.id === 'soc-feast') {
    state.adjustResource('food', -50);
    state.adjustResource('fire', 10);
    state.adjustResource('defense', 100);
    text = "50ターンの結末を見据え、人々が最後の希望を胸に大いなる宴を開きました。食料を50消費し、残り火🔥+10、防衛力🛡️+100を獲得！(🌾-50, 🔥+10, 🛡️+100)";
  } 
  else if (card.id === 'mys-revelation') {
    state.adjustResource('mystic', 25);
    text = "天より聖なる光の柱が降り注ぎ、神聖なる予言がもたらされました。神秘が 25 高まります。(✨ +25)";
    triggerMysticMiracleFX();
  } 
  else if (card.id === 'mys-shrine') {
    state.adjustResource('materials', -20);
    state.adjustResource('mystic', 40);
    text = "精霊を祀る厳かな石碑の祭壇が建立されました。精霊の守護により、神秘が 40 向上します。(🧱 -20, ✨ +40)";
    triggerMysticMiracleFX();
  } 
  else if (card.id === 'mys-blessing') {
    state.adjustResource('mystic', 30);
    state.legacies.spirit_blessing = 3;
    text = "森の精霊たちの温かい加護が集落全体を包み込みました。3ターンの間、集落の活動が祝福されます。(✨ +30, 祝福レガシー獲得)";
    triggerMysticMiracleFX();
  } 
  else if (card.id === 'mil-scouts') {
    state.adjustResource('defense', 20);
    state.upcomingTrial.basePower = Math.max(10, state.upcomingTrial.basePower - 30);
    text = "熟練の斥候が敵軍の野営地を奇襲し、偵察データを持ち帰りました。次の試練の敵戦力が 30 低下します。(🛡️ +20, 敵戦力 -30)";
  } 
  else if (card.id === 'mil-recruits') {
    state.adjustResource('food', -15);
    state.adjustResource('defense', 40);
    text = "若者たちが志願し、防衛義勇軍の訓練が開始されました。防衛力が 40 向上します。(🌾 -15, 🛡️ +40)";
      const btn = document.createElement('button');
      btn.className = 'btn-activate-polity';
      btn.innerText = state.polityCooldown > 0 ? `制限中 (${state.polityCooldown}T)` : `有効化する (🔥 ${displayCost})`;
      btn.disabled = state.polityCooldown > 0 || state.fire < displayCost;
      
      btn.addEventListener('click', () => {
        state.adjustResource('fire', -displayCost);
        state.activePolity = key;
        state.polityCooldown = 5;
        state.addLog(`政体を「${data.name}」に変更しました (-${displayCost} 🔥)。`, 'action');
        el.modalPolitySelect.style.display = 'none';
        updateUI();
      });
      card.appendChild(btn);
    }
    
    el.polityOptionsList.appendChild(card);
  });
}
    <button class="event-option-btn" id="btn-mir-high-opt2">
      <span>地殻の急成長（任意の土地1スロットを、即座に最大開発段階「レジェンダリ★4」へ昇格する）</span>
    </button>
  `;

  document.getElementById('btn-mir-high-opt1').onclick = () => {
    state.upcomingTrial.basePower = Math.round(state.upcomingTrial.basePower * 0.7);
    state.addLog('奇跡発動：次の試練の敵戦闘力を 30% 減弱しました！', 'reward');
    el.modalGenericEvent.style.display = 'none';
    updateUI();
  };

  document.getElementById('btn-mir-high-opt2').onclick = () => {
    el.modalGenericEvent.style.display = 'none';
    state.addLog('奇跡発動：最大開発する土地を盤面からクリックしてください。', 'system');
    
    const upgradeListener = (e) => {
      const slotIdx = parseInt(e.currentTarget.dataset.slotIndex);
      const land = state.board[slotIdx];
      if (land && land.terrain && !land.seaOccupied && slotIdx !== 0) {
        land.devLevel = 4;
        state.addLog(`奇跡適用：${getTerrainDisplayName(land.terrain)} を最大開発段階（L★4）に昇格しました！`, 'reward');
        triggerMergeFX(slotIdx);
        
        document.querySelectorAll('.board-slot').forEach(slot => {
          slot.classList.remove('highlight-attachment');
          slot.onclick = null;
        });
        updateUI();
      }
  optionsDiv.innerHTML = `
    <button class="event-option-btn" id="btn-close-generic-event">
      受け入れる
    </button>
  `;
  
  document.getElementById('btn-close-generic-event').onclick = () => {
    modal.style.display = 'none';
    if (onClose) onClose();
  };
}

// Resolve Disaster Event
function resolveDisasterEvent(disasterId, onClose) {
  sound.playDisaster();
  const result = executeDisaster(state, disasterId);
  if (result) {
    showGrandEventModal(`災厄発生: ${result.name}`, result.desc, 'crisis.png', () => {
      updateUI();
      if (onClose) onClose();
    });
  } else {
    if (onClose) onClose();
  }
}

// River expedition events
function checkRiverExpeditionEvents() {
  const hasRiver = state.board.some(l => l && l.attribute === ATTRIBUTES.RIVER);
  if (!hasRiver || state.riverExpedition.unlockedSea) return;

  const step = state.riverExpedition.step;
  if (step === 1 && state.currentTurn >= 20) {
    triggerRiverExpeditionModal(2);
  } else if (step === 2 && state.currentTurn >= 28) {
    triggerRiverExpeditionModal(3);
    el.modalRiverEvent.querySelector('#river-event-title').innerText = '🌊 世界の果て：海の発見！';
    el.modalRiverEvent.querySelector('#river-event-text').innerHTML = `
      探索隊は川を下り、無限に広がる水平線――**「海」**に到達しました！<br>
      超強力なレジェンダリー地形「海 (Sea)」がデッキに解禁されます！(スロットを2つ消費します)
    `;
      state.addLog(`奇跡発動：社会制度「${lockedPol}」が天啓により即時解禁されました！`, 'reward');
    } else {
      state.addLog('奇跡発動：すべての制度が解禁済みなため、資材 +100 を獲得しました。', 'reward');
      state.adjustResource('materials', 100);
    }
    el.modalGenericEvent.style.display = 'none';
    updateUI();
  };
};

el.btnMiracleHigh.onclick = () => {
  let discount = state.role === ROLES.PROPHET ? 0.8 : 1.0;
  if (state.activePolity === 'theocracy') discount *= 0.9;
  const cost = Math.round(150 * discount);
  state.adjustResource('mystic', -cost);

  el.modalGenericEvent.style.display = 'flex';
  document.getElementById('generic-event-icon').innerText = '🔥';
  document.getElementById('generic-event-title').innerText = '神秘の奇跡（上級）';
  document.getElementById('generic-event-text').innerText = '世界の残り火と一体となり、運命を改変する奇跡を引き起こします。';

  const container = document.getElementById('generic-event-options');
  container.innerHTML = `
    <button class="event-option-btn" id="btn-mir-high-opt1">
      <span>神罰の雷（次の試練の敵戦闘力を -30% 永久低下させる）</span>
    </button>
    <button class="event-option-btn" id="btn-mir-high-opt2">
      <span>地殻の急成長（任意の土地1スロットを、即座に最大開発段階「レジェンダリ★4」へ昇格する）</span>
    </button>
  `;

  document.getElementById('btn-mir-high-opt1').onclick = () => {
    state.upcomingTrial.basePower = Math.round(state.upcomingTrial.basePower * 0.7);
    state.addLog('奇跡発動：次の試練の敵戦闘力を 30% 減弱しました！', 'reward');
    el.modalGenericEvent.style.display = 'none';
    updateUI();
  };

  document.getElementById('btn-mir-high-opt2').onclick = () => {
    el.modalGenericEvent.style.display = 'none';
    state.addLog('奇跡発動：最大開発する土地を盤面からクリックしてください。', 'system');
    
    const upgradeListener = (e) => {
      const slotIdx = parseInt(e.currentTarget.dataset.slotIndex);
      const land = state.board[slotIdx];
      if (land && land.terrain && !land.seaOccupied && slotIdx !== 0) {
        land.devLevel = 4;
        state.addLog(`奇跡適用：${getTerrainDisplayName(land.terrain)} を最大開発段階（L★4）に昇格しました！`, 'reward');
        triggerMergeFX(slotIdx);
        
        document.querySelectorAll('.board-slot').forEach(slot => {
          slot.classList.remove('highlight-attachment');
          slot.onclick = null;
        });
        updateUI();
    };

    state.board.forEach((slot, idx) => {
      if (slot && slot.terrain && !slot.seaOccupied && idx !== 0) {
        const slotEl = document.querySelector(`.board-slot.slot-${idx}`);
        slotEl.classList.add('highlight-attachment');
        slotEl.onclick = upgradeListener;
      }
    });
  };
};

// Open and Close Social Tree Modal
el.btnOpenSocial.addEventListener('click', () => {
  el.modalSocialTree.style.display = 'flex';
  renderPolicyTree(state, unlockPolicy);
});
el.btnCloseSocial.addEventListener('click', () => {
  el.modalSocialTree.style.display = 'none';
});

// Open and Close Polity Modal
el.btnOpenPolity.addEventListener('click', () => {
  el.modalPolitySelect.style.display = 'flex';
  renderPolitySelect();
      });
      card.appendChild(btn);
    }
    
    el.polityOptionsList.appendChild(card);
  });
}

function unlockPolicy(policyId, cost) {
  state.adjustResource('materials', -cost);
  state.policies[policyId] = true;
  state.addLog(`社会制度「${policyId}」を解禁しました (-${cost} 🧱)。`, 'reward');

  // Unlock corresponding polity if applicable
  if (policyId === 'tactics') {
    state.polities.autocracy = true;
    state.addLog('新たな政体「専制君主制」が選択可能になりました！', 'system');
  } else if (policyId === 'mysticism') {
    state.polities.theocracy = true;
    state.addLog('新たな政体「神聖君主制」が選択可能になりました！', 'system');
  } else if (policyId === 'agriculture') {
    state.polities.pioneer_democracy = true;
    state.addLog('新たな政体「開拓民主制」が選択可能になりました！', 'system');
  }

  renderPolicyTree(state, unlockPolicy);
  updateUI();
}

  updateUI();
}

// End Turn Execution
el.btnEndTurn.addEventListener('click', () => {
  if (!state.drawnThisTurn) {
    state.addLog('警告：カードを選択してターンを開始してください！', 'warning');
    return;
  }

  // 1. Collect Total Production
  const yields = state.calculateTotalProduction();
  state.adjustResource('food', yields.food);
  state.adjustResource('materials', yields.materials);
  state.adjustResource('defense', yields.defense);
  state.adjustResource('mystic', yields.mystic);

  state.addLog(`第 ${state.currentTurn} ターン終了。生産物回収：🌾 +${yields.food} / 🧱 +${yields.materials} / 🛡️ +${yields.defense} / ✨ +${yields.mystic}`, 'action');

  // 2. Base Fire Decay and Food Modifier
  let fireDecay = 1;
  let foodCorrectionText = "";
  
  if (state.food >= 240) {
    fireDecay = -1; // Gain 1 🔥!
    foodCorrectionText = " (大豊作による活力補正: +1 🔥)";
  } else if (state.food >= 120) {
    fireDecay = 0; // No loss
    foodCorrectionText = " (十分な食料による維持補正: 0 🔥)";
  } else if (state.food < 30) {
    state.addLog('奇跡発動：次の試練の敵戦闘力を 30% 減弱しました！', 'reward');
    el.modalGenericEvent.style.display = 'none';
    updateUI();
  };

  document.getElementById('btn-mir-high-opt2').onclick = () => {
    el.modalGenericEvent.style.display = 'none';
    state.addLog('奇跡発動：最大開発する土地を盤面からクリックしてください。', 'system');
    
    const upgradeListener = (e) => {
      const slotIdx = parseInt(e.currentTarget.dataset.slotIndex);
      const land = state.board[slotIdx];
      if (land && land.terrain && !land.seaOccupied && slotIdx !== 0) {
        land.devLevel = 4;
        state.addLog(`奇跡適用：${getTerrainDisplayName(land.terrain, land.attribute)} を最大開発段階（L★4）に昇格しました！`, 'reward');
        triggerMergeFX(slotIdx);
        
        document.querySelectorAll('.board-slot').forEach(slot => {
          slot.classList.remove('highlight-attachment');
          slot.onclick = null;
  document.getElementById('btn-mir-high-opt1').onclick = () => {
    state.upcomingTrial.basePower = Math.round(state.upcomingTrial.basePower * 0.7);
    state.addLog('奇跡発動：次の試練の敵戦闘力を 30% 減弱しました！', 'reward');
    el.modalGenericEvent.style.display = 'none';
    updateUI();
  };

  document.getElementById('btn-mir-high-opt2').onclick = () => {
    el.modalGenericEvent.style.display = 'none';
    state.addLog('奇跡発動：最大開発する土地を盤面からクリックしてください。', 'system');
    
    const upgradeListener = (e) => {
      const slotIdx = parseInt(e.currentTarget.dataset.slotIndex);
      const land = state.board[slotIdx];
      if (land && land.terrain && !land.seaOccupied && slotIdx !== 0) {
        land.devLevel = 4;
        state.addLog(`奇跡適用：${getTerrainDisplayName(land.terrain, land.attribute)} を最大開発段階（L★4）に昇格しました！`, 'reward');
        triggerMergeFX(slotIdx);
        
        document.querySelectorAll('.board-slot').forEach(slot => {
          slot.classList.remove('highlight-attachment');

  // Update state.defense so that log output uses the current correct value
  state.defense = yields.defense + state.accumulatedDefense;

    resolveTrialCountdown();
  }
  updateUI();
}

// End Turn Execution
el.btnEndTurn.addEventListener('click', () => {
  if (!state.drawnThisTurn) {
    state.addLog('警告：カードを選択してターンを開始してください！', 'warning');
    return;
    
    el.polityOptionsList.appendChild(card);
  });
}

function unlockPolicy(policyId, cost) {
  state.adjustResource('materials', -cost);
  state.policies[policyId] = true;
  state.addLog(`社会制度「${policyId}」を解禁しました (-${cost} 🧱)。`, 'reward');

  checkPolityUnlocks(policyId);

  renderPolicyTree(state, unlockPolicy);
  updateUI();
}

// Build Facilities
function buildFacility(facilityId, cost) {
  state.adjustResource('materials', -cost);
  state.facilities[facilityId] = true;
  state.addLog(`施設「${facilityId}」を建設しました (-${cost} 🧱)。`, 'reward');
  
  if (facilityId === 'watchtower') {
    updateTrialPreview(state);
    resolveTrialCountdown();
  }
  state.adjustResource('food', yields.food);
  state.adjustResource('materials', yields.materials);
  state.adjustResource('mystic', yields.mystic);

  // Update state.defense so that log output uses the current correct value
  state.defense = yields.defense + state.accumulatedDefense;

  state.addLog(`第 ${state.currentTurn} ターン終了。生産物回収：🌾 +${yields.food} / 🧱 +${yields.materials} / ✨ +${yields.mystic} (総防衛力: 🛡️ ${state.defense})`, 'action');

  // 2. Base Fire Decay and Food Modifier
  let fireDecay = 1;
  let foodCorrectionText = "";
  
  if (state.food >= 240) {
    fireDecay = -1; // Gain 1 🔥!
    foodCorrectionText = " (大豊作による活力補正: +1 🔥)";
  } else if (state.food >= 120) {
    fireDecay = 0; // No loss
    foodCorrectionText = " (十分な食料による維持補正: 0 🔥)";
          slot.onclick = null;
        });
        updateUI();
      }
    };

    state.board.forEach((slot, idx) => {
      if (slot && slot.terrain && !slot.seaOccupied && idx !== 0) {
        const slotEl = document.querySelector(`.board-slot.slot-${idx}`);
        slotEl.classList.add('highlight-attachment');
        slotEl.onclick = upgradeListener;
      }
    });
  };
};

// Open and Close Social Tree Modal
el.btnOpenSocial.addEventListener('click', () => {
  el.modalSocialTree.style.display = 'flex';
  renderPolicyTree(state, unlockPolicy);
});
el.btnCloseSocial.addEventListener('click', () => {
  el.modalSocialTree.style.display = 'none';
});

// Open and Close Polity Modal
el.btnOpenPolity.addEventListener('click', () => {
  el.modalPolitySelect.style.display = 'flex';
  renderPolitySelect();
});
el.btnClosePolity.addEventListener('click', () => {
  el.modalPolitySelect.style.display = 'none';
});

const POLITIES_DATA = {
  tribal_accord: {
    name: '共同体の融和',
    icon: '🤝',
    desc: 'ベース土地カード (🧭) の出現ウェイトが +15% 上昇します。',
    cost: 0,
    rarity: 'c',
    req: '初期状態'
  },
  autocracy: {
    name: '専制君主制',
    icon: '⚔️',
    desc: '試練戦闘時、防衛力 (🛡️) +20%。ただし毎ターンの資材 (🧱) 産出 -15%。',
    cost: 1,
    rarity: 'c',
    req: '社会制度「戦術（tactics）」解禁で開放'
  },
  theocracy: {
    name: '神聖君主制',
    icon: '✨',
    desc: '毎ターン神秘 (✨) +5。神秘の奇跡コストが -10% 低減されます。',
    cost: 1,
    rarity: 'c',
    req: '社会制度「神秘（mysticism）」解禁で開放'
  },
  pioneer_democracy: {
    name: '開拓民主制',
    icon: '🧭',
    desc: '土地のニコイチ開発コストが -1 🔥 低減される。ただし毎ターンの食料 (🌾) 産出 -15%。',
    cost: 2,
    rarity: 'r',
    req: '社会制度「農業（agriculture）」解禁で開放'
  }
};

function renderPolitySelect() {
  const activeKey = state.activePolity;
  const activeData = POLITIES_DATA[activeKey];
  
  // 1. Render active status
  el.currentPolityStatusCard.innerHTML = `
    <h3 style="font-size: 0.9rem; color: #f97316; margin-bottom: 4px;">現在のアクティブ政体: ${activeData.icon} ${activeData.name}</h3>
    <p style="font-size: 0.72rem; color: #d1d5db; margin-bottom: 8px;">${activeData.desc}</p>
    <div style="font-size: 0.7rem; font-weight: 800; color: ${state.polityCooldown > 0 ? '#f87171' : '#34d399'};">
      切り替え制限: ${state.polityCooldown > 0 ? `あと ${state.polityCooldown} ターン変更不可` : '変更可能'}
    </div>
  `;

  // 2. Render options list
  el.polityOptionsList.innerHTML = '';
  Object.entries(POLITIES_DATA).forEach(([key, data]) => {
    const card = document.createElement('div');
    const isUnlocked = state.polities[key];
    const isActive = activeKey === key;
    
    card.className = `polity-option-card ${isActive ? 'active' : ''} ${!isUnlocked ? 'locked' : ''}`;
    
    // Switch cost formula:
    // If switching to tribal_accord or if switching from tribal_accord, cost is activation cost.
    // If switching from custom to custom, cost is 3.
    let displayCost = data.cost;
    if (!isActive && isUnlocked) {
      if (activeKey !== 'tribal_accord' && key !== 'tribal_accord') {
        displayCost = 3; // Switch cost
      }
    }

  if (targetIndex === -1) {
    state.addLog('土地の最大上限数(7枚)に達しています！これ以上配置できません。', 'warning');
    clearHighlights();
    updateUI();
    return;
  }

  const cost = 1;
  if (state.fire < cost) {
    state.addLog('残り火 🔥 が不足しているため、土地を配置できません！', 'warning');
    clearHighlights();
    updateUI();
    return;
  }

  state.adjustResource('fire', -cost);
  
  const targetSlot = state.board[targetIndex];
  targetSlot.terrain = card.terrain;
  targetSlot.attribute = card.attribute || null;
  targetSlot.bonus = card.bonus || null;
  targetSlot.devLevel = 0;
  targetSlot.isNew = true;
  targetSlot.x = x;
        state.policies[lockedPol] = true;
        state.addLog(`試練報酬：天啓により社会制度「${lockedPol}」を獲得しました！`, 'reward');
        checkPolityUnlocks(lockedPol);
      }
    } else if (reward === 'rare_card') {
      const rCards = [];
      Object.values(CARD_DATABASE).forEach(cat => {
        cat.forEach(c => {
          if (c.rarity === 'r') rCards.push(c);
        });
      });
      const chosenCard = rCards[Math.floor(Math.random() * rCards.length)];
      state.offerings = [{ ...chosenCard, instanceId: `${chosenCard.id}-${Date.now()}` }];
      state.drawnThisTurn = false;
      renderOfferings();
      state.addLog(`試練報酬：レアカード「${chosenCard.name}」の天啓を受けました！`, 'reward');
    } else if (reward === 'legacy') {
      const legacies = ['general_triumph', 'prophet_insight', 'pioneer_adaptation'];
      const chosenLegacy = legacies[Math.floor(Math.random() * legacies.length)];
      state.legacies[chosenLegacy] = (state.legacies[chosenLegacy] || 0) + 1;
      state.addLog(`試練報酬：新たなレガシー「${chosenLegacy}」を獲得しました！`, 'reward');
    }
  });
}

// Game Victory Condition









    clearHighlights();
    updateUI();
    return;
  }

  state.adjustResource('fire', -cost);
  
  const targetSlot = state.board[targetIndex];
  targetSlot.terrain = card.terrain;
  targetSlot.attribute = card.attribute || null;
  `;
}

// Game Over check
function checkGameOver() {
  if (state.fire <= 0) {
    el.modalGameEnd.style.display = 'flex';
    el.gameEndTitle.innerText = 'GAME OVER';
    el.gameEndTitle.className = 'game-end-title';
    el.gameEndDesc.innerText = '残り火が完全に消え去り、集落は凍える闇の中に飲み込まれました。あなたの旅はここで終わります...';
    
    const turnScore = state.currentTurn * 100;
    const totalScore = turnScore;

    el.scoreBreakdown.innerHTML = `
      <div class="score-row"><span>残り火:</span> <span class="text-danger">0 (消滅)</span></div>
      <div class="score-row"><span>生存ターン (T ${state.currentTurn} x 100):</span> <span>+${turnScore}</span></div>
      <div class="score-row total"><span>最終スコア:</span> <span>${totalScore}</span></div>
    `;
  }
}

  // Find first empty slot (index 1 to 7)
  let targetIndex = -1;
  for (let i = 1; i <= 7; i++) {
        slotEl.classList.remove('highlight-placement');
      }
    }
  });
}

// End Turn Execution
el.btnEndTurn.addEventListener('click', () => {
  if (!state.drawnThisTurn) {
    state.addLog('警告：カードを選択してターンを開始してください！', 'warning');
    return;
  }

  sound.playTurnEnd();

  // 1. Collect Total Production
  const yields = state.calculateTotalProduction();
  state.adjustResource('food', yields.food);
  state.adjustResource('materials', yields.materials);
  state.adjustResource('mystic', yields.mystic);

  // Update state.defense so that log output uses the current correct value
  state.defense = yields.defense + state.accumulatedDefense;

  state.addLog(`第 ${state.currentTurn} ターン終了。生産物回収：🌾 +${yields.food} / 🧱 +${yields.materials} / ✨ +${yields.mystic} (総防衛力: 🛡️ ${state.defense})`, 'action');

  if (originalFood < foodMaintenance) {
    // Starvation state: food was insufficient to pay maintenance
    fireDecay = 2; 
    foodCorrectionText = ` (深刻な食料不足による残り火の衰退: -2 🔥 / 消費コスト ${foodMaintenance} に対して残高 ${originalFood} 🌾)`;
  } else if (state.food >= 500) {
    fireDecay = -1; // Gain 1 🔥!
    foodCorrectionText = " (大豊作による残り火の自動増加: +1 🔥)";
  } else if (state.food >= 200) {
    fireDecay = 0; // No loss
    foodCorrectionText = " (十分な食料蓄積による残り火維持: 0 🔥)";
  } else {
    fireDecay = 1; // Normal loss
    foodCorrectionText = " (食料不足による残り火減衰: -1 🔥)";
  }

  state.adjustResource('fire', -fireDecay);
  if (fireDecay > 0) {
    state.addLog(`残り火減衰：残り火が ${fireDecay} 🔥 減少しました。${foodCorrectionText}`, 'warning');
  } else if (fireDecay === 0) {
    state.addLog(`残り火維持：残り火は減少せず維持されました。${foodCorrectionText}`, 'system');
  } else {
    state.addLog(`残り火増幅：活力が満ち、残り火が ${Math.abs(fireDecay)} 🔥 増加しました！${foodCorrectionText}`, 'reward');
  }

  state.adjustResource('fire', -fireDecay);
  if (fireDecay > 0) {
    state.addLog(`残り火減衰：残り火が ${fireDecay} 🔥 減少しました。${foodCorrectionText}`, 'warning');
  } else if (fireDecay === 0) {
    state.addLog(`残り火維持：残り火は減少せず維持されました。${foodCorrectionText}`, 'system');
  } else {
    state.addLog(`残り火増幅：活力が満ち、残り火が ${Math.abs(fireDecay)} 🔥 増加しました！${foodCorrectionText}`, 'reward');
  }

  // Check trial state triggers
  if (state.currentTurn === state.upcomingTrial.turn) {
    runTrialPhase();
    return;
  }

  // Clear isNew flag for all lands so they start generating yields in next turns
  state.board.forEach(land => {
    if (land) land.isNew = false;
  });

  // Increment Turn
  state.currentTurn++;
  state.turnsSinceLastTrial++;

  // Decrement Polity Cooldown
  if (state.polityCooldown > 0) {
    state.polityCooldown--;
  }

  // Game Clear at Turn 51
  if (state.currentTurn > 50) {
    runGameVictoryPhase();
    return;
  }

  // Next Turn
    // Choose 2 rewards
    el.trialRewardsZone.style.display = 'block';
    el.trialLossActions.style.display = 'none';

    state.lastTrialVictory = true;
    state.turnsSinceLastTrial = 0;
    
    let chosenRewards = [];
    document.querySelectorAll('.reward-option-card').forEach(card => {
      card.classList.remove('selected');
      card.onclick = () => {
        const reward = card.dataset.reward;
        if (card.classList.contains('selected')) {
          card.classList.remove('selected');
          chosenRewards = chosenRewards.filter(r => r !== reward);
        } else {
          if (chosenRewards.length < 2) {
            card.classList.add('selected');
            chosenRewards.push(reward);
          } else {
            const firstCard = Array.from(document.querySelectorAll('.reward-option-card.selected'))[0];
            if (firstCard) firstCard.classList.remove('selected');
            chosenRewards.shift();
            
            card.classList.add('selected');
            chosenRewards.push(reward);
          }
        }
        el.btnConfirmRewards.disabled = chosenRewards.length < 2;
      };
    });

    el.btnConfirmRewards.disabled = true;
    el.btnConfirmRewards.onclick = () => {
      applyTrialRewards(chosenRewards);
      el.modalTrialResult.style.display = 'none';
      
      // Clear isNew and proceed
      state.board.forEach(land => { if (land) land.isNew = false; });
      state.currentTurn++;
      state.turnsSinceLastTrial++;
      startTurn();
    };
  } else {
    el.trialResultBadge.innerText = 'FAILED';
    el.trialResultBadge.className = 'result-badge loss';
    el.trialResultTitle.innerText = `第 ${trialResult.trialIndex} の試練で防衛線が崩壊しました`;
    el.trialResultDesc.innerText = `亜人軍勢の略奪により、戦場となった一部の領土が荒廃（生産半減）しました。しかし、民は屈せず、不屈の精神を高めています。(防衛力: ${trialResult.playerDefense} vs 敵勢力: ${trialResult.enemyPower})`;

    state.lastTrialVictory = false;
    state.turnsSinceLastTrial = 0;

    el.trialRewardsZone.style.display = 'none';
    el.trialLossActions.style.display = 'block';

    el.btnCloseTrialLoss.onclick = () => {
      el.modalTrialResult.style.display = 'none';
      
      // Clear isNew and proceed
      state.board.forEach(land => { if (land) land.isNew = false; });
      state.currentTurn++;
      startTurn();
    };
  }
}

function applyTrialRewards(rewards) {
  rewards.forEach(reward => {
    if (reward === 'max_fire') {
      state.adjustResource('maxFire', 1);
      state.adjustResource('fire', 1);
      state.addLog('試練報酬：残り火の最大値が 1 🔥 上昇しました！', 'reward');
    } else if (reward === 'policy') {
      const policiesList = ['agriculture', 'forestry', 'masonry', 'mysticism', 'tactics'];
      const lockedPol = policiesList.find(p => !state.policies[p]);
  }

  if (targetIndex === -1) {
    state.addLog('土地の最大上限数(7枚)に達しています！これ以上配置できません。', 'warning');
    clearHighlights();
    updateUI();
    return;
  }

  const cost = 1;
  if (state.fire < cost) {
    state.addLog('残り火 🔥 が不足しているため、土地を配置できません！', 'warning');
    clearHighlights();
    updateUI();
    return;
  }

  state.adjustResource('fire', -cost);
  
  const targetSlot = state.board[targetIndex];
  targetSlot.terrain = card.terrain;
  targetSlot.attribute = card.attribute || null;
  targetSlot.bonus = card.bonus || null;
  targetSlot.devLevel = getCardDevLevel(card);
  targetSlot.rarity = card.rarity || 'c';
  targetSlot.isNew = true;
  targetSlot.x = x;
  targetSlot.y = y;
  sound.playPlace();

  removeDraggedCardFromSource();
  
  // Calculate and immediately produce yield
  const landYield = state.calculateLandYield(targetSlot);
  state.adjustResource('food', landYield.food);
  // Clear isNew flags after rendering
  state.board.forEach(slot => {
    if (slot) slot.isNew = false;
  });

  // Update SVG connections in real-time
  updateConnectionsSVG();

  // Update slots count val
  endDrawPhase();
  updateUI();
}

function updateConnectionsSVG() {
  const svg = document.getElementById('connections-svg');
  if (!svg) return;
  svg.innerHTML = '';

  state.board.forEach((slot, index) => {
    if (index === 0) return; // Skip Palace itself
    if (slot && slot.terrain) {
      // Draw smooth ComfyUI-style bezier curve from Palace (50, 50) to land node (slot.x, slot.y)
      const x1 = 50;
      const y1 = 50;
      const x2 = slot.x;
      const y2 = slot.y;

      // Calculate control points for a beautiful horizontal/vertical S-curve
      const cx1 = x1 + (x2 - x1) * 0.4;

    el.scoreBreakdown.innerHTML = `
      <div class="score-row"><span>残り火:</span> <span class="text-danger">0 (消滅)</span></div>
      <div class="score-row"><span>生存ターン (T ${state.currentTurn} x 100):</span> <span>+${turnScore}</span></div>
      <div class="score-row total"><span>最終スコア:</span> <span>${totalScore}</span></div>
    `;
  }
}

function handlePlaceLandAtCoords(card, x, y) {
  // Find first empty slot (index 1 to 7)
  let targetIndex = -1;
  for (let i = 1; i <= 7; i++) {
    if (!state.board[i].terrain) {
      targetIndex = i;
      break;
    }
  }

  if (targetIndex === -1) {
    state.addLog('土地の最大上限数(7枚)に達しています！これ以上配置できません。', 'warning');
    clearHighlights();
    updateUI();
    return;
  }

  const cost = 1;
  if (state.fire < cost) {
    state.addLog('残り火 🔥 が不足しているため、土地を配置できません！', 'warning');
    clearHighlights();
    updateUI();
    return;
  }

  state.adjustResource('fire', -cost);
  
  const targetSlot = state.board[targetIndex];
  targetSlot.terrain = card.terrain;
  targetSlot.attribute = card.attribute || null;
  targetSlot.bonus = card.bonus || null;
  targetSlot.devLevel = getCardDevLevel(card);
  targetSlot.rarity = card.rarity || 'c';
  targetSlot.isNew = true;
  targetSlot.x = x;
  targetSlot.y = y;
  sound.playPlace();

  removeDraggedCardFromSource();
  
  // Calculate and immediately produce yield
  const landYield = state.calculateLandYield(targetSlot);
  state.adjustResource('food', landYield.food);
  state.adjustResource('materials', landYield.materials);
  state.adjustResource('defense', landYield.defense);
  state.adjustResource('mystic', landYield.mystic);

  el.valDefense.innerText = state.defense;
  el.valMystic.innerText = state.mystic;

  // Check Game Over
  checkGameOver();

  // 2. Sidebar logs
  el.logConsole.innerHTML = '';
  state.logs.forEach(log => {
    const entry = document.createElement('div');
    entry.className = `log-entry ${log.type}`;
    entry.innerText = `[T${log.turn}] ${log.message}`;
    el.logConsole.appendChild(entry);
  });
    entry.className = `log-entry ${log.type}`;
    entry.innerText = `[T${log.turn}] ${log.message}`;
    el.logConsole.appendChild(entry);
  });

  // 3. Render board slots (only if slot.terrain is set)
  el.landGrid.innerHTML = '';
  state.board.forEach((slot, index) => {
    if (!slot || !slot.terrain) return;
    
    const slotEl = renderBoardSlot(slot, index, state);
    
    // Palace slot 0 cannot be dragged, but can be a drop target for battlefields
    // Outer slots are drop targets for merges and attributes
    slotEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (canDropOnBoardSlot(slot, index)) {
        slotEl.classList.add('drag-over');
      }
    });

    slotEl.addEventListener('dragleave', () => {
      slotEl.classList.remove('drag-over');
    });

    slotEl.addEventListener('drop', (e) => {
      e.preventDefault();
      slotEl.classList.remove('drag-over');
      handleDropOnBoardSlot(index);
    });
      path.setAttribute('d', `M ${x1}% ${y1}% C ${cx1}% ${cy1}%, ${cx2}% ${cy2}%, ${x2}% ${y2}%`);
      path.setAttribute('stroke', 'rgba(249, 115, 22, 0.45)');
      path.setAttribute('stroke-width', '3');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-dasharray', '6,4');
      path.setAttribute('class', 'connection-line');
      
      // If the land is affected by disaster, make the line red and broken!
      if (slot.disasterTurns > 0 || slot.damagedTurns > 0) {
        path.setAttribute('stroke', 'rgba(239, 68, 68, 0.6)');
        path.setAttribute('stroke-width', '2');
      }
      
      svg.appendChild(path);
    }
  });
}

// Update Trial Countdowns and previews in Sidebar
function resolveTrialCountdown() {
  const turnsToTrial = state.upcomingTrial.turn - state.currentTurn;
  
  if (turnsToTrial <= 0) {
    el.trialCountdown.innerText = '警告: 試練襲来中！';
  } else {
    el.trialCountdown.innerText = `試練まで ${turnsToTrial} ターン`;
  }

  if (state.upcomingTrial.previewed) {
    el.trialDetails.innerHTML = `
      <strong>試練の強さ:</strong> ${state.upcomingTrial.basePower} 戦力<br>
  el.currentTurn.innerText = state.currentTurn;
  el.valFire.innerText = state.fire;
  el.valMaxFire.innerText = state.maxFire;
  el.valFood.innerText = state.food;
  el.valMaterials.innerText = state.materials;
  el.valDefense.innerText = state.defense;
  el.valMystic.innerText = state.mystic;

  // Check Game Over
  checkGameOver();

  // 2. Sidebar logs
  el.logConsole.innerHTML = '';
  state.logs.forEach(log => {
    const entry = document.createElement('div');
    entry.className = `log-entry ${log.type}`;
    entry.innerText = `[T${log.turn}] ${log.message}`;
    el.logConsole.appendChild(entry);
  });

  // 3. Render board slots (only if slot has coordinates or terrain)
  el.landGrid.innerHTML = '';
  state.board.forEach((slot, index) => {
    if (!slot || (!slot.terrain && (slot.x === null || slot.y === null))) return;
    
    const slotEl = renderBoardSlot(slot, index, state);
    
    // Palace slot 0 cannot be dragged, but can be a drop target for battlefields
    // Outer slots are drop targets for merges and attributes
    slotEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (canDropOnBoardSlot(slot, index)) {
        slotEl.classList.add('drag-over');
      }
    });

    slotEl.addEventListener('dragleave', () => {
      slotEl.classList.remove('drag-over');
    });

    slotEl.addEventListener('drop', (e) => {
      e.preventDefault();
      slotEl.classList.remove('drag-over');
      handleDropOnBoardSlot(index);
    });

    // Make slot draggable if it has terrain and is NOT Palace
    if (slot.terrain && slot.terrain !== TERRAINS.PALACE && !slot.seaOccupied) {
      const tileWrapper = slotEl.querySelector('.board-card');
      if (tileWrapper) {

















































    
    const yields = state.calculateTotalProduction();
    breakdown = `現在の当ターン防衛力: <b>🛡️ ${state.defense}</b><br>` +
                `毎ターン自動で得られる生産量: <b>🛡️ +${yields.defense}</b><br><br>` +
                `<b>生産内訳:</b><br>` +
                getResourceBreakdownList('defense');
  }
  else if (key === 'mystic') {
    title = "✨ 神秘 (Mystic)";
    desc = "精霊との交信や奇跡の発動に必要な信仰力。一定値まで貯めることで、いつでも「神秘の奇跡」ボタンから強力なグローバル奇跡（予知、豊穣、神罰など）を発動できます。";
      div.className = 'disaster-badge';
      div.innerHTML = `<span>⚠ ${getTerrainDisplayName(land.terrain, land.attribute)}の荒廃</span> <span class="d-turns">${turnsRemaining - 1}T</span>`;
      el.disastersList.appendChild(div);
    });
  }

  // 6. Facilities Builder
  renderFacilities(state, buildFacility);

  // 7. Mystic Miracle Buttons
  checkMiracleAvailability();

  // 8. River expedition progress
  if (state.riverExpedition.step > 0) {
    el.riverExpeditionPanel.style.display = 'block';
    const step = state.riverExpedition.step;
    document.getElementById('exp-step-1').className = `exp-dot ${step >= 1 ? 'success' : ''}`;
    document.getElementById('exp-step-2').className = `exp-dot ${step >= 2 ? 'success' : ''}`;
    document.getElementById('exp-step-3').className = `exp-dot ${step >= 3 ? 'success' : ''}`;
  } else {
    el.riverExpeditionPanel.style.display = 'none';
  }

  // 9. Render Reserve slots
  renderReserveSlots();

  // 10. Update Right Sidebar production display
  const totals = state.calculateTotalProduction();
  document.getElementById('total-food-bonus').innerText = `+${totals.food}`;
  document.getElementById('total-materials-bonus').innerText = `+${totals.materials}`;
  document.getElementById('total-defense-bonus').innerText = `+${totals.defense}`;
  document.getElementById('total-mystic-bonus').innerText = `+${totals.mystic}`;
}

// Renders the 3 reserve slot contents inside bottom bar
function renderReserveSlots() {
  document.querySelectorAll('.reserve-slot').forEach(slot => {
    const idx = parseInt(slot.dataset.reserveIndex);
    const card = state.reserve[idx];
    slot.innerHTML = '';
  if (affectedLands.length === 0) {
    el.disastersList.innerHTML = '<div class="empty-text">災害なし</div>';
  } else {
    affectedLands.forEach(land => {
      const turnsRemaining = Math.max(land.disasterTurns, land.damagedTurns);
      const div = document.createElement('div');
      div.className = 'disaster-badge';
      div.innerHTML = `<span>⚠ ${getTerrainDisplayName(land.terrain, land.attribute)}の荒廃</span> <span class="d-turns">${turnsRemaining - 1}T</span>`;
      el.disastersList.appendChild(div);
    });
  }

  // 6. Facilities Builder
  renderFacilities(state, buildFacility);

  // 7. Mystic Miracle Buttons
  checkMiracleAvailability();

  // 8. River expedition progress
  if (state.riverExpedition.step > 0) {
    el.riverExpeditionPanel.style.display = 'block';
    const step = state.riverExpedition.step;
    document.getElementById('exp-step-1').className = `exp-dot ${step >= 1 ? 'success' : ''}`;
    document.getElementById('exp-step-2').className = `exp-dot ${step >= 2 ? 'success' : ''}`;
    document.getElementById('exp-step-3').className = `exp-dot ${step >= 3 ? 'success' : ''}`;
  } else {
    el.riverExpeditionPanel.style.display = 'none';
  }

  // 9. Render Reserve slots
  renderReserveSlots();

  // 10. Update Right Sidebar production display
  const totals = state.calculateTotalProduction();
  document.getElementById('total-food-bonus').innerText = `+${totals.food}`;
  document.getElementById('total-materials-bonus').innerText = `+${totals.materials}`;
  document.getElementById('total-defense-bonus').innerText = `+${totals.defense}`;
  document.getElementById('total-mystic-bonus').innerText = `+${totals.mystic}`;
}

// Renders the 3 reserve slot contents inside bottom bar
function renderReserveSlots() {
  document.querySelectorAll('.reserve-slot').forEach(slot => {
    const idx = parseInt(slot.dataset.reserveIndex);
    const card = state.reserve[idx];
    slot.innerHTML = '';

function checkPolityUnlocks(policyId) {
  if (policyId === 'tactics') {
    state.polities.autocracy = true;
    state.addLog('新たな政体「専制君主制」が選択可能になりました！', 'system');
  } else if (policyId === 'mysticism') {
    state.polities.theocracy = true;
    state.addLog('新たな政体「神聖君主制」が選択可能になりました！', 'system');
  } else if (policyId === 'agriculture') {
    state.polities.pioneer_democracy = true;
    state.addLog('新たな政体「開拓民主制」が選択可能になりました！', 'system');
  }
}








































































  let title = "";
  let desc = "";
  let breakdown = "";

  if (key === 'fire') {
    title = "🔥 残り火 (Fire)";
    desc = "集落の生命活動を維持するための残り火。毎ターン終了時に一定量減少し、0 になるとゲームオーバーになります。<br><br>" +
           "・最大上限: 30 🔥<br>" +
           "・基本減衰: -1 🔥/ターン (保留エリアにカードが残っている場合、さらに -1 🔥 のペナルティがあります)。<br>" +
           "・食料🌾備蓄補正:<br>" +
           "  - 🌾 240 以上: +1 🔥 (残り火が増加します)<br>" +
           "  - 🌾 120 以上: 0 🔥 (残り火は減少しません)<br>" +
           "  - 🌾 30 未満: -2 🔥 (深刻な食料不足による急激な減衰)";
    
    let decay = 1;
    const reserveOccupied = state.reserve.filter(c => c !== null).length > 0;
    const reservePenalty = reserveOccupied ? 1 : 0;
    
    let foodBonus = 0;
    if (state.food >= 240) foodBonus = 1;
    else if (state.food >= 120) foodBonus = 0;
    else if (state.food < 30) foodBonus = -2;
    else foodBonus = -1;

    const netChange = foodBonus - reservePenalty;
    const sign = netChange >= 0 ? "+" : "";

    breakdown = `現在の残り火: <b>${state.fire} / ${state.maxFire} 🔥</b><br><br>` +
                `<b>毎ターン終了時の変化見込み: ${sign}${netChange} 🔥</b><br>` +
                `・食料備蓄補正: ${foodBonus >= 0 ? "+" : ""}${foodBonus} 🔥 (備蓄: 🌾${state.food})<br>` +
                `・保留ペナルティ: -${reservePenalty} 🔥 (保留カード数: ${state.reserve.filter(c => c !== null).length}枚)<br><br>` +
                `<span style="color: #f87171; font-size: 0.72rem;">※不要なカードを「残り火へ還元」スロットに捨てることで、いつでも +1 🔥 を得ることができます。</span>`;
  }
  else if (key === 'food') {
    title = "🌾 食料 (Food)";
    desc = "集落の生存維持に必要な食料。蓄積量が多いほど残り火の減衰を抑えたり、回復させたりすることができます。(240以上で+1🔥, 120以上で減少なし, 30未満で-2🔥)";
    
    const yields = state.calculateTotalProduction();
    breakdown = `現在の備蓄量: <b>🌾 ${state.food}</b><br>` +
                `現在の毎ターン総生産量: <b>🌾 +${yields.food}</b><br><br>` +
                `<b>生産内訳:</b><br>` +
                getResourceBreakdownList('food');
  }
  else if (key === 'materials') {
    title = "🧱 資材 (Materials)";
    desc = "施設の建設や社会制度のアンロック、土地の結合（レベルアップ）などに消費される重要な資材資源です。";
    
    const yields = state.calculateTotalProduction();
    breakdown = `現在の備蓄量: <b>🧱 ${state.materials}</b><br>` +
                `現在の毎ターン総生産量: <b>🧱 +${yields.materials}</b><br><br>` +
                `<b>生産内訳:</b><br>` +
                getResourceBreakdownList('materials');
  }
  else if (key === 'defense') {
    title = "🛡️ 防衛力 (Defense)";
    desc = "試練（襲来する脅威）から集落を守るための戦闘力。<b>防衛力は蓄積されず、毎ターン開始時に 0 にリセットされます。</b><br><br>" +
           "各ターン終了時に土地や施設から生産される防衛力と、そのターン中に使用した軍事カードの効果の合計値が、そのターンの「総防衛力」となり、試練襲来時の防御判定に使用されます。";
    
    const yields = state.calculateTotalProduction();
    breakdown = `現在の当ターン防衛力: <b>🛡️ ${state.defense}</b><br>` +
                `毎ターン自動で得られる生産量: <b>🛡️ +${yields.defense}</b><br><br>` +
                `<b>生産内訳:</b><br>` +
                getResourceBreakdownList('defense');
  }
  else if (key === 'mystic') {
    title = "✨ 神秘 (Mystic)";
    desc = "精霊との交信や奇跡の発動に必要な信仰力。一定値まで貯めることで、いつでも「神秘の奇跡」ボタンから強力なグローバル奇跡（予知、豊穣、神罰など）を発動できます。";
    
    const yields = state.calculateTotalProduction();
    breakdown = `現在の備蓄量: <b>✨ ${state.mystic}</b><br>` +
                `現在の毎ターン総生産量: <b>✨ +${yields.mystic}</b><br><br>` +
                `<b>生産内訳:</b><br>` +
                getResourceBreakdownList('mystic');
  }

  titleEl.innerHTML = title;
  descEl.innerHTML = desc;
  breakdownEl.innerHTML = breakdown;
}

function getResourceBreakdownList(resourceKey) {
  let listHtml = "";
  state.board.forEach((slot, index) => {
    if (!slot || !slot.terrain) return;
    const landYield = state.calculateLandYield(slot);
    const val = landYield[resourceKey];
    if (val > 0) {
      const terrainName = index === 0 ? state.getPalaceName() : getTerrainDisplayName(slot.terrain, slot.attribute);
      listHtml += `・スロット ${index} (${terrainName}): +${val}<br>`;
    }
  });

  if (resourceKey === 'defense') {
    if (state.legacies.hardship_experience) {
      listHtml += `・レガシー「不屈の精神」: +50<br>`;
    }
    if (state.legacies.general_triumph) {
      listHtml += `・レガシー「将軍の凱旋」: +30<br>`;
    }
  }

  return listHtml || "・生産源なし (毎ターンの生産はありません)<br>";
}

function triggerMysticMiracleFX() {
  const overlay = document.createElement('div');
  overlay.className = 'mystic-overlay-fx';
  
  const circle = document.createElement('div');
  circle.className = 'mystic-magic-circle';
  overlay.appendChild(circle);
  
  for (let i = 0; i < 25; i++) {
    const particle = document.createElement('div');
    particle.className = 'mystic-particle';
    particle.style.left = `${40 + Math.random() * 20}%`;
    particle.style.top = `${60 + Math.random() * 20}%`;
    particle.style.width = `${4 + Math.random() * 8}px`;
    particle.style.height = particle.style.width;
    particle.style.animationDelay = `${Math.random() * 0.8}s`;

  function applyTransform() {
    wrapper.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomFactor})`;
  }

  // Wheel Zoom
  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomSpeed = 0.08;
    if (e.deltaY < 0) {
      zoomFactor = Math.min(zoomFactor + zoomSpeed, 2.5); // Max zoom 250%
    } else {
      zoomFactor = Math.max(zoomFactor - zoomSpeed, 0.4); // Min zoom 40%
    }
    applyTransform();
  }, { passive: false });

  // Mouse Drag to Pan
  container.addEventListener('mousedown', (e) => {
    // Only pan if clicking empty space or the SVG background
    if (e.target === container || e.target.id === 'connections-svg' || e.target.id === 'land-grid') {
      isPanning = true;
      container.style.cursor = 'grabbing';
      startX = e.clientX - panX;
      startY = e.clientY - panY;
    }
  });

  container.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    applyTransform();
  });

  window.addEventListener('mouseup', () => {
    if (isPanning) {
      isPanning = false;
      container.style.cursor = 'default';
    }
  });
});
