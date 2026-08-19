const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Read main_hybrid.js
let code = fs.readFileSync('game/src/main_hybrid.js', 'utf8');

// Helper to replace block between two line prefixes safely
function replaceRange(startPrefix, endPrefix, replacement) {
  const startIdx = code.indexOf(startPrefix);
  if (startIdx === -1) {
    console.error(`Failed to locate start prefix:\n${startPrefix}`);
    process.exit(1);
  }
  const endIdx = code.indexOf(endPrefix, startIdx + startPrefix.length);
  if (endIdx === -1) {
    console.error(`Failed to locate end prefix:\n${endPrefix}`);
    process.exit(1);
  }
  code = code.slice(0, startIdx) + replacement + code.slice(endIdx);
  console.log(`Replaced range successfully!`);
}

// A. Replace imports
replaceRange(
  "import { selectTrialBattlefields, calculateBattlefieldDefense, calculateTotalDefense, resolveTrialCombat, executeRaidPenalty, getTrialSettings, executeDisaster, updateTrialPreview } from './trials.js';",
  "// Global Game State",
  "import { selectTrialBattlefields, calculateBattlefieldDefense, calculateTotalDefense, resolveTrialCombat, getTrialSettings, updateTrialPreview, PLAYER_TACTICS, resolveRaidCombat } from './trials.js';\nimport { renderCard, renderBoardSlot, renderFacilities, renderPolicyTree, getTerrainIcon, getFacilityName, getFacilityEmoji, getTerrainDisplayName, getAttributeName, getBonusName } from './components.js?v=2';\nimport { sound } from './sound.js';\n\n"
);

replaceRange(
  "const state = new GameState();",
  "// Setup Sound Log interceptor",
  `const state = new GameState();
window.state = state;
window.updateUI = updateUI;
`
);

// Add global selectedOfferingSource and selectedOfferingIndex variables and endDrawPhase helper
replaceRange(
  "let selectedOffering = null;",
  "let activeAttachmentCard = null;",
  `let selectedOffering = null;
let selectedOfferingSource = null;
let selectedOfferingIndex = null;

function endDrawPhase() {
  state.drawnThisTurn = true;
}
`
);

// Map palace menu buttons correctly to premium layout element IDs
replaceRange(
  "btnOpenSocial: document.getElementById('btn-open-social'),",
  "btnEndTurn: document.getElementById('btn-end-turn'),",
  `btnOpenSocial: document.getElementById('btn-palace-open-social'),
`
);

replaceRange(
  "btnOpenPolity: document.getElementById('btn-open-polity'),",
  "modalPolitySelect: document.getElementById('modal-polity-select'),",
  `btnOpenPolity: document.getElementById('btn-palace-open-polity'),
  btnOpenFacilities: document.getElementById('btn-palace-open-facilities'),
`
);

// B. Replace getCardDevLevel
replaceRange(
  "function getCardDevLevel(card) {",
  "function updateLandRarity(land) {",
  `function getCardDevLevel(card) {
  return 0;
}

`
);

// C. Replace selectRole down to startTurn
replaceRange(
  "function selectRole(role) {",
  "function startTurn() {",
  `function selectRole(role) {
  state.role = role;
  el.modalRoleSelect.style.display = 'none';
  
  // Re-initialize Palace details according to role name
  const palace = state.board[0];
  palace.name = state.getPalaceName();

  el.activeRoleDisplay.innerText = state.getPalaceName();
  el.activeRoleDisplay.className = \`role-badge \${role}\`;

  // Apply starting bonuses
  if (role === ROLES.GENERAL) {
    state.adjustResource('defense', 30);
    state.addLog('将軍：本拠地を「司令部」に変更。防衛力+30で開始！', 'system');
  } else if (role === ROLES.PROPHET) {
    state.adjustResource('mystic', 15);
    state.addLog('預言者：本拠地を「聖堂」に変更。神秘産出+30%で開始！', 'system');
  } else if (role === ROLES.PIONEER) {
    state.adjustResource('materials', 30);
    state.addLog('開拓者：本拠地を「開拓基地」に変更。資材+30、開発費-1🔥で開始！', 'system');
  }

  // Pre-schedule first trial (turn 15)
  resolveTrialCountdown();
  
  // Start Turn 1
  startTurn();
  initGlobalDragAndDropListeners();
}

`
);

// D. Replace startTurn down to triggerDrawOfferings
replaceRange(
  "function startTurn() {",
  "// Trigger card offerings draw",
  `function startTurn() {
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
        state.addLog(\`土地 (\${getTerrainDisplayName(land.terrain, land.attribute)}) の災害被害が復興しました！生産力が元に戻ります。\`, 'system');
      }
    }
    if (land && land.damagedTurns > 0) {
      land.damagedTurns--;
      if (land.damagedTurns === 0) {
        state.addLog(\`被災地 (\${getTerrainDisplayName(land.terrain, land.attribute)}) が復興しました！生産力に「戦場の記憶」Lv.\${land.overlayLevel} バフが乗ります！\`, 'system');
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
    state.addLog(\`警告：保留ゾーンにカードが残っているため、残り火が 1 🔥 減少しました。\`, 'warning');
  }

  // 3. Increment Turn Draw Offerings
  triggerDrawOfferings();

  // 4. Update trial alerts
  updateTrialPreview(state);
  resolveTrialCountdown();

  // 5. Trigger downstream river search if applicable
  checkRiverExpeditionEvents();

  // Raid Trigger check
  let raidTriggered = false;
  state.turnsSinceLastRaid = state.turnsSinceLastRaid || 0;
  state.turnsSinceLastRaid++;
  if (checkRaidTrigger()) {
    const activeLandSlots = [];
    state.board.forEach((land, idx) => {
      if (idx > 0 && land && land.terrain) {
        activeLandSlots.push(idx);
      }
    });
    if (activeLandSlots.length > 0) {
      const targetSlot = activeLandSlots[Math.floor(Math.random() * activeLandSlots.length)];
      triggerRaidEvent(targetSlot);
      raidTriggered = true;
    }
  }

  // 6. Check if a trial is scheduled for the END of this turn!
  if (!raidTriggered && state.currentTurn === state.upcomingTrial.turn) {
    showTrialApproachingModal();
  }

  updateUI();
}

function checkRaidTrigger() {
  const turnsToTrial = state.upcomingTrial ? (state.upcomingTrial.turn - state.currentTurn) : 99;
  const turnsSinceTrial = state.turnsSinceLastTrial || 0;
  
  if (turnsToTrial <= 3 || turnsSinceTrial <= 3) {
    return false;
  }
  
  if (state.turnsSinceLastRaid !== undefined && state.turnsSinceLastRaid < 6) {
    return false;
  }
  
  const landCount = state.board.filter(l => l && l.terrain).length;
  const prob = (landCount - 2) * 0.05;
  return Math.random() < prob;
}

function triggerRaidEvent(targetSlot) {
  const land = state.board[targetSlot];
  const modal = document.getElementById('modal-raid-event');
  modal.style.display = 'flex';
  
  const textEl = document.getElementById('raid-event-text');
  textEl.innerHTML = \`
    <strong>⚠️ 警告：亜人集団の急襲！</strong><br>
    スロット \${targetSlot} の開拓地（\${getTerrainDisplayName(land.terrain, land.attribute)}）が略奪のターゲットに指定されました！<br>
    敵の襲撃に対抗するため、戦術を選択して防衛を行ってください。
  \`;

  const actionsEl = document.getElementById('raid-event-actions');
  actionsEl.innerHTML = '';

  PLAYER_TACTICS.forEach(t => {
    if (t.canUse(land, targetSlot)) {
      const btn = document.createElement('button');
      btn.className = 'action-btn primary full-width';
      btn.style.textAlign = 'left';
      btn.style.padding = '8px 12px';
      btn.innerHTML = \`🛡️ <strong>\${t.name}</strong><br><span style="font-size: 0.65rem; opacity: 0.85;">\${t.desc}</span>\`;
      btn.onclick = () => {
        const result = resolveRaidCombat(state, targetSlot, t.id);
        modal.style.display = 'none';
        state.turnsSinceLastRaid = 0;
        showGrandEventModal(
          result.success ? '✨ 撃退成功！' : '💥 略奪被災',
          result.logs.join('<br>'),
          result.success ? 'scenic_plains.png' : 'scenic_crisis.png',
          () => { updateUI(); }
        );
      };
      actionsEl.appendChild(btn);
    }
  });

  const btnNone = document.createElement('button');
  btnNone.className = 'action-btn secondary full-width';
  btnNone.style.textAlign = 'left';
  btnNone.style.padding = '8px 12px';
  btnNone.innerHTML = \`❌ <strong>戦術なし (防衛施設と地形のみ)</strong><br><span style="font-size: 0.65rem; opacity: 0.85;">何の戦術も取らずに、防衛力のみで耐えます。</span>\`;
  btnNone.onclick = () => {
    const result = resolveRaidCombat(state, targetSlot, null);
    modal.style.display = 'none';
    state.turnsSinceLastRaid = 0;
    showGrandEventModal(
      result.success ? '✨ 撃退成功！' : '💥 略奪被災',
      result.logs.join('<br>'),
      result.success ? 'scenic_plains.png' : 'scenic_crisis.png',
      () => { updateUI(); }
    );
  };
  actionsEl.appendChild(btnNone);
}

`
);

