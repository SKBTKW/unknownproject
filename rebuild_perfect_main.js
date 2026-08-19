const fs = require('fs');
const path = require('path');

// 1. Load reconstructed clean template
const templatePath = path.join(__dirname, 'game', 'src', 'main_reconstructed.js');
let code = fs.readFileSync(templatePath, 'utf8');

// Helper to replace a function by its signature
function replaceFunction(signature, body) {
  const startIdx = code.indexOf(signature);
  if (startIdx === -1) {
    console.error(`Failed to locate signature: ${signature}`);
    process.exit(1);
  }
  
  let openBraces = 0;
  let endIdx = -1;
  let codeStarted = false;
  
  for (let i = startIdx; i < code.length; i++) {
    if (code[i] === '{') {
      openBraces++;
      codeStarted = true;
    } else if (code[i] === '}') {
      openBraces--;
      if (codeStarted && openBraces === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }
  
  if (endIdx === -1) {
    console.error(`Failed to find closing brace for signature: ${signature}`);
    process.exit(1);
  }
  
  code = code.slice(0, startIdx) + body + code.slice(endIdx);
  console.log(`Replaced function: ${signature.split('\n')[0]}`);
}

// 2. Perform replacements
// A. getCardDevLevel
replaceFunction('function getCardDevLevel(card) {', `function getCardDevLevel(card) {
  return 0;
}`);

// B. el elements definition (Robust implementation)
const elStartIdx = code.indexOf('const el = {');
const elSearchIdx = code.indexOf('btnStartBattle:');
if (elStartIdx === -1 || elSearchIdx === -1) {
  console.error('Failed to locate el elements block boundaries');
  process.exit(1);
}
const elEndIdx = code.indexOf('};', elSearchIdx) + 2;

code = code.slice(0, elStartIdx) + `const el = {
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
  
  cardOfferingsZone: document.getElementById('card-offerings-zone'),
  interactionTitle: document.getElementById('interaction-title'),
  btnMulligan: document.getElementById('btn-mulligan'),
  btnDrawExtra: document.getElementById('btn-draw-extra'),
  
  landGrid: document.getElementById('land-grid'),
  logConsole: document.getElementById('log-console'),
  
  // Miracles
  btnMiracleFertilizer: document.getElementById('btn-miracle-fertilizer'),
  btnMiracleRain: document.getElementById('btn-miracle-rain'),
  btnMiracleDiscovery: document.getElementById('btn-miracle-discovery'),
  btnMiracleBlessing: document.getElementById('btn-miracle-blessing'),
  
  // Modals
  modalGenericEvent: document.getElementById('modal-generic-event'),
  modalRiverEvent: document.getElementById('modal-river-event'),
  modalRoleSelect: document.getElementById('modal-role-select'),
  modalTrialResult: document.getElementById('modal-trial-result'),
  modalGameOver: document.getElementById('modal-game-over'),
  
  // Palace Menu Modals
  modalPalaceMenu: document.getElementById('modal-palace-menu'),
  modalSocialTree: document.getElementById('modal-social-tree'),
  modalPolitySelect: document.getElementById('modal-polity-select'),
  modalFacilitiesBuild: document.getElementById('modal-facilities-build'),
  
  // Trigger buttons inside Palace Menu
  btnOpenSocial: document.getElementById('btn-palace-open-social'),
  btnOpenPolity: document.getElementById('btn-palace-open-polity'),
  btnOpenFacilities: document.getElementById('btn-palace-open-facilities'),
  
  // Close buttons
  btnClosePalaceMenu: document.getElementById('btn-close-palace-menu'),
  btnCloseSocial: document.getElementById('btn-close-social'),
  btnClosePolity: document.getElementById('btn-close-polity'),
  btnCloseFacilities: document.getElementById('btn-close-facilities'),
  
  // River panels
  riverExpeditionPanel: document.getElementById('river-expedition-panel'),
  btnRiverExpedition: document.getElementById('btn-river-expedition'),
  
  // Raid & Trial Battle Modals
  modalRaidEvent: document.getElementById('modal-raid-event'),
  raidEventText: document.getElementById('raid-event-text'),
  raidEventActions: document.getElementById('raid-event-actions'),
  modalTrialBattle: document.getElementById('modal-trial-battle'),
  trialBattleTitle: document.getElementById('trial-battle-title'),
  trialBattleTactic: document.getElementById('trial-battle-tactic'),
  trialBattlePower: document.getElementById('trial-battle-power'),
  trialBattlefieldsContainer: document.getElementById('trial-battlefields-container'),
  trialCombatLogZone: document.getElementById('trial-combat-log-zone'),
  btnStartBattle: document.getElementById('btn-start-battle')
}` + code.slice(elEndIdx);
console.log('Replaced block el elements definition');

// C. startTurn
replaceFunction('function startTurn() {', `function startTurn() {
  const yields = state.calculateTotalProduction();
  state.defense = yields.defense + state.accumulatedDefense;
  state.drawnThisTurn = false;
  state.additionalDrawsCount = 0;
  selectedOffering = null;
  activeAttachmentCard = null;
  activeLandCardToPlace = null;
  activeFacilityToPlace = null;
  selectedMergeSlotAIndex = null;

  // Visual turn start banner
  triggerTurnStartBanner(state.currentTurn);

  // 1. Process Disaster Turn decays
  state.board.forEach(land => {
    if (land && land.disasterTurns > 0) {
      land.disasterTurns--;
      if (land.disasterTurns === 0) {
        state.addLog(\`土地 (\${getTerrainDisplayName(land.terrain, land.attribute)}) の災害被害が復興しました。生産力が元に戻ります。\`, 'system');
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
}`);

// D. checkRaidTrigger & triggerRaidEvent
const checkRaidStart = code.indexOf('function checkRaidTrigger() {');
const drawOfferingsStart = code.indexOf('function triggerDrawOfferings() {');
if (checkRaidStart === -1 || drawOfferingsStart === -1) {
  console.error('Failed to locate checkRaidTrigger/triggerDrawOfferings boundaries');
  process.exit(1);
}
code = code.slice(0, checkRaidStart) + `function checkRaidTrigger() {
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
  btnNone.innerHTML = \`🛡️ <strong>戦術なし (防衛施設と地形のみ)</strong><br><span style="font-size: 0.65rem; opacity: 0.85;">何の戦術も取らずに、防衛力のみで耐えます。</span>\`;
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

` + code.slice(drawOfferingsStart);
console.log('Replaced checkRaidTrigger & triggerRaidEvent block');

// E. initGlobalDragAndDropListeners
replaceFunction('function initGlobalDragAndDropListeners() {', `function initGlobalDragAndDropListeners() {
  // Bind Reserve slots
  document.querySelectorAll('.reserve-slot').forEach(slot => {
    const idx = parseInt(slot.dataset.reserveIndex);
    
    slot.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (state.reserve[idx] === null && (draggedSourceType === 'offering' || draggedSourceType === 'board')) {
        slot.classList.add('drag-over');
      }
    });

    slot.addEventListener('dragleave', () => {
      slot.classList.remove('drag-over');
    });

    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      slot.classList.remove('drag-over');
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
    if (draggedCard && draggedCard.type === CARD_CATEGORIES.LAND) {
      el.landGrid.classList.add('highlight-placement');
    }
    if (draggedSourceType === 'board') {
      const rect = el.landGrid.getBoundingClientRect();
      const x = Math.max(8, Math.min(92, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(8, Math.min(92, ((e.clientY - rect.top) / rect.height) * 100));
      state.board[draggedSourceIndex].x = x;
      state.board[draggedSourceIndex].y = y;
      const slotEl = document.querySelector(\`.board-slot.slot-\${draggedSourceIndex}\`);
      if (slotEl) {
        slotEl.style.transition = 'none';
        slotEl.style.left = \`\${x}%\`;
        slotEl.style.top = \`\${y}%\`;
      }
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
    const x = Math.max(8, Math.min(92, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(8, Math.min(92, ((e.clientY - rect.top) / rect.height) * 100));
    if (draggedSourceType === 'offering' || draggedSourceType === 'reserve') {
      handlePlaceLandAtCoords(draggedCard, x, y);
    }
  });

  // Bind click outside to close draft selection
  document.addEventListener('click', () => {
    if (selectedOffering !== null || activeAttachmentCard !== null || activeLandCardToPlace !== null || activeFacilityToPlace !== null) {
      endDrawPhase();
      updateUI();
    }
  });

  // Zoom / Pan binds for 3D container
  const container = el.landGrid;
  container.addEventListener('click', (e) => {
    if (selectedOffering && selectedOffering.type === CARD_CATEGORIES.LAND) {
      const rect = container.getBoundingClientRect();
      const x = Math.max(8, Math.min(92, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(8, Math.min(92, ((e.clientY - rect.top) / rect.height) * 100));
      handlePlaceLandAtCoords(selectedOffering, x, y);
    }
  });

  // Bind Palace Menu open triggers
  el.btnOpenSocial.onclick = () => {
    sound.playClick();
    el.modalPalaceMenu.style.display = 'none';
    el.modalSocialTree.style.display = 'flex';
    renderPolicyTree(state, unlockPolicy);
  };
  el.btnOpenPolity.onclick = () => {
    sound.playClick();
    el.modalPalaceMenu.style.display = 'none';
    el.modalPolitySelect.style.display = 'flex';
    renderPolitySelect();
  };
  el.btnOpenFacilities.onclick = () => {
    sound.playClick();
    el.modalPalaceMenu.style.display = 'none';
    el.modalFacilitiesBuild.style.display = 'flex';
    renderFacilities(state, buildFacility);
  };

  // Bind Palace Menu close triggers
  el.btnClosePalaceMenu.onclick = () => {
    sound.playClick();
    el.modalPalaceMenu.style.display = 'none';
  };
  el.btnCloseSocial.onclick = () => {
    sound.playClick();
    el.modalSocialTree.style.display = 'none';
    el.modalPalaceMenu.style.display = 'flex';
  };
  el.btnClosePolity.onclick = () => {
    sound.playClick();
    el.modalPolitySelect.style.display = 'none';
    el.modalPalaceMenu.style.display = 'flex';
  };
  el.btnCloseFacilities.onclick = () => {
    sound.playClick();
    el.modalFacilitiesBuild.style.display = 'none';
    el.modalPalaceMenu.style.display = 'flex';
  };

  // Bind River Expedition triggers
  el.btnRiverExpedition.onclick = () => {
    sound.playClick();
    const step = state.riverExpedition.step;
    if (step === 0) {
      triggerRiverExpeditionModal(1);
    } else if (step === 1 && state.currentTurn >= 20) {
      triggerRiverExpeditionModal(2);
    } else if (step === 2 && state.currentTurn >= 28) {
      triggerRiverExpeditionModal(3);
    }
  };
}`);

// F. handleBoardSlotClick
replaceFunction('function handleBoardSlotClick(index) {', `function handleBoardSlotClick(index) {
  const slot = state.board[index];
  
  // Clicking slot 0 (Command HQ / Palace) opens the Palace Menu popup
  if (index === 0) {
    sound.playClick();
    el.modalPalaceMenu.style.display = 'flex';
    return;
  }

  // 1. Direct Merge candidates selecting
  if (selectedMergeSlotAIndex !== null) {
    if (index === selectedMergeSlotAIndex) {
      // Cancel selection
      selectedMergeSlotAIndex = null;
      updateUI();
      return;
    }
    
    // Check if slot B is a valid merge candidate
    const slotA = state.board[selectedMergeSlotAIndex];
    if (slot.terrain === slotA.terrain && index !== 0) {
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
    slot.terrain = selectedOffering.terrain;
    slot.attribute = selectedOffering.attribute || null;
    slot.bonus = selectedOffering.bonus || null;
    slot.devLevel = 0;
    slot.isNew = true;
    removeDraggedCardFromSource();
    state.addLog(\`スロット \${index} に \${getTerrainDisplayName(selectedOffering.terrain, selectedOffering.attribute)} を配置しました (-\${cost} 🔥)。このターンは産出なし。\`, 'action');
    triggerMergeFX(index);
    endDrawPhase();
    updateUI();
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
    selectedMergeSlotAIndex = index;
    updateUI();
  }
}`);

// G. executeMerge
replaceFunction('function executeMerge(idxA, idxB, selectedTraits, cost) {', `function executeMerge(idxA, idxB, selectedTraits, cost) {
  state.adjustResource('fire', -cost);

  const slotA = state.board[idxA];
  const slotB = state.board[idxB];

  // Apply traits (attribute, bonus) to slotB (target slot)
  slotB.attribute = null;
  slotB.bonus = null;
  selectedTraits.forEach(t => {
    if (t.type === 'attr') slotB.attribute = t.val;
    if (t.type === 'bonus') slotB.bonus = t.val;
  });

  // Upgrade target slot (slotB) dev level
  slotB.devLevel += 1;
  updateLandRarity(slotB);

  // Release source slot (slotA)
  slotA.terrain = null;
  slotA.attribute = null;
  slotA.bonus = null;
  slotA.devLevel = 0;
  slotA.rarity = 'c';
  slotA.x = null;
  slotA.y = null;

  state.addLog(\`開拓結合：\${getTerrainDisplayName(slotB.terrain)} (スロット \${idxB}) を ★\${slotB.devLevel} に強化しました！スロット \${idxA} は解放されました。 (-\${cost} 🔥)\`, 'action');

  triggerMergeFX(idxB);
  closeMergeDialog();
  endDrawPhase();
  updateUI();
}`);

// H. resolveImmediateEvent
replaceFunction('function resolveImmediateEvent(card) {', `function resolveImmediateEvent(card) {
  let title = card.name;
  let text = "";
  let img = "plains.png"; // default
  
  if (card.type === CARD_CATEGORIES.MYSTIC) img = "lake.png";
  if (card.type === CARD_CATEGORIES.MILITARY) img = "mountains.png";
  if (card.type === CARD_CATEGORIES.CRISIS) img = "crisis.png";

  if (card.id === 'soc-migration') {
    state.adjustResource('food', 30);
    state.adjustResource('fire', 3);
    text = "平野に集まった移民たちが残り火の周囲で結束しました。食料+30、残り火+3を獲得します。(🌾+30, 🔥+3)";
  } 
  else if (card.id === 'soc-trade') {
    let randVal = Math.random() < 0.5;
    if (randVal) {
      state.adjustResource('food', 35);
      text = "交易商人から大量の穀物と乾物を買い付けました。食料+35、神秘+5を獲得。(🌾+35, ✨+5)";
    } else {
      state.adjustResource('materials', 30);
      text = "交易路から貴重な建築資材や木石を調達しました。資材+30、神秘+5を獲得。(🧱+30, ✨+5)";
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
      state.reserve[emptyIdx] = { ...freeCard, instanceId: \`\${freeCard.id}-\${Date.now()}\` };
      milCardText = \`無料の軍事カード「\${freeCard.name}」が保留スロット \${emptyIdx + 1} に追加されました。\`;
    }
    text = \`試練を防御した志願兵たちが残り火と安全をもたらしました。残り火+5、防衛力+50を獲得。さらに\${milCardText} (🔥+5, 🛡️+50)\`;
  } 
  else if (card.id === 'soc-prophet') {
    state.adjustResource('mystic', 10);
    let mysCardText = "保留ゾーンが満杯のため神秘カードを獲得できませんでした。";
    const emptyIdx = state.reserve.indexOf(null);
    if (emptyIdx !== -1) {
      const mysPool = CARD_DATABASE[CARD_CATEGORIES.MYSTIC];
      const freeCard = mysPool[Math.floor(Math.random() * mysPool.length)];
      state.reserve[emptyIdx] = { ...freeCard, instanceId: \`\${freeCard.id}-\${Date.now()}\` };
      mysCardText = \`無料の神秘カード「\${freeCard.name}」が保留スロット \${emptyIdx + 1} に追加されました。\`;
    }
    text = \`預言者の大いなる啓示により、神秘+10を獲得。さらに\${mysCardText} (✨+10)\`;
  } 
  else if (card.id === 'soc-clearing') {
    state.adjustResource('food', 25);
    const eligibleSlots = state.board.filter((l, idx) => l && l.terrain && idx !== 0 && (l.terrain === TERRAINS.PLAINS || l.terrain === TERRAINS.HILLS));
    let devText = "対象となる土地がないため開発度は上昇しませんでした。";
    if (eligibleSlots.length > 0) {
      const targetSlot = eligibleSlots[Math.floor(Math.random() * eligibleSlots.length)];
      targetSlot.devLevel = Math.min(4, targetSlot.devLevel + 1);
      updateLandRarity(targetSlot);
      devText = \`さらに、\${getTerrainDisplayName(targetSlot.terrain, targetSlot.attribute)} の開発度が ★\${targetSlot.devLevel} に上昇し、観察データを持ち帰りました。次の試練の敵戦力が 30 低下します。(🛡️+20, 敵戦力-30)\`;
    }
    text = \`開墾を行い、食料+25。\${devText} (🌾+25)\`;
  } 
  else if (card.id === 'mil-recruits') {
    state.adjustResource('food', -15);
    state.adjustResource('defense', 40);
    text = "若者たちが志願し、防衛義勇兵の訓練が開始されました。防衛力が 40 向上します。(🌾-15, 🛡️+40)";
  } 
  else if (card.id === 'mil-fortify') {
    state.adjustResource('materials', -15);
    state.adjustResource('defense', 45);
    text = "防壁の土台に石材を補強し、要塞の防御力をさらに高めました。防衛力が 45 向上します。(🧱-15, 🛡️+45)";
  } 
  else if (card.id === 'mil-tactician') {
    state.adjustResource('food', -25);
    state.adjustResource('materials', -25);
    state.adjustResource('defense', 100);
    text = "希代の戦術家を軍師として招聘しました。防衛軍の組織力が飛躍的に向上します！(🌾-25, 🧱-25, 🛡️+100)";
  }

  showGrandEventModal(title, text, img, () => {
    endDrawPhase();
    updateUI();
  });
}`);

// I. runTrialPhase & renderTrialBattleModal & runTrialCombatResolution
// We'll replace starting from function runTrialPhase down to the end of runTrialCombatResolution
const trialPhaseStartIdx = code.indexOf('function runTrialPhase() {');
const trialResultModalStartIdx = code.indexOf('function showTrialResultModal(trialResult) {');
if (trialPhaseStartIdx === -1 || trialResultModalStartIdx === -1) {
  console.error('Failed to locate trialPhase/trialResultModal boundaries');
  process.exit(1);
}
code = code.slice(0, trialPhaseStartIdx) + `function runTrialPhase() {
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

` + code.slice(trialResultModalStartIdx);
console.log('Replaced trial phase block');

// 3. Save to target file
const targetFilePath = path.join(__dirname, 'game', 'src', 'main.js');
fs.writeFileSync(targetFilePath, code, 'utf8');
console.log('Successfully wrote the clean game/src/main.js!');