// E. Replace triggerDrawOfferings down to function initGlobalDragAndDropListeners
replaceRange(
  "// Trigger card offerings draw",
  "function initGlobalDragAndDropListeners() {",
  `function triggerDrawOfferings() {
  state.queuedDisasters = [];
  state.offerings = drawThreeOfferings(state);
  renderOfferings();
  el.interactionTitle.innerText = \`※ドローエリア (カードを盤面にドラッグするか、保留スロットにドロップできます)\`;
  
  if (el.btnMulligan) el.btnMulligan.disabled = state.fire < 2;
  if (el.btnDrawExtra) el.btnDrawExtra.disabled = state.fire < 1;
}

function renderOfferings() {
  el.cardOfferingsZone.innerHTML = '';
  state.offerings.forEach((card, index) => {
    if (card) {
      const cardEl = renderCard(card);
      if (state.drawnThisTurn) {
        cardEl.setAttribute('draggable', 'false');
        cardEl.style.opacity = '0.4';
        cardEl.style.pointerEvents = 'none';
      } else {
        cardEl.setAttribute('draggable', 'true');
      }
      
      cardEl.addEventListener('dragstart', (e) => {
        draggedCard = card;
        draggedSourceType = 'offering';
        draggedSourceIndex = index;
        cardEl.classList.add('dragging');
        document.body.classList.add('dragging-active');
        
        clearHighlights();
        if (card.type === CARD_CATEGORIES.LAND) {
          highlightEmptySlots();
        } else if (card.type === CARD_CATEGORIES.ATTRIBUTE) {
          highlightApplicableSlots(card);
        }
      });
      
      cardEl.addEventListener('dragend', () => {
        cardEl.classList.remove('dragging');
        document.body.classList.remove('dragging-active');
        clearHighlights();
      });
      
      // Mouseover details tooltip
      cardEl.addEventListener('mouseenter', (e) => {
        showCardTooltip(e, card);
      });
      cardEl.addEventListener('mousemove', (e) => {
        updateTooltipPosition(e);
      });
      cardEl.addEventListener('mouseleave', () => {
        hideTooltip();
      });

      // Left-click actions popover menu
      cardEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.drawnThisTurn) return; // Action locked if already drawn/explored
        sound.playClick();
        
        const options = [];
        if (card.type === CARD_CATEGORIES.LAND) {
          options.push({
            label: '🧭 盤面に配置する',
            action: () => {
              selectedOffering = card;
              selectedOfferingSource = 'offering';
              selectedOfferingIndex = index;
              clearHighlights();
              highlightEmptySlots();
              updateUI();
            }
          });
          const canMergeWithBoard = state.board.some((s, idx) => idx !== 0 && s && s.terrain === card.terrain && s.devLevel === 0);
          options.push({
            label: '👥 既存の土地と結合する',
            disabled: !canMergeWithBoard,
            action: () => {
              selectedOffering = card;
              selectedOfferingSource = 'offering';
              selectedOfferingIndex = index;
              clearHighlights();
              state.board.forEach((s, idx) => {
                if (idx !== 0 && s && s.terrain === card.terrain && s.devLevel === 0) {
                  const slotEl = document.querySelector(\`.board-slot.slot-\${idx}\`);
                  if (slotEl) slotEl.classList.add('highlight-placement');
                }
              });
              el.interactionTitle.innerText = \`土地結合：手札の「\${card.name}」と結合させたい、盤面の同じ地形の土地（★0）を選択してください\`;
              updateUI();
            }
          });
          const hasEmptyReserve = state.reserve.includes(null);
          options.push({
            label: '📥 保留スロットへ送る',
            disabled: !hasEmptyReserve,
            action: () => {
              reserveCardFromOffering(index, card);
            }
          });
          options.push({
            label: '🔥 残り火へ還元 (+1 🔥)',
            action: () => {
              smeltCard('offering', index);
            }
          });
        } else if (card.type === CARD_CATEGORIES.ATTRIBUTE) {
          options.push({
            label: '🔍 アタッチメント適用',
            action: () => {
              selectedOffering = card;
              selectedOfferingSource = 'offering';
              selectedOfferingIndex = index;
              clearHighlights();
              highlightApplicableSlots(card);
              updateUI();
            }
          });
          options.push({
            label: '🔥 残り火へ還元 (+1 🔥)',
            action: () => {
              smeltCard('offering', index);
            }
          });
        } else if (card.type === CARD_CATEGORIES.CRISIS) {
          options.push({
            label: '☠️ 災厄を解決する',
            action: () => {
              state.offerings[index] = null;
              state.drawnThisTurn = true;
              resolveDisasterEvent(card.id);
            }
          });
        } else if (card.type === CARD_CATEGORIES.SOCIETY || card.type === CARD_CATEGORIES.MYSTIC || card.type === CARD_CATEGORIES.MILITARY) {
          options.push({
            label: '⚡ 効果を適用する',
            action: () => {
              resolveImmediateEvent(card);
              state.offerings[index] = null;
              state.drawnThisTurn = true;
              updateUI();
            }
          });
          options.push({
            label: '🔥 残り火へ還元 (+1 🔥)',
            action: () => {
              smeltCard('offering', index);
            }
          });
        }
        
        options.push({
          label: 'キャンセル',
          action: () => {}
        });
        
        showPopoverMenu(e, options);
      });
      
      el.cardOfferingsZone.appendChild(cardEl);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'card-placeholder';
      placeholder.innerHTML = '<span>配置済</span>';
      el.cardOfferingsZone.appendChild(placeholder);
    }
  });
}

function highlightEmptySlots() {
  state.board.forEach((slot, index) => {
    if (index !== 0 && (!slot || !slot.terrain)) {
      const slotEl = document.querySelector(\`.board-slot.slot-\${index}\`);
      if (slotEl) slotEl.classList.add('highlight-placement');
    }
  });
}

function highlightApplicableSlots(card) {
  state.board.forEach((slot, index) => {
    if (slot && slot.terrain && !slot.seaOccupied && index !== 0) {
      let isValid = true;
      if (slot.terrain === TERRAINS.LAKE && (!card.bonus || card.bonus !== BONUSES.MARINE)) {
        isValid = false;
      }
      if (card.attribute) {
        if (slot.attribute) isValid = false;
      }
      if (isValid) {
        const slotEl = document.querySelector(\`.board-slot.slot-\${index}\`);
        if (slotEl) slotEl.classList.add('highlight-placement');
      }
    }
  });
}

function clearHighlights() {
  document.querySelectorAll('.board-slot').forEach(el => {
    el.classList.remove('highlight-placement');
  });
  document.querySelectorAll('.reserve-slot').forEach(el => {
    el.classList.remove('highlight-placement');
  });
}

`
);

// F. Replace initGlobalDragAndDropListeners down to handleBoardSlotClick
replaceRange(
  "function initGlobalDragAndDropListeners() {",
  "function handleBoardSlotClick(index) {",
  `function initGlobalDragAndDropListeners() {
  // 1. Dragover on the canvas background
  el.landGrid.addEventListener('dragover', (e) => {
    e.preventDefault();
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
      const slotEl = document.querySelector(\`.board-slot.slot-\${draggedSourceIndex}\`);
      if (slotEl) {
        slotEl.style.transition = 'none';
        slotEl.style.left = \`\${x}%\`;
        slotEl.style.top = \`\${y}%\`;
      }
      
      // Update SVG connection lines in real-time
      updateConnectionsSVG();
    }
  });

  // 2. Dragleave on the canvas background
  el.landGrid.addEventListener('dragleave', () => {
    el.landGrid.classList.remove('highlight-placement');
  });

  // 3. Drop on the canvas background
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
    // B. Repositioning existing land node on the canvas (handled in dragover, just finalize it here!)
    else if (draggedSourceType === 'board') {
      state.board[draggedSourceIndex].x = dropX;
      state.board[draggedSourceIndex].y = dropY;
      state.addLog(\`領土スロット \${draggedSourceIndex} を位置 (\${Math.round(dropX)}%, \${Math.round(dropY)}%) へ移動しました。\`, 'system');
      updateUI();
    }
  });

  // 4. Click on the canvas background (for click-to-place fallback)
  el.landGrid.addEventListener('click', (e) => {
    if (selectedOffering && selectedOffering.type === CARD_CATEGORIES.LAND) {
      // Check click was directly on the grid background, not on existing slots
      if (e.target === el.landGrid || e.target.classList.contains('board-grid-bg')) {
        const rect = el.landGrid.getBoundingClientRect();
        const clickX = Math.max(8, Math.min(92, ((e.clientX - rect.left) / rect.width) * 100));
        const clickY = Math.max(8, Math.min(92, ((e.clientY - rect.top) / rect.height) * 100));
        handlePlaceLandAtCoords(selectedOffering, clickX, clickY);
      }
    }
  });

  state.board.forEach((slot, index) => {
    const slotEl = document.querySelector(\`.board-slot.slot-\${index}\`);
    if (!slotEl) return;

    slotEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (draggedCard && draggedSourceType === 'offering') {
        if (canDropOnBoardSlot(draggedCard, index)) {
          slotEl.classList.add('drag-over');
        }
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
        tileWrapper.addEventListener('dragstart', (e) => {
          draggedCard = null;
          draggedSourceType = 'board';
          draggedSourceIndex = index;
          tileWrapper.classList.add('dragging');
          highlightValidTargets();
        });
        tileWrapper.addEventListener('dragend', () => {
          tileWrapper.classList.remove('dragging');
          clearHighlights();
        });
      }
    }

    // Click fallback
    slotEl.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent trigger placing new lands on click canvas
      handleBoardSlotClick(index);
    });
  });

  // Setup Reserve slot drop listeners
  state.reserve.forEach((slot, index) => {
    const reserveSlotEl = document.querySelector(\`.reserve-slot.reserve-\${index}\`);
    if (!reserveSlotEl) return;

    reserveSlotEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (draggedCard && draggedSourceType === 'offering') {
        reserveSlotEl.classList.add('drag-over');
      }
    });

    reserveSlotEl.addEventListener('dragleave', () => {
      reserveSlotEl.classList.remove('drag-over');
    });

    reserveSlotEl.addEventListener('drop', (e) => {
      e.preventDefault();
      reserveSlotEl.classList.remove('drag-over');
      handleDropOnReserveSlot(index);
    });

    reserveSlotEl.addEventListener('click', () => {
      handleReserveSlotClick(index);
    });
  });

  // Open and Close Social Tree Modal
  el.btnOpenSocial.addEventListener('click', () => {
    document.getElementById('modal-palace-menu').style.display = 'none';
    el.modalSocialTree.style.display = 'flex';
    renderPolicyTree(state, unlockPolicy);
  });
  el.btnCloseSocial.addEventListener('click', () => {
    el.modalSocialTree.style.display = 'none';
    document.getElementById('modal-palace-menu').style.display = 'flex';
  });

  // Open and Close Polity Modal
  el.btnOpenPolity.addEventListener('click', () => {
    document.getElementById('modal-palace-menu').style.display = 'none';
    el.modalPolitySelect.style.display = 'flex';
    renderPolitySelect();
  });
  el.btnClosePolity.addEventListener('click', () => {
    el.modalPolitySelect.style.display = 'none';
    document.getElementById('modal-palace-menu').style.display = 'flex';
  });

  // Open facilities modal
  el.btnOpenFacilities.addEventListener('click', () => {
    document.getElementById('modal-palace-menu').style.display = 'none';
    document.getElementById('modal-facilities-build').style.display = 'flex';
    renderFacilities(state, buildFacility);
  });

  // Bind toggle logs button click
  const btnToggleLog = document.getElementById('btn-toggle-log');
  const gameLayout = document.querySelector('.game-layout');
  const sidebarLeft = document.getElementById('sidebar-left-panel');
  if (btnToggleLog && gameLayout && sidebarLeft) {
    btnToggleLog.addEventListener('click', () => {
      sound.playClick();
      const isCollapsed = gameLayout.classList.toggle('log-collapsed');
      sidebarLeft.classList.toggle('collapsed', isCollapsed);
      btnToggleLog.innerText = isCollapsed ? '▶' : '◀';
    });
  }
}

function highlightValidTargets() {
  const slotA = state.board[draggedSourceIndex];
  state.board.forEach((slot, index) => {
    if (index !== 0 && index !== draggedSourceIndex && slot && slot.terrain === slotA.terrain) {
      const slotEl = document.querySelector(\`.board-slot.slot-\${index}\`);
      if (slotEl) slotEl.classList.add('highlight-placement');
    }
  });
}

function canDropOnBoardSlot(card, index) {
  if (index === 0) return false;
  const slot = state.board[index];
  if (draggedSourceType === 'board') {
    const sourceSlot = state.board[draggedSourceIndex];
    return sourceSlot && slot.terrain === sourceSlot.terrain && index !== draggedSourceIndex && slot.terrain !== TERRAINS.LAKE;
  }
  if (!card) return false;
  if (card.type === CARD_CATEGORIES.LAND) {
    return !slot.terrain || (slot.terrain === card.terrain && slot.devLevel === 0 && slot.terrain !== TERRAINS.LAKE);
  }
  if (card.type === CARD_CATEGORIES.ATTRIBUTE) {
    return slot.terrain && !slot.seaOccupied;
  }
  return false;
}

function handleDropOnBoardSlot(index) {
  const slot = state.board[index];
  if (draggedSourceType === 'offering' || draggedSourceType === 'reserve') {
    if (!draggedCard) return;
    if (draggedCard.type === CARD_CATEGORIES.LAND) {
      if (!slot.terrain) {
        const cost = 1;
        if (state.fire < cost) {
          state.addLog('残り火が不足しているため、土地配置できません！', 'warning');
          return;
        }
        state.adjustResource('fire', -cost);
        slot.terrain = draggedCard.terrain;
        slot.attribute = draggedCard.attribute || null;
        slot.bonus = draggedCard.bonus || null;
        slot.devLevel = 0;
        slot.isNew = true;
        removeDraggedCardFromSource();
        state.addLog(\`スロット \${index} に \${getTerrainDisplayName(slot.terrain, slot.attribute)} を配置しました (-\${cost} 🔥)。このターンは産出なし。\`, 'action');
        triggerMergeFX(index);
        endDrawPhase();
        updateUI();
      } else if (slot.terrain === draggedCard.terrain && slot.devLevel === 0 && slot.terrain !== TERRAINS.LAKE) {
        openDirectMergeFromCardDialog(draggedCard, index);
      }
    }
    else if (draggedCard.type === CARD_CATEGORIES.ATTRIBUTE && slot.terrain) {
      const cost = 1;
      if (state.fire < cost) {
        state.addLog('残り火が不足しているため、付与できません！', 'warning');
        return;
      }
      state.adjustResource('fire', -cost);
      if (draggedCard.attribute) {
        slot.attribute = draggedCard.attribute;
        state.addLog(\`\${getTerrainDisplayName(slot.terrain)} に属性「\${getAttributeName(slot.attribute)}」を付与しました (-\${cost} 🔥)。\`, 'action');
      } else if (draggedCard.bonus) {
        slot.bonus = draggedCard.bonus;
        state.addLog(\`\${getTerrainDisplayName(slot.terrain)} に資源「\${getBonusName(slot.bonus)}」を付与しました (-\${cost} 🔥)。\`, 'action');
      }
      triggerMergeFX(index);
      removeDraggedCardFromSource();
      endDrawPhase();
      updateUI();
    }
  }
  else if (draggedSourceType === 'board') {
    const sourceSlot = state.board[draggedSourceIndex];
    if (sourceSlot && slot.terrain === sourceSlot.terrain && index !== draggedSourceIndex) {
      openMergeDialog(draggedSourceIndex, index);
    }
  }
}

function handleDropOnReserveSlot(reserveIndex) {
  if (!draggedCard || draggedSourceType !== 'offering') return;
  if (state.reserve[reserveIndex] !== null) {
    state.addLog('保留スロットが既に埋まっています！', 'warning');
    return;
  }
  state.reserve[reserveIndex] = draggedCard;
  removeDraggedCardFromSource();
  state.addLog(\`手札のカードを保留スロット \${reserveIndex + 1} に移動しました。\`, 'system');
  endDrawPhase();
  updateUI();
}

function selectReserveCard(card, idx) {
  if (selectedOffering) {
    selectedOffering = null;
  }
  selectedOffering = card;
  selectedOfferingSource = 'reserve';
  selectedOfferingIndex = idx;
  
  clearHighlights();
  if (card.type === CARD_CATEGORIES.LAND) {
    highlightEmptySlots();
  } else if (card.type === CARD_CATEGORIES.ATTRIBUTE) {
    highlightApplicableSlots(card);
  }
}

function handleReserveSlotClick(idx) {
  const card = state.reserve[idx];
  if (!card) return;
  sound.playClick();
  if (selectedOffering && selectedOfferingSource === 'reserve' && selectedOfferingIndex === idx) {
    selectedOffering = null;
    clearHighlights();
    updateUI();
  } else {
    selectReserveCard(card, idx);
    updateUI();
  }
}

function removeDraggedCardFromSource() {
  if (selectedOffering) {
    if (selectedOfferingSource === 'offering') {
      state.offerings[selectedOfferingIndex] = null;
    } else if (selectedOfferingSource === 'reserve') {
      state.reserve[selectedOfferingIndex] = null;
    }
  } else if (draggedCard) {
    if (draggedSourceType === 'offering') {
      state.offerings[draggedSourceIndex] = null;
    } else if (draggedSourceType === 'reserve') {
      state.reserve[draggedSourceIndex] = null;
    }
  }
  
  draggedCard = null;
  draggedSourceType = null;
  draggedSourceIndex = null;
  selectedOffering = null;
  selectedOfferingSource = null;
  selectedOfferingIndex = null;
  
  clearHighlights();
}

`
);

// G. Replace handleBoardSlotClick down to highlightMergeCandidates
replaceRange(
  "function handleBoardSlotClick(index) {",
  "function highlightMergeCandidates(slotAIndex) {",
  `function handleBoardSlotClick(index, e) {
  const slot = state.board[index];
  console.log('Board slot clicked, index:', index, 'slot:', slot, 'selectedOffering:', selectedOffering);

  if (index === 0) {
    if (!activeFacilityToPlace && !activeLandCardToPlace && !activeAttachmentCard) {
      document.getElementById('modal-palace-menu').style.display = 'flex';
    }
    return;
  }

  // 1. Direct Merge candidates selecting
  if (selectedMergeSlotAIndex !== null) {
    if (index === selectedMergeSlotAIndex) {
      selectedMergeSlotAIndex = null;
      updateUI();
      return;
    }
    
    const slotA = state.board[selectedMergeSlotAIndex];
    if (slot.terrain === slotA.terrain && slot.devLevel === slotA.devLevel && slot.terrain !== TERRAINS.LAKE && index !== 0) {
      openMergeDialog(selectedMergeSlotAIndex, index);
    } else {
      selectedMergeSlotAIndex = null;
      updateUI();
    }
    return;
  }

  // 2. Placing new land from draft on empty slot
  if (selectedOffering && selectedOffering.type === CARD_CATEGORIES.LAND && !slot.terrain) {
    const cost = 1;
    if (state.fire < cost) {
      state.addLog('残り火が不足しているため、土地配置できません！', 'warning');
      return;
    }
    state.adjustResource('fire', -cost);
    const placedName = getTerrainDisplayName(selectedOffering.terrain, selectedOffering.attribute);
    slot.terrain = selectedOffering.terrain;
    slot.attribute = selectedOffering.attribute || null;
    slot.bonus = selectedOffering.bonus || null;
    slot.devLevel = 0;
    slot.isNew = true;
    removeDraggedCardFromSource();
    state.addLog(\`スロット \${index} に \${placedName} を配置しました (-\${cost} 🔥)。このターンは産出なし。\`, 'action');
    triggerMergeFX(index);
    endDrawPhase();
    updateUI();
    return;
  }

  // 2.5. Merging land card from draft onto existing slot
  if (selectedOffering && selectedOffering.type === CARD_CATEGORIES.LAND && slot.terrain) {
    if (slot.terrain === selectedOffering.terrain && slot.devLevel === 0 && slot.terrain !== TERRAINS.LAKE) {
      openDirectMergeFromCardDialog(selectedOffering, index);
    } else {
      state.addLog('同じ地形で同じ開発段階（★0）の土地同士でのみ結合が可能です！', 'warning');
    }
    return;
  }

  // 3. Placing attribute/bonus attachment card on slot
  if (selectedOffering && selectedOffering.type === CARD_CATEGORIES.ATTRIBUTE && slot.terrain) {
    const cost = 1;
    if (state.fire < cost) {
      state.addLog('残り火が不足しているため、付与できません！', 'warning');
      return;
    }
    state.adjustResource('fire', -cost);
    if (selectedOffering.attribute) {
      slot.attribute = selectedOffering.attribute;
      state.addLog(\`\${getTerrainDisplayName(slot.terrain)} に属性「\${getAttributeName(slot.attribute)}」を付与しました (-\${cost} 🔥)。\`, 'action');
    } else if (selectedOffering.bonus) {
      slot.bonus = selectedOffering.bonus;
      state.addLog(\`\${getTerrainDisplayName(slot.terrain)} に資源「\${getBonusName(slot.bonus)}」を付与しました (-\${cost} 🔥)。\`, 'action');
    }
    triggerMergeFX(index);
    removeDraggedCardFromSource();
    endDrawPhase();
    updateUI();
    return;
  }

  // 4. Default: Clicking occupied slot initiates Direct Merge candidate selection
  if (slot.terrain && !slot.seaOccupied) {
    sound.playClick();
    
    const hasCandidates = state.board.some((s, idx) => idx !== 0 && idx !== index && s && s.terrain === slot.terrain && s.devLevel === slot.devLevel);
    const options = [
      {
        label: '👥 土地の結合を行う',
        disabled: !hasCandidates,
        action: () => {
          selectedMergeSlotAIndex = index;
          updateUI();
        }
      },
      {
        label: 'キャンセル',
        action: () => {}
      }
    ];
    
    showPopoverMenu(e, options);
  }
}

`
);

// H. Replace highlightMergeCandidates down to executeMerge
replaceRange(
  "function highlightMergeCandidates(slotAIndex) {",
  "function executeMerge(idxA, idxB, selectedTraits, cost) {",
  `function highlightMergeCandidates(slotAIndex) {
  const slotA = state.board[slotAIndex];
  state.board.forEach((slot, index) => {
    if (index !== 0 && index !== slotAIndex && slot && slot.terrain === slotA.terrain) {
      const slotEl = document.querySelector(\`.board-slot.slot-\${index}\`);
      if (slotEl) slotEl.classList.add('highlight-placement');
    }
  });
}

function openMergeDialog(idxA, idxB) {
  const landA = state.board[idxA];
  const landB = state.board[idxB];
  if (!landA || !landB || landA.terrain !== landB.terrain) return;

  const modal = document.getElementById('modal-merge-select');
  modal.style.display = 'flex';

  document.getElementById('merge-source-a').innerHTML = \`
    <h4>スロット \${idxA}</h4>
    <p>\${getTerrainIcon(landA.terrain)} \${getTerrainDisplayName(landA.terrain, landA.attribute)}</p>
    <p>開発度: ★\${landA.devLevel}</p>
  \`;
  document.getElementById('merge-source-b').innerHTML = \`
    <h4>スロット \${idxB}</h4>
    <p>\${getTerrainIcon(landB.terrain)} \${getTerrainDisplayName(landB.terrain, landB.attribute)}</p>
    <p>開発度: ★\${landB.devLevel}</p>
  \`;

  const baseCost = state.role === ROLES.PIONEER ? 1 : 2;
  const mergeCost = state.activePolity === 'pioneer_democracy' ? Math.max(0, baseCost - 1) : baseCost;

  el.btnConfirmMerge.innerText = \`開発を実行 (🔥 \${mergeCost})\`;
  
  const canAfford = state.fire >= mergeCost;
  el.btnConfirmMerge.disabled = !canAfford;

  const traits = [];
  if (landA.attribute) traits.push({ type: 'attr', val: landA.attribute, source: 'A' });
  if (landA.bonus) traits.push({ type: 'bonus', val: landA.bonus, source: 'A' });
  if (landB.attribute) traits.push({ type: 'attr', val: landB.attribute, source: 'B' });
  if (landB.bonus) traits.push({ type: 'bonus', val: landB.bonus, source: 'B' });

  const maxTraits = getMaxSelectableTraits(traits);
  const selectedTraits = [];

  const container = document.getElementById('merge-traits-options');
  container.innerHTML = '';

  if (traits.length === 0) {
    container.innerHTML = '<div style="font-size: 0.72rem; color: #9ca3af; text-align: center; width: 100%;">選択可能な特性はありません</div>';
  } else {
    traits.forEach((t, i) => {
      const item = document.createElement('div');
      item.className = 'trait-option-card';
      item.style.padding = '8px';
      item.style.border = '1px solid rgba(255,255,255,0.1)';
      item.style.borderRadius = '4px';
      item.style.cursor = 'pointer';
      item.style.fontSize = '0.72rem';
      
      const label = t.type === 'attr' ? \`属性: \${getAttributeName(t.val)}\` : \`資源: \${getBonusName(t.val)}\`;
      item.innerText = \`\${label} (\${t.source})\`;

      item.onclick = () => {
        const idx = selectedTraits.indexOf(t);
        if (idx !== -1) {
          selectedTraits.splice(idx, 1);
          item.classList.remove('selected');
        } else {
          if (selectedTraits.length >= maxTraits) {
            const old = selectedTraits.shift();
            document.querySelectorAll('.trait-option-card').forEach(card => {
              if (card.innerText.includes(old.source) && card.innerText.includes(old.type === 'attr' ? '属性' : '資源')) {
                card.classList.remove('selected');
              }
            });
          }
          selectedTraits.push(t);
          item.classList.add('selected');
        }
        el.btnConfirmMerge.disabled = !canAfford || (selectedTraits.length < Math.min(maxTraits, traits.length));
      };

      container.appendChild(item);
    });
  }

  el.btnConfirmMerge.onclick = () => {
    executeMerge(idxB, idxA, selectedTraits, mergeCost);
    closeMergeDialog();
  };

  document.getElementById('btn-cancel-merge').onclick = () => {
    closeMergeDialog();
  };
}

function closeMergeDialog() {
  document.getElementById('modal-merge-select').style.display = 'none';
  selectedMergeSlotAIndex = null;
  clearHighlights();
  updateUI();
}

function openDirectMergeFromCardDialog(card, targetIndex) {
  const landTarget = state.board[targetIndex];
  if (!landTarget || landTarget.terrain !== card.terrain) return;

  const modal = document.getElementById('modal-merge-select');
  modal.style.display = 'flex';

  document.getElementById('merge-source-a').innerHTML = \`
    <h4>スロット \${targetIndex}</h4>
    <p>\${getTerrainIcon(landTarget.terrain)} \${getTerrainDisplayName(landTarget.terrain, landTarget.attribute)}</p>
    <p>開発度: ★\${landTarget.devLevel}</p>
  \`;
  document.getElementById('merge-source-b').innerHTML = \`
    <h4>ドロー/手札カード</h4>
    <p>\${getTerrainIcon(card.terrain)} \${card.name}</p>
    <p>開発度: ★0</p>
  \`;

  const baseCost = state.role === ROLES.PIONEER ? 1 : 2;
  const mergeCost = state.activePolity === 'pioneer_democracy' ? Math.max(0, baseCost - 1) : baseCost;

  el.btnConfirmMerge.innerText = \`開発を実行 (🔥 \${mergeCost})\`;

  const canAfford = state.fire >= mergeCost;
  el.btnConfirmMerge.disabled = !canAfford;

  const traits = [];
  if (card.attribute) traits.push({ type: 'attr', val: card.attribute, source: 'A' });
  if (card.bonus) traits.push({ type: 'bonus', val: card.bonus, source: 'A' });
  if (landTarget.attribute) traits.push({ type: 'attr', val: landTarget.attribute, source: 'B' });
  if (landTarget.bonus) traits.push({ type: 'bonus', val: landTarget.bonus, source: 'B' });

  const maxTraits = getMaxSelectableTraits(traits);
  const selectedTraits = [];

  const container = document.getElementById('merge-traits-options');
  container.innerHTML = '';

  if (traits.length === 0) {
    container.innerHTML = '<div style="font-size: 0.72rem; color: #9ca3af; text-align: center; width: 100%;">選択可能な特性はありません</div>';
  } else {
    traits.forEach((t, i) => {
      const item = document.createElement('div');
      item.className = 'trait-option-card';
      item.style.padding = '8px';
      item.style.border = '1px solid rgba(255,255,255,0.1)';
      item.style.borderRadius = '4px';
      item.style.cursor = 'pointer';
      item.style.fontSize = '0.72rem';
      
      const label = t.type === 'attr' ? \`属性: \${getAttributeName(t.val)}\` : \`資源: \${getBonusName(t.val)}\`;
      item.innerText = \`\${label} (\${t.source})\`;

      item.onclick = () => {
        const idx = selectedTraits.indexOf(t);
        if (idx !== -1) {
          selectedTraits.splice(idx, 1);
          item.classList.remove('selected');
        } else {
          if (selectedTraits.length >= maxTraits) {
            const old = selectedTraits.shift();
            document.querySelectorAll('.trait-option-card').forEach(card => {
              if (card.innerText.includes(old.source) && card.innerText.includes(old.type === 'attr' ? '属性' : '資源')) {
                card.classList.remove('selected');
              }
            });
          }
          selectedTraits.push(t);
          item.classList.add('selected');
        }
        el.btnConfirmMerge.disabled = !canAfford || (selectedTraits.length < Math.min(maxTraits, traits.length));
      };

      container.appendChild(item);
    });
  }

  el.btnConfirmMerge.onclick = () => {
    removeDraggedCardFromSource();
    executeMerge(targetIndex, null, selectedTraits, mergeCost);
    closeMergeDialog();
  };

  document.getElementById('btn-cancel-merge').onclick = () => {
    closeMergeDialog();
  };
}

`
);

// H. Replace executeMerge down to showGrandEventModal
replaceRange(
  "function executeMerge(idxA, idxB, selectedTraits, cost) {",
  "function showGrandEventModal(title, text, img, onClose) {",
  `function executeMerge(targetIdx, sourceIdx, selectedTraits, cost) {
  state.adjustResource('fire', -cost);
  
  const landTarget = state.board[targetIdx];
  const landSource = sourceIdx !== null ? state.board[sourceIdx] : null;

  // 1. Upgrade Rarity/Dev level of landTarget
  landTarget.devLevel = Math.min(4, landTarget.devLevel + 1);
  updateLandRarity(landTarget);

  // 2. Set chosen traits
  const hasDupAttr = selectedTraits.length === 2 && 
                     selectedTraits[0].type === 'attr' && 
                     selectedTraits[1].type === 'attr' && 
                     selectedTraits[0].val === selectedTraits[1].val;
  const hasDupBonus = selectedTraits.length === 2 && 
                      selectedTraits[0].type === 'bonus' && 
                      selectedTraits[1].type === 'bonus' && 
                      selectedTraits[0].val === selectedTraits[1].val;

  landTarget.attribute = null;
  landTarget.bonus = null;

  selectedTraits.forEach(t => {
    if (t.type === 'attr') landTarget.attribute = t.val;
    if (t.type === 'bonus') landTarget.bonus = t.val;
  });

  landTarget.dupAttr = hasDupAttr;
  landTarget.dupBonus = hasDupBonus;

  // Verify capacity after merge and destroy facility if it exceeds capacity
  const newCapacity = state.getSlotCapacity(landTarget);
  const occupied = state.getSlotOccupiedCount(landTarget);
  if (occupied > newCapacity) {
    const oldFac = landTarget.facility;
    landTarget.facility = null;
    state.addLog(\`注意：容量低下により、施設「\${getFacilityName(oldFac)}」が崩壊・撤去されました。\`, 'warning');
  }

  // 3. Clear landSource (consumed) and free up its board slot fully (keep coordinates so it renders as empty slot outline)
  if (landSource) {
    landSource.terrain = null;
    landSource.attribute = null;
    landSource.bonus = null;
    landSource.facility = null;
    landSource.devLevel = 0;
    landSource.disasterTurns = 0;
    landSource.damagedTurns = 0;
    landSource.overlayLevel = 0;
    landSource.isNew = false;
  }

  // Calculate and immediately produce yield
  const landYield = state.calculateLandYield(landTarget);
  state.adjustResource('food', landYield.food);
  state.adjustResource('materials', landYield.materials);
  state.adjustResource('defense', landYield.defense);
  state.adjustResource('mystic', landYield.mystic);

  state.addLog(\`土地開発：スロット \${targetIdx} を開発度★ \${landTarget.devLevel} へ強化しました (-\\&\` + \`nbsp;\${cost} 🔥)。開発時即時産出：🌾 +\${landYield.food} / 🧱 +\${landYield.materials} / 🛡️ +\${landYield.defense} / ✨ +\${landYield.mystic}\`, 'reward');
  triggerMergeFX(targetIdx);
  
  updateUI();
}

function resolveImmediateEvent(card) {
  sound.playPlace();
  if (card.type === CARD_CATEGORIES.SOCIETY) {
    state.adjustResource('materials', card.materialsEffect || 0);
    state.addLog(\`社会カード「\${card.name}」を適用しました。効果：🧱 \${card.materialsEffect >= 0 ? '+' : ''}\${card.materialsEffect}\`, 'reward');
  } else if (card.type === CARD_CATEGORIES.MYSTIC) {
    state.adjustResource('mystic', card.mysticEffect || 0);
    state.addLog(\`神秘カード「\${card.name}」を適用しました。効果：✨ \${card.mysticEffect >= 0 ? '+' : ''}\${card.mysticEffect}\`, 'reward');
  } else if (card.type === CARD_CATEGORIES.MILITARY) {
    state.adjustResource('defense', card.defenseEffect || 0);
    state.addLog(\`軍事カード「\${card.name}」を適用しました。効果：🛡️ \${card.defenseEffect >= 0 ? '+' : ''}\${card.defenseEffect}\`, 'reward');
  }
}

function triggerMergeFX(slotIndex) {
  const slotEl = document.querySelector(\`.board-slot.slot-\${slotIndex}\`);
  if (!slotEl) return;
  const overlay = document.createElement('div');
  overlay.className = 'merge-fx-overlay';
  slotEl.appendChild(overlay);
  setTimeout(() => {
    overlay.remove();
  }, 1000);
}

`
);

// I. Replace showGrandEventModal down to btnEndTurn click listener
replaceRange(
  "function showGrandEventModal(title, text, img, onClose) {",
  "el.btnEndTurn.addEventListener('click', () => {",
  `function showGrandEventModal(title, text, img, onClose) {
  const modal = el.modalGenericEvent;
  modal.style.display = 'flex';
  
  const imgEl = document.getElementById('generic-event-image');
  if (imgEl) {
    imgEl.style.backgroundImage = \`url('images/\${img}')\`;
  }
  
  document.getElementById('generic-event-icon').style.display = 'none';
  document.getElementById('generic-event-title').innerText = title;
  document.getElementById('generic-event-text').innerHTML = text;
  
  const optionsDiv = document.getElementById('generic-event-options');
  optionsDiv.innerHTML = \`
    <button class="event-option-btn" id="btn-close-generic-event" style="background: linear-gradient(135deg, #10b981 0%, #065f46 100%); border-color: #34d399; box-shadow: 0 0 15px rgba(16, 185, 129, 0.4);">
      確認
    </button>
  \`;
  
  document.getElementById('btn-close-generic-event').onclick = () => {
    modal.style.display = 'none';
    if (onClose) onClose();
  };
}

function resolveDisasterEvent(disasterId, onClose) {
  sound.playDisaster();
  const result = executeDisaster(state, disasterId);
  if (result) {
    showGrandEventModal(\`災厄発生: \${result.name}\`, result.desc, 'crisis.png', () => {
      updateUI();
      if (onClose) onClose();
    });
  } else {
    if (onClose) onClose();
  }
}

function checkRiverExpeditionEvents() {
  const riverLand = state.board.find(l => l && l.attribute === ATTRIBUTES.RIVER);
  if (riverLand && !state.facilities.river_survey) {
    state.facilities.river_survey = true;
    state.addLog('川属性を発見！コマンド本部に「下流探索プロジェクト」が開始されました。', 'system');
  }
}

function unlockPolicy(policyId, cost) {
  state.adjustResource('materials', -cost);
  state.policies[policyId] = true;
  state.addLog(\`社会制度：「\${policyId}」を解除しました！(-\&nbsp;\${cost} 🧱)\`, 'reward');
  sound.playPlace();
  checkPolityUnlocks(policyId);
  updateUI();
}

function buildFacility(facilityId, cost) {
  state.adjustResource('materials', -cost);
  state.facilities[facilityId] = true;
  state.addLog(\`施設建設：「\${getFacilityName(facilityId)}」が完成しました！(-\&nbsp;\${cost} 🧱)\`, 'reward');
  sound.playPlace();
  updateUI();
}

function checkGameOver() {
  if (state.fire <= 0) {
    el.modalGameEnd.style.display = 'flex';
    el.gameEndTitle.innerText = 'GAME OVER';
    el.gameEndTitle.className = 'game-end-title';
    el.gameEndDesc.innerText = '残り火が完全に消え去り、集落は凍える闇の中に飲み込まれました。あなたの旅はここで終わります...';
    
    const turnScore = state.currentTurn * 100;
    const totalScore = turnScore;

    el.scoreBreakdown.innerHTML = \`
      <div class="score-row"><span>残り火:</span> <span class="text-danger">0 (消滅)</span></div>
      <div class="score-row"><span>生存ターン (T \${state.currentTurn} x 100):</span> <span>+\${turnScore}</span></div>
      <div class="score-row total"><span>最終スコア:</span> <span>\${totalScore}</span></div>
    \`;
  }
}
`
);

// J. Replace btnEndTurn click listener down to runTrialPhase
replaceRange(
  "el.btnEndTurn.addEventListener('click', () => {",
  "function runTrialPhase() {",
  `el.btnEndTurn.addEventListener('click', () => {
  if (state.drawnThisTurn === false) {
    state.addLog('このターン、まだドローまたは探索を行っていません！', 'warning');
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

  state.addLog(\`第 \${state.currentTurn} ターン終了。生産物回収：🌾 +\${yields.food} / 🧱 +\${yields.materials} / ✨ +\${yields.mystic} (総防衛力: 🛡️ \${state.defense})\`, 'action');

  // 2. Consume Food Maintenance Cost
  const foodMaintenance = 20;
  const originalFood = state.food;
  state.adjustResource('food', -foodMaintenance);
  
  // 3. Determine Fire Decay based on remaining accumulated Food
  let fireDecay = 1;
  let foodCorrectionText = "";
  
  if (originalFood < foodMaintenance) {
    fireDecay = 2; 
    foodCorrectionText = \` (深刻な食料不足による残り火の衰退: -2 🔥 / 消費コスト \${foodMaintenance} に対して残高 \${originalFood} 🌾)\`;
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
    state.addLog(\`残り火減衰：残り火が \${fireDecay} 🔥 減少しました。\${foodCorrectionText}\`, 'warning');
  } else if (fireDecay === 0) {
    state.addLog(\`残り火維持：残り火は減少せず維持されました。\${foodCorrectionText}\`, 'system');
  } else {
    state.addLog(\`残り火増幅：活力が満ち、残り火が \${Math.abs(fireDecay)} 🔥 増加しました！\${foodCorrectionText}\`, 'reward');
  }

  // 4. Check Game Over
  checkGameOver();
  if (state.fire <= 0) return;

  // 5. Check trial state triggers
  if (state.currentTurn === state.upcomingTrial.turn) {
    runTrialPhase();
    return;
  }

  // 6. Clear isNew flag for all lands
  state.board.forEach(land => {
    if (land) land.isNew = false;
  });

  // 7. Increment Turn
  state.currentTurn++;
  state.turnsSinceLastTrial++;

  // 8. Decrement Polity Cooldown
  if (state.polityCooldown > 0) {
    state.polityCooldown--;
  }

  // 9. Game Clear at Turn 51
  if (state.currentTurn > 50) {
    runGameVictoryPhase();
    return;
  }

  // 10. Start next turn
  startTurn();
});

`
);

// K. Replace runTrialPhase down to renderReserveSlots
replaceRange(
  "function runTrialPhase() {",
  "function renderReserveSlots() {",
  `function runTrialPhase() {
  const battlefields = selectTrialBattlefields(state);
  const tactic = state.upcomingTrial.tactic;

  // Show battle modal
  el.modalTrialBattle.style.display = 'flex';
  el.trialCombatLogZone.style.display = 'none';
  el.btnStartBattle.style.display = 'block';
  sound.playSiren();

  renderTrialBattleModal(battlefields, tactic);
}

function renderTrialBattleModal(battlefields, tactic) {
  el.trialBattleTitle.innerText = \`🔥 第 \${state.nextTrialIndex} の試練 襲来 🔥\`;
  el.trialBattleTactic.innerText = \`敵軍戦術: \${tactic.name} (\${tactic.desc})\`;
  
  let modifiedPower = state.upcomingTrial.basePower;
  if (tactic.name.includes('強襲')) modifiedPower = Math.round(modifiedPower * 1.2);
  if (tactic.name.includes('火攻め')) modifiedPower = Math.round(modifiedPower * 1.1);
  el.trialBattlePower.innerText = \`総敵戦力: ⚔️ \${modifiedPower}\`;

  // Render battlefields
  el.trialBattlefieldsContainer.innerHTML = '';
  battlefields.forEach(bf => {
    const card = document.createElement('div');
    card.style.background = 'rgba(255,255,255,0.03)';
    card.style.border = '1px solid rgba(255,255,255,0.08)';
    card.style.borderRadius = '8px';
    card.style.padding = '10px';
    card.style.textAlign = 'left';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '6px';
    
    const bfDefense = calculateBattlefieldDefense(state, bf, bf.tacticId, tactic);
    
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.fontSize = '0.8rem';
    header.style.color = '#e5e7eb';
    header.innerHTML = \`
      <strong style="color: #f97316;">\${bf.name} (スロット \${bf.index})</strong>
      <span id="bf-def-val-\${bf.index}" style="font-weight: bold; color: #34d399;">🛡️ 防衛力: \${bfDefense}</span>
    \`;
    card.appendChild(header);

    // Tactic selection dropdown
    const selectArea = document.createElement('div');
    selectArea.style.display = 'flex';
    selectArea.style.flexDirection = 'column';
    selectArea.style.gap = '4px';
    
    const label = document.createElement('label');
    label.style.fontSize = '0.7rem';
    label.style.color = '#9ca3af';
    label.innerText = '防衛戦術の配置：';
    selectArea.appendChild(label);

    const select = document.createElement('select');
    select.style.background = '#1f2937';
    select.style.color = '#e5e7eb';
    select.style.border = '1px solid #4b5563';
    select.style.borderRadius = '4px';
    select.style.padding = '4px';
    select.style.fontSize = '0.72rem';
    select.style.outline = 'none';

    const optNone = document.createElement('option');
    optNone.value = '';
    optNone.innerText = 'なし (無策)';
    select.appendChild(optNone);

    PLAYER_TACTICS.forEach(t => {
      if (t.canUse(bf.land, bf.index)) {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.innerText = t.name;
        if (bf.tacticId === t.id) opt.selected = true;
        select.appendChild(opt);
      }
    });

    select.onchange = () => {
      bf.tacticId = select.value || null;
      const newDef = calculateBattlefieldDefense(state, bf, bf.tacticId, tactic);
      document.getElementById(\`bf-def-val-\${bf.index}\`).innerText = \`🛡️ 防衛力: \${newDef}\`;
    };

    selectArea.appendChild(select);
    card.appendChild(selectArea);
    el.trialBattlefieldsContainer.appendChild(card);
  });

  // Start Battle button handler
  el.btnStartBattle.disabled = false;
  el.btnStartBattle.onclick = () => {
    runTrialCombatResolution(battlefields, tactic);
  };
}

function runTrialCombatResolution(battlefields, tactic) {
  el.btnStartBattle.disabled = true;
  document.querySelectorAll('#trial-battlefields-container button').forEach(b => b.disabled = true);
  
  el.trialCombatLogZone.style.display = 'block';
  el.trialCombatLogZone.innerHTML = '';
  
  // Run combat logic
  const combatResult = resolveTrialCombat(state, battlefields, tactic);
  
  // Stream logs
  let logIndex = 0;
  function printNextLog() {
    if (logIndex < combatResult.combatLogs.length) {
      const line = document.createElement('div');
      line.style.marginBottom = '4px';
      line.innerText = combatResult.combatLogs[logIndex];
      
      // Color coding
      if (line.innerText.includes('[防衛成功]')) {
        line.style.color = '#34d399'; // Green
      } else if (line.innerText.includes('[警告]') || line.innerText.includes('☠️') || line.innerText.includes('💥')) {
        line.style.color = '#f87171'; // Red
      } else if (line.innerText.includes('--- Wave')) {
        line.style.color = '#facc15'; // Yellow
      }
      
      el.trialCombatLogZone.appendChild(line);
      el.trialCombatLogZone.scrollTop = el.trialCombatLogZone.scrollHeight;
      
      logIndex++;
      setTimeout(printNextLog, 400); // 400ms delay between log lines
    } else {
      // Finished log stream, show summary result
      setTimeout(() => {
        el.modalTrialBattle.style.display = 'none';
        showTrialResultModal(combatResult);
      }, 1000);
    }
  }
  
  printNextLog();
}

`
);

// L. Replace renderReserveSlots down to conscriptSoldier
replaceRange(
  "function renderReserveSlots() {",
  "function conscriptSoldier() {",
  `function renderReserveSlots() {
  state.reserve.forEach((card, index) => {
    const slotEl = document.querySelector(\`.reserve-slot.reserve-\${index}\`);
    if (!slotEl) return;
    slotEl.innerHTML = '';
    if (card) {
      const cardEl = renderCard(card);
      cardEl.setAttribute('draggable', 'true');
      cardEl.addEventListener('dragstart', (e) => {
        draggedCard = card;
        draggedSourceType = 'reserve';
        draggedSourceIndex = index;
        cardEl.classList.add('dragging');
        document.body.classList.add('dragging-active');
      });
      cardEl.addEventListener('dragend', () => {
        cardEl.classList.remove('dragging');
        document.body.classList.remove('dragging-active');
      });
      
      // Mouseover details tooltip
      cardEl.addEventListener('mouseenter', (e) => {
        showCardTooltip(e, card);
      });
      cardEl.addEventListener('mousemove', (e) => {
        updateTooltipPosition(e);
      });
      cardEl.addEventListener('mouseleave', () => {
        hideTooltip();
      });

      // Left-click actions popover menu
      cardEl.addEventListener('click', (e) => {
        e.stopPropagation();
        sound.playClick();
        
        const canMergeWithBoard = state.board.some((s, idx) => idx !== 0 && s && s.terrain === card.terrain && s.devLevel === 0);
        const options = [
          {
            label: '🧭 盤面に配置する',
            action: () => {
              selectReserveCard(card, index);
              updateUI();
            }
          },
          {
            label: '👥 既存の土地と結合する',
            disabled: !canMergeWithBoard,
            action: () => {
              selectedOffering = card;
              selectedOfferingSource = 'reserve';
              selectedOfferingIndex = index;
              clearHighlights();
              state.board.forEach((s, idx) => {
                if (idx !== 0 && s && s.terrain === card.terrain && s.devLevel === 0) {
                  const slotEl = document.querySelector(\`.board-slot.slot-\${idx}\`);
                  if (slotEl) slotEl.classList.add('highlight-placement');
                }
              });
              el.interactionTitle.innerText = \`土地結合：保留カードの「\${card.name}」と結合させたい、盤面の同じ地形の土地（★0）を選択してください\`;
              updateUI();
            }
          },
          {
            label: '🔥 残り火へ還元 (+1 🔥)',
            action: () => {
              smeltCard('reserve', index);
            }
          },
          {
            label: 'キャンセル',
            action: () => {}
          }
        ];
        
        showPopoverMenu(e, options);
      });

      slotEl.appendChild(cardEl);
    } else {
      slotEl.innerHTML = \`<span style="font-size: 0.65rem; color: #4b5563;">保留 \${index + 1}</span>\`;
    }
  });
}

function handlePlaceLandAtCoords(card, x, y) {
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
  targetSlot.devLevel = 0;
  targetSlot.rarity = card.rarity || 'c';
  updateLandRarity(targetSlot);
  targetSlot.isNew = true;
  targetSlot.x = x;
  targetSlot.y = y;
  sound.playPlace();

  const placedName = getTerrainDisplayName(targetSlot.terrain, targetSlot.attribute);
  removeDraggedCardFromSource();
  state.addLog(\`スロット \${targetIndex} (\${Math.round(x)}%, \${Math.round(y)}%) に \${placedName} を配置しました (-\${cost} 🔥)。このターンは産出なし。\`, 'action');
  
  const landYield = state.calculateLandYield(targetSlot);
  state.adjustResource('food', landYield.food);
  state.adjustResource('materials', landYield.materials);
  state.adjustResource('defense', landYield.defense);

  endDrawPhase();
  updateUI();
}

function updateConnectionsSVG() {
  const svg = document.getElementById('connections-svg');
  if (!svg) return;
  svg.innerHTML = '';

  state.board.forEach((slot, index) => {
    if (index === 0) return;
    if (slot && slot.terrain) {
      const x1 = 50;
      const y1 = 50;
      const x2 = slot.x;
      const y2 = slot.y;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', \`\${x1}%\`);
      line.setAttribute('y1', \`\${y1}%\`);
      line.setAttribute('x2', \`\${x2}%\`);
      line.setAttribute('y2', \`\${y2}%\`);
      line.setAttribute('stroke', 'rgba(255, 255, 255, 0.15)');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('stroke-dasharray', '4 4');
      svg.appendChild(line);
    }
  });
}
`
);

// M. Replace conscriptSoldier down to resolveTrialCountdown
replaceRange(
  "function conscriptSoldier() {",
  "function resolveTrialCountdown() {",
  `// Recruit/Conscript a soldier removed
`
);

// N. Now, let's fix the second half function bodies that contain mojibake or duplicate calls
// We'll replace updateUI and resolveTrialCountdown fully with clean Japanese
replaceRange(
  "function resolveTrialCountdown() {",
  "// Sidebar military section removed\n}",
  `function resolveTrialCountdown() {
  const turnsToTrial = state.upcomingTrial ? (state.upcomingTrial.turn - state.currentTurn) : 0;
  const trialCountdownEl = document.getElementById('trial-countdown');
  const trialDetailsEl = document.getElementById('trial-details');
  if (trialCountdownEl) {
    if (turnsToTrial === 0) {
      trialCountdownEl.innerHTML = \`<span style="color: #ef4444; font-weight: bold; animation: pulse 1s infinite;">今ターン終了時に試練襲来！</span>\`;
    } else {
      trialCountdownEl.innerHTML = \`試練まであと <span style="font-size: 1.1rem; font-weight: bold; color: #f59e0b;">\${turnsToTrial}</span> ターン\`;
    }
  }

  if (trialDetailsEl) {
    const prophetPreviewThreshold = 7;
    const defaultPreviewThreshold = 5;
    const watchtowerActive = state.facilities.watchtower;
    const previewThreshold = (state.role === ROLES.PROPHET ? prophetPreviewThreshold : defaultPreviewThreshold) + (watchtowerActive ? 1 : 0);

    if (turnsToTrial <= previewThreshold) {
      trialDetailsEl.innerText = \`予告: ⚔️敵戦力: \${state.upcomingTrial.power} (属性: \${state.upcomingTrial.tactic.name})\`;
    } else {
      trialDetailsEl.innerText = '詳細は謎に包まれている...';
    }
  }
}

function updateUI() {
  if (state.gameOver) return;

  // 1. Render status bar elements
  if (el.currentTurn) el.currentTurn.innerText = state.currentTurn;
  if (el.valFire) el.valFire.innerText = state.fire;
  if (el.valMaxFire) el.valMaxFire.innerText = state.maxFire;
  if (el.valFood) el.valFood.innerText = state.food;
  if (el.valMaterials) el.valMaterials.innerText = state.materials;
  if (el.valDefense) el.valDefense.innerText = state.defense;
  if (el.valMystic) el.valMystic.innerText = state.mystic;

  // 1.5. Render logs in sidebar
  const logConsole = document.getElementById('log-console');
  if (logConsole) {
    logConsole.innerHTML = '';
    state.logs.forEach(log => {
      const entry = document.createElement('div');
      entry.className = 'log-entry ' + log.type;
      entry.innerText = '[T' + log.turn + '] ' + log.message;
      logConsole.appendChild(entry);
    });
  }

  // Render yield totals / sidebar bonuses
  const yields = state.calculateTotalProduction();
  const foodBonus = document.getElementById('total-food-bonus');
  const materialsBonus = document.getElementById('total-materials-bonus');
  const defenseBonus = document.getElementById('total-defense-bonus');
  const mysticBonus = document.getElementById('total-mystic-bonus');

  if (foodBonus) foodBonus.innerText = \`+\${yields.food}\`;
  if (materialsBonus) materialsBonus.innerText = \`+\${yields.materials}\`;
  if (defenseBonus) defenseBonus.innerText = \`+\${yields.defense}\`;
  if (mysticBonus) mysticBonus.innerText = \`+\${yields.mystic}\`;

  // Fire decay display
  const fireBonus = document.getElementById('val-fire-bonus');
  if (fireBonus) {
    const penalty = state.reserve.filter(c => c !== null).length > 0 ? 1 : 0;
    const baseDecay = 1 + penalty;
    fireBonus.innerText = \`-\${baseDecay}\`;
  }

  // 2. Render Hand Offering cards
  renderOfferings();

  // 3. Render 3D Board lands
  el.landGrid.innerHTML = '';
  state.board.forEach((slot, index) => {
    if (!slot || (!slot.terrain && (slot.x === null || slot.y === null))) return;
    
    const slotEl = renderBoardSlot(slot, index, state);
    
    // Highlight if selected for merge or matches terrain & devLevel of selected merge slot
    if (selectedMergeSlotAIndex !== null) {
      if (index === selectedMergeSlotAIndex) {
        slotEl.classList.add('merge-source');
      } else if (index !== 0 && slot && slot.terrain === state.board[selectedMergeSlotAIndex].terrain && slot.devLevel === state.board[selectedMergeSlotAIndex].devLevel && slot.terrain !== TERRAINS.LAKE) {
        slotEl.classList.add('highlight-placement');
      }
    }
    
    // Palace slot 0 cannot be dragged, but can be a drop target for battlefields
    // Outer slots are drop targets for merges and attributes
    slotEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (canDropOnBoardSlot(draggedCard, index)) {
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
        tileWrapper.addEventListener('dragstart', (e) => {
          draggedCard = null;
          draggedSourceType = 'board';
          draggedSourceIndex = index;
          tileWrapper.classList.add('dragging');
          document.body.classList.add('dragging-active');
          highlightValidTargets();
        });
        tileWrapper.addEventListener('dragend', () => {
          tileWrapper.classList.remove('dragging');
          document.body.classList.remove('dragging-active');
          clearHighlights();
        });
      }
    }

    // Mouseover details tooltip
    slotEl.addEventListener('mouseenter', (e) => {
      showBoardSlotTooltip(e, slot, index);
    });
    slotEl.addEventListener('mousemove', (e) => {
      updateTooltipPosition(e);
    });
    slotEl.addEventListener('mouseleave', () => {
      hideTooltip();
    });

    slotEl.addEventListener('click', (e) => {
      e.stopPropagation();
      handleBoardSlotClick(index, e);
    });
    
    el.landGrid.appendChild(slotEl);
  });

  // 4. Update interactions title banner
  if (!selectedOffering && selectedMergeSlotAIndex === null) {
    el.interactionTitle.innerText = \`資源調査フェイズ：探索を行うか、手札のカードを盤面に配置してください\`;
  } else if (selectedMergeSlotAIndex !== null) {
    el.interactionTitle.innerText = \`土地結合：スロット \${selectedMergeSlotAIndex} と結合させたい、同じ地形タイプの他の土地を選択してください\`;
  }

  // 5. Update draw state buttons in sidebar
  if (el.btnMulligan) el.btnMulligan.disabled = state.drawnThisTurn || state.fire < 1;
  if (el.btnDrawExtra) el.btnDrawExtra.disabled = state.fire < 2;

  // 6. Update Turn Count and countdowns
  resolveTrialCountdown();

  // 7. Render Mystic Miracle progress bar
  const maxMystic = state.role === ROLES.PROPHET ? 24 : 30;
  const progress = Math.min(100, (state.mystic / maxMystic) * 100);
  const progressEl = document.getElementById('mystic-progress');
  const meterTextEl = document.getElementById('mystic-meter-text');
  if (progressEl) progressEl.style.width = \`\${progress}%\`;
  if (meterTextEl) meterTextEl.innerText = \`\${state.mystic} / \${maxMystic}\`;

  // Render Mystic Miracle buttons availability
  const btnLow = document.getElementById('btn-miracle-low');
  const btnMed = document.getElementById('btn-miracle-med');
  const btnHigh = document.getElementById('btn-miracle-high');
  if (btnLow) btnLow.disabled = state.mystic < (state.role === ROLES.PROPHET ? 24 : 30);
  if (btnMed) btnMed.disabled = state.mystic < (state.role === ROLES.PROPHET ? 56 : 70);
  if (btnHigh) btnHigh.disabled = state.mystic < (state.role === ROLES.PROPHET ? 120 : 150);

  // 9. Render Reserve slots
  renderReserveSlots();
  updateConnectionsSVG();

  // 10. Update slots count usage
  const activeCount = state.board.slice(1).filter(s => s && s.terrain).length;
  const slotsCountEl = document.getElementById('slots-count-val');
  if (slotsCountEl) slotsCountEl.innerText = \`\${activeCount}/7\`;
}`
);

// O. Fix showResourceDetail, getResourceBreakdownList, showTrialApproachingModal, checkPolityUnlocks in the second half
// End prefix is "// Initialize Zoom and Pan Controls for the Board Map" to preserve DOMContentLoaded wrapper!
replaceRange(
  "// Sidebar military section removed\n}",
  "// Initialize Zoom and Pan Controls for the Board Map",
  `// Sidebar military section removed

function showResourceDetail(key) {
  const titleEl = document.getElementById('detail-title');
  const descEl = document.getElementById('detail-desc');
  const breakdownEl = document.getElementById('detail-breakdown');
  if (!titleEl || !descEl || !breakdownEl) return;

  document.getElementById('modal-resource-detail').style.display = 'flex';

  let title = "";
  let desc = "";
  let breakdown = "";

  if (key === 'fire') {
    title = "🔥 残り火 (Fire)";
    desc = "集落の生命活動を維持するための残り火。毎ターン終了時に一定量減少し、0 になるとゲームオーバーになります。<br><br>" +
           "・最大上限: 30 🔥<br>" +
           "・基本減衰: -1 🔥/ターン (保留エリアにカードが残っている場合、さらに -1 🔥 のペナルティがあります)<br>" +
           "  - 食料 500 以上: +1 🔥 (残り火増加)<br>" +
           "  - 食料 200 以上: 0 🔥 (残り火維持)<br>" +
           "  - 食料 200 未満: -1 🔥 (通常減衰)<br>" +
           "  - 開始時に食料 20 未満: -2 🔥 (飢餓による衰退)";
    
    const yields = state.calculateTotalProduction();
    breakdown = \`現在の備蓄量: <b>🔥 \${state.fire}</b><br>\` +
                \`現在の毎ターン総生産量: <b>🔥 +\${yields.fire || 0}</b>\`;
  }
  else if (key === 'food') {
    title = "🌾 食料 (Food)";
    desc = "民の生存や、残り火の減衰を抑えるために消費される資源です。備蓄量が多いと残り火が維持され、極端に不足すると飢餓ペナルティが発生します。<br><br>" +
           "・食料 500 以上: 毎ターン残り火 +1 🔥 (ボーナス)<br>" +
           "・食料 200 以上: 毎ターン残り火 0 🔥 (維持)<br>" +
           "・食料 200 未満: 毎ターン残り火 -1 🔥 (減少)<br>" +
           "・食料 20 未満: 毎ターン残り火 -2 🔥 (大減少)";
    
    const yields = state.calculateTotalProduction();
    breakdown = \`現在の備蓄量: <b>🌾 \${state.food}</b><br>\` +
                \`現在の毎ターン総生産量: <b>🌾 +\${yields.food}</b><br><br>\` +
                \`<b>生産内訳:</b><br>\` +
                getResourceBreakdownList('food');
  }
  else if (key === 'materials') {
    title = "🧱 資材 (Materials)";
    desc = "施設の建設や社会制度のアンロック、土地の結合やレベルアップなどに消費される重要な資源です。";
    
    const yields = state.calculateTotalProduction();
    breakdown = \`現在の備蓄量: <b>🧱 \${state.materials}</b><br>\` +
                \`現在の毎ターン総生産量: <b>🧱 +\${yields.materials}</b><br><br>\` +
                \`<b>生産内訳:</b><br>\` +
                getResourceBreakdownList('materials');
  }
  else if (key === 'defense') {
    title = "🛡️ 防衛力 (Defense)";
    desc = "試練で襲来する敵勢力から集落を守るための戦闘力。<b>防衛力は蓄積されず、毎ターン開始時に 0 にリセットされます。</b><br><br>" +
           "ターン終了時に土地や施設から生産される防衛力と、そのターン中に使用した軍事カードの効果の合計値が、そのターンの「総防衛力」となり、試練襲来時の防御判定に使用されます。";
    
    const yields = state.calculateTotalProduction();
    breakdown = \`現在の当ターン防衛力: <b>🛡️ \${state.defense}</b><br>\` +
                \`毎ターン自動で得られる生産量: <b>🛡️ +\${yields.defense}</b><br><br>\` +
                \`<b>生産内訳:</b><br>\` +
                getResourceBreakdownList('defense');
  }
  else if (key === 'mystic') {
    title = "✨ 神秘 (Mystic)";
    desc = "精霊との交信や奇跡の発動に必要な信仰力。一定値まで貯めることで、いつでも「神秘の奇跡」ボタンから強力なグローバル奇跡（予知、豊穣、神罰など）を発動できます。";
    
    const yields = state.calculateTotalProduction();
    breakdown = \`現在の備蓄量: <b>✨ \${state.mystic}</b><br>\` +
                \`現在の毎ターン総生産量: <b>✨ +\${yields.mystic}</b><br><br>\` +
                \`<b>生産内訳:</b><br>\` +
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
      listHtml += \`・スロット \${index} (\${terrainName}): +\${val}<br>\`;
    }
  });

  if (resourceKey === 'defense') {
    if (state.legacies.hardship_experience) {
      listHtml += \`・レガシー「不屈の精神」: +50<br>\`;
    }
    if (state.legacies.general_triumph) {
      listHtml += \`・レガシー「将軍の凱旋」: +30<br>\`;
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
    particle.style.left = \`\${40 + Math.random() * 20}%\`;
    particle.style.top = \`\${60 + Math.random() * 20}%\`;
    particle.style.width = \`\${4 + Math.random() * 8}px\`;
    particle.style.height = particle.style.width;
    particle.style.animationDelay = \`\${Math.random() * 0.8}s\`;
    overlay.appendChild(particle);
  }
  
  document.body.appendChild(overlay);
  setTimeout(() => {
    overlay.remove();
  }, 2500);
}

function triggerTurnStartBanner(turnNum) {
  const banner = document.createElement('div');
  banner.className = 'turn-start-banner';
  banner.innerText = \`TURN \${turnNum}\`;
  document.body.appendChild(banner);
  setTimeout(() => {
    banner.remove();
  }, 2200);
}

function showTrialApproachingModal() {
  const modal = el.modalGenericEvent;
  modal.style.display = 'flex';
  
  const imgEl = document.getElementById('generic-event-image');
  if (imgEl) {
    imgEl.style.backgroundImage = "url('images/crisis.png')";
  }
  
  document.getElementById('generic-event-icon').style.display = 'none';
  
  const title = \`⚠️ 警告：第 \${state.upcomingTrial.index} の試練襲来\`;
  const text = \`
    <div style="text-align: center; color: #f87171; font-weight: 800; font-size: 1.1rem; margin-bottom: 12px; animation: pulse 1s infinite;">
      ⚠️⚠️⚠️ 亜人軍勢の襲来が検知されました ⚠️⚠️⚠️
    </div>
    今ターン終了時に、集落の防衛力を問う「試練」が発生します！準備を怠れば国土の崩壊を招きます。<br><br>
    <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.3); font-size: 0.8rem; line-height: 1.6;">
      <b>⚔️ 襲来詳細:</b><br>
      ・予測敵戦力: <span style="color: #ef4444; font-weight: bold;">\${state.upcomingTrial.power}</span><br>
      ・敵戦術 (Tactic): <span style="color: #fca5a5; font-weight: bold;">\${state.upcomingTrial.tactic.name}</span><br>
      <span style="font-size: 0.72rem; color: #d1d5db;">・特殊効果: \${state.upcomingTrial.tactic.desc}</span>
    </div>
    <br>
    ※ドローカードから軍事防御カードをプレイするか、残り火を消費して施設建設や政体変更を行い、防衛力を極限まで高めてください。
  \`;
  
  document.getElementById('generic-event-title').innerText = title;
  document.getElementById('generic-event-text').innerHTML = text;
  
  const optionsDiv = document.getElementById('generic-event-options');
  optionsDiv.innerHTML = \`
    <button class="event-option-btn" id="btn-close-generic-event" style="background: linear-gradient(135deg, #ef4444 0%, #991b1b 100%); border-color: #f87171; box-shadow: 0 0 15px rgba(239, 68, 68, 0.4);">
      防衛体制を整える
    </button>
  \`;
  
  document.getElementById('btn-close-generic-event').onclick = () => {
    modal.style.display = 'none';
  };
}

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

// Bind click listeners for resource details modal
const resFireEl = document.getElementById('res-fire');
if (resFireEl) resFireEl.onclick = () => showResourceDetail('fire');
const totalFoodEl = document.getElementById('total-food');
const totalMatEl = document.getElementById('total-materials');
const totalDefEl = document.getElementById('total-defense');
const totalMysEl = document.getElementById('total-mystic');
if (totalFoodEl) totalFoodEl.onclick = () => showResourceDetail('food');
if (totalMatEl) totalMatEl.onclick = () => showResourceDetail('materials');
if (totalDefEl) totalDefEl.onclick = () => showResourceDetail('defense');
if (totalMysEl) totalMysEl.onclick = () => showResourceDetail('mystic');

// Bind click listeners for Mystic Miracles
const btnMiracleLow = document.getElementById('btn-miracle-low');
const btnMiracleMed = document.getElementById('btn-miracle-med');
const btnMiracleHigh = document.getElementById('btn-miracle-high');

if (btnMiracleLow) {
  btnMiracleLow.onclick = () => {
    let discount = state.role === ROLES.PROPHET ? 0.8 : 1.0;
    if (state.activePolity === 'theocracy') discount *= 0.9;
    const cost = Math.round(30 * discount);
    if (state.mystic < cost) return;
    state.adjustResource('mystic', -cost);
    triggerMysticMiracleFX();

    el.modalGenericEvent.style.display = 'flex';
    const imgEl = document.getElementById('generic-event-image');
    if (imgEl) imgEl.style.backgroundImage = "url('images/lake.png')";
    document.getElementById('generic-event-icon').style.display = 'none';
    document.getElementById('generic-event-title').innerText = '神秘の奇跡（初級）';
    document.getElementById('generic-event-text').innerText = '精霊の啓示を受け、一時的な支援を得る奇跡。';

    const container = document.getElementById('generic-event-options');
    container.innerHTML = \`
      <button class="event-option-btn" id="btn-mir-low-opt1">
        <span>予知の啓示（次の試練の襲来を +1 ターン遅らせる）</span>
      </button>
      <button class="event-option-btn" id="btn-mir-low-opt2">
        <span>戦士の鼓舞（当ターンのみ防衛力 +20）</span>
      </button>
    \`;

    document.getElementById('btn-mir-low-opt1').onclick = () => {
      state.upcomingTrial.turn += 1;
      state.addLog('奇跡発動：予知により次の試練の襲来時期が 1 ターン延期されました！', 'reward');
      el.modalGenericEvent.style.display = 'none';
      updateUI();
    };

    document.getElementById('btn-mir-low-opt2').onclick = () => {
      state.accumulatedDefense = (state.accumulatedDefense || 0) + 20;
      state.defense += 20;
      state.addLog('奇跡発動：戦士の士気が高まり、防衛力 +20 を獲得しました！', 'reward');
      el.modalGenericEvent.style.display = 'none';
      updateUI();
    };
  };
}

if (btnMiracleMed) {
  btnMiracleMed.onclick = () => {
    let discount = state.role === ROLES.PROPHET ? 0.8 : 1.0;
    if (state.activePolity === 'theocracy') discount *= 0.9;
    const cost = Math.round(70 * discount);
    if (state.mystic < cost) return;
    state.adjustResource('mystic', -cost);
    triggerMysticMiracleFX();

    el.modalGenericEvent.style.display = 'flex';
    const imgEl = document.getElementById('generic-event-image');
    if (imgEl) imgEl.style.backgroundImage = "url('images/lake.png')";
    document.getElementById('generic-event-icon').style.display = 'none';
    document.getElementById('generic-event-title').innerText = '神秘の奇跡（中級）';
    document.getElementById('generic-event-text').innerText = '大地の恵みを呼び覚まし、大いなる発展を遂げる奇跡。';

    const container = document.getElementById('generic-event-options');
    container.innerHTML = \`
      <button class="event-option-btn" id="btn-mir-med-opt1">
        <span>大地の豊穣（食料 +50、資材 +50 を獲得）</span>
      </button>
      <button class="event-option-btn" id="btn-mir-med-opt2">
        <span>天啓の知恵（未解禁の社会制度をランダムで1つ即座に解禁する）</span>
      </button>
    \`;

    document.getElementById('btn-mir-med-opt1').onclick = () => {
      state.adjustResource('food', 50);
      state.adjustResource('materials', 50);
      state.addLog('奇跡発動：大地の豊穣により食料 +50、資材 +50 を獲得しました！', 'reward');
      el.modalGenericEvent.style.display = 'none';
      updateUI();
    };

    document.getElementById('btn-mir-med-opt2').onclick = () => {
      const locked = [];
      Object.keys(state.policies).forEach(k => {
        if (!state.policies[k]) locked.push(k);
      });
      if (locked.length > 0) {
        const target = locked[Math.floor(Math.random() * locked.length)];
        state.policies[target] = true;
        checkPolityUnlocks(target);
        state.addLog(\`奇跡発動：天啓により社会制度「\${target}」が即時解禁されました！\`, 'reward');
      } else {
        state.adjustResource('materials', 100);
        state.addLog('奇跡発動：すべての制度が解禁済みなため、資材 +100 を獲得しました。', 'reward');
      }
      el.modalGenericEvent.style.display = 'none';
      updateUI();
    };
  };
}

if (btnMiracleHigh) {
  btnMiracleHigh.onclick = () => {
    let discount = state.role === ROLES.PROPHET ? 0.8 : 1.0;
    if (state.activePolity === 'theocracy') discount *= 0.9;
    const cost = Math.round(150 * discount);
    if (state.mystic < cost) return;
    state.adjustResource('mystic', -cost);
    triggerMysticMiracleFX();

    el.modalGenericEvent.style.display = 'flex';
    const imgEl = document.getElementById('generic-event-image');
    if (imgEl) imgEl.style.backgroundImage = "url('images/lake.png')";
    document.getElementById('generic-event-icon').style.display = 'none';
    document.getElementById('generic-event-title').innerText = '神秘 of 奇跡（上級）';
    document.getElementById('generic-event-text').innerText = '世界の残り火と一体となり、運命を改変する奇跡を引き起こします。';

    const container = document.getElementById('generic-event-options');
    container.innerHTML = \`
      <button class="event-option-btn" id="btn-mir-high-opt1">
        <span>神罰 of 雷（次の試練の敵戦闘力を -30% 永久低下させる）</span>
      </button>
      <button class="event-option-btn" id="btn-mir-high-opt2">
        <span>地殻の急成長（任意の土地1スロットを、即座に最大開発段階「レジェンダリ★4」へ昇格する）</span>
      </button>
    \`;

    document.getElementById('btn-mir-high-opt1').onclick = () => {
      state.upcomingTrial.basePower = Math.round(state.upcomingTrial.basePower * 0.7);
      state.upcomingTrial.power = Math.round(state.upcomingTrial.power * 0.7);
      state.addLog('奇跡発動：次の試練 of 敵戦闘力を 30% 減弱しました！', 'reward');
      el.modalGenericEvent.style.display = 'none';
      updateUI();
    };

    document.getElementById('btn-mir-high-opt2').onclick = () => {
      el.modalGenericEvent.style.display = 'none';
      state.addLog('奇跡発動：最大開発する土地を盤面からクリックしてください。', 'system');
      
      const slots = document.querySelectorAll('.board-slot');
      slots.forEach(slot => {
        const idx = parseInt(slot.dataset.slotIndex);
        const land = state.board[idx];
        if (land && land.terrain && !land.seaOccupied && idx !== 0) {
          slot.classList.add('highlight-attachment');
          slot.onclick = () => {
            land.devLevel = 4;
            updateLandRarity(land);
            state.addLog(\`奇跡適用：\${getTerrainDisplayName(land.terrain)} を最大開発段階（L★4）に昇格しました！\`, 'reward');
            triggerMergeFX(idx);
            
            slots.forEach(s => {
              s.classList.remove('highlight-attachment');
              s.onclick = null;
            });
            updateUI();
          };
        }
      });
    };
  };
}

// ==========================================================================
// Tooltip and Pop-up Menu Implementations
// ==========================================================================

function getDevLevelRarityName(level) {
  switch (level) {
    case 0: return 'コモン';
    case 1: return 'アンコモン';
    case 2: return 'レア';
    case 3: return 'エピック';
    case 4: return 'レジェンダリ';
    default: return 'ノーマル';
  }
}

function getRarityClass(level) {
  switch (level) {
    case 0: return 'c';
    case 1: return 'uc';
    case 2: return 'r';
    case 3: return 'r';
    case 4: return 'l';
    default: return 'c';
  }
}

function getCardCategoryName(type) {
  switch(type) {
    case CARD_CATEGORIES.LAND: return '土地タイル';
    case CARD_CATEGORIES.ATTRIBUTE: return '開拓アタッチメント';
    case CARD_CATEGORIES.CRISIS: return '試練・災厄';
    case CARD_CATEGORIES.SOCIETY: return '社会開発';
    case CARD_CATEGORIES.MYSTIC: return '神秘カード';
    case CARD_CATEGORIES.MILITARY: return '軍事カード';
    default: return 'その他';
  }
}

function showTooltip(e, contentHtml) {
  const tooltip = document.getElementById('game-tooltip');
  if (!tooltip) return;
  tooltip.innerHTML = contentHtml;
  tooltip.style.display = 'block';
  updateTooltipPosition(e);
}

function updateTooltipPosition(e) {
  const tooltip = document.getElementById('game-tooltip');
  if (!tooltip || tooltip.style.display === 'none') return;
  
  const tooltipWidth = tooltip.offsetWidth;
  const tooltipHeight = tooltip.offsetHeight;
  
  let x = e.clientX + 15;
  let y = e.clientY + 15;
  
  if (x + tooltipWidth > window.innerWidth) {
    x = e.clientX - tooltipWidth - 15;
  }
  if (y + tooltipHeight > window.innerHeight) {
    y = e.clientY - tooltipHeight - 15;
  }
  
  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';
}

function hideTooltip() {
  const tooltip = document.getElementById('game-tooltip');
  if (tooltip) tooltip.style.display = 'none';
}

function showPopoverMenu(e, options) {
  e.stopPropagation();
  const popover = document.getElementById('game-popover-menu');
  if (!popover) return;
  
  popover.innerHTML = '';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'popover-item';
    btn.innerHTML = opt.label;
    btn.disabled = !!opt.disabled;
    btn.onclick = (ev) => {
      ev.stopPropagation();
      opt.action();
      hidePopoverMenu();
    };
    popover.appendChild(btn);
  });
  
  popover.style.display = 'flex';
  
  // Force layout to apply transition
  popover.offsetHeight; 
  popover.classList.add('visible');
  
  const rect = popover.getBoundingClientRect();
  let x = e.clientX;
  let y = e.clientY;
  
  if (x + rect.width > window.innerWidth) {
    x = window.innerWidth - rect.width - 10;
  }
  if (y + rect.height > window.innerHeight) {
    y = window.innerHeight - rect.height - 10;
  }
  
  popover.style.left = x + 'px';
  popover.style.top = y + 'px';
}

function hidePopoverMenu() {
  const popover = document.getElementById('game-popover-menu');
  if (popover) {
    popover.classList.remove('visible');
    setTimeout(() => {
      popover.style.display = 'none';
    }, 150);
  }
}

// Global click/contextmenu listeners to close popover
window.addEventListener('click', hidePopoverMenu);
window.addEventListener('contextmenu', hidePopoverMenu);

// Card tooltip helpers
function showCardTooltip(e, card) {
  let rarityName = 'コモン';
  if (card.rarity === 'uc') rarityName = 'アンコモン';
  else if (card.rarity === 'r') rarityName = 'レア';
  else if (card.rarity === 'l') rarityName = 'レジェンダリ';
  
  const html = \`
    <div class="tooltip-header">
      <span>\${card.name}</span>
      <span class="card-rarity-badge rarity-\${card.rarity}">\${rarityName}</span>
    </div>
    <div class="tooltip-body">
      <div><strong>種別:</strong> \${getCardCategoryName(card.type)}</div>
      <div style="margin-top: 4px; color: #d1d5db;">\${card.desc}</div>
    </div>
  \`;
  showTooltip(e, html);
}

function showBoardSlotTooltip(e, slot, index) {
  if (!slot || !slot.terrain) {
    hideTooltip();
    return;
  }
  
  const yields = state.calculateLandYield(slot);
  const terrainName = index === 0 ? state.getPalaceName() : getTerrainDisplayName(slot.terrain, slot.attribute);
  const rarityName = getDevLevelRarityName(slot.devLevel);
  
  let html = \`
    <div class="tooltip-header">
      <span>\${terrainName}</span>
      <span class="card-rarity-badge rarity-\${getRarityClass(slot.devLevel)}">★\${slot.devLevel} (\${rarityName})</span>
    </div>
    <div class="tooltip-body">
  \`;
  
  if (slot.attribute) {
    html += \`<div class="tooltip-yield-item">属性: \${getAttributeName(slot.attribute)}</div>\`;
  }
  if (slot.bonus) {
    html += \`<div class="tooltip-yield-item">資源: \${getBonusName(slot.bonus)}</div>\`;
  }
  if (slot.facility) {
    html += \`<div class="tooltip-yield-item" style="color: #fbbf24;">建設済み施設: \${getFacilityName(slot.facility)}</div>\`;
  }
  
  html += \`
    </div>
    <div class="tooltip-yields">
      <div class="tooltip-yield-item">🌾 食料: +\${yields.food}</div>
      <div class="tooltip-yield-item">🧱 資材: +\${yields.materials}</div>
      <div class="tooltip-yield-item">🛡️ 防衛力: +\${yields.defense}</div>
      <div class="tooltip-yield-item">✨ 神秘: +\${yields.mystic}</div>
    </div>
  \`;
  
  showTooltip(e, html);
}

function reserveCardFromOffering(index, card) {
  const emptyIdx = state.reserve.indexOf(null);
  if (emptyIdx === -1) {
    state.addLog('保留スロットに空きがありません！', 'warning');
    return;
  }
  state.reserve[emptyIdx] = card;
  state.offerings[index] = null;
  state.drawnThisTurn = true;
  state.addLog(\`カード「\${card.name}」を保留スロット \${emptyIdx + 1} に送りました。\`, 'system');
  sound.playClick();
  
  selectedOffering = null;
  selectedOfferingSource = null;
  selectedOfferingIndex = null;
  clearHighlights();
  updateUI();
}

function smeltCard(source, index) {
  let card = null;
  if (source === 'offering') {
    card = state.offerings[index];
    state.offerings[index] = null;
    state.drawnThisTurn = true;
  } else if (source === 'reserve') {
    card = state.reserve[index];
    state.reserve[index] = null;
  }
  
  if (card) {
    state.adjustResource('fire', 1);
    state.addLog(\`手札還元：カード「\${card.name}」を還元し、残り火 +1 🔥 を獲得しました。\`, 'system');
    sound.playClick();
  }
  
  selectedOffering = null;
  selectedOfferingSource = null;
  selectedOfferingIndex = null;
  clearHighlights();
  updateUI();
}
`
);

// Write final code to game/src/main.js
const targetFile = path.join(__dirname, 'game', 'src', 'main.js');
fs.writeFileSync(targetFile, code, 'utf8');
console.log('Wrote final main.js!');

// Test parse
let testCode = code;
testCode = testCode.replace(/import\s+[\s\S]*?from\s+['"].*?['"];/g, (match) => {
  return '/* ' + match.replace(/\*\//g, '* /') + ' */';
});
testCode = testCode.replace(/\bexport\s+/g, '');

try {
  new vm.Script(testCode, { filename: 'main.js' });
  console.log('SUCCESS: final main.js parsed perfectly with NO syntax errors!');
} catch (err) {
  console.error('PARSE ERROR:', err.stack);
}
