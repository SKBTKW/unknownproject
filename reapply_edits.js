const fs = require('fs');
const path = require('path');

// 1. Read clean_main.js (the clean, non-mojibake file from step < 4600)
const cleanPath = path.join(__dirname, 'game', 'src', 'clean_main.js');
let code = fs.readFileSync(cleanPath, 'utf8');

// Helper to replace content safely
function replaceSafe(target, replacement) {
  if (!code.includes(target)) {
    console.error(`Failed to locate target string:\n${target.slice(0, 100)}...`);
    process.exit(1);
  }
  code = code.split(target).join(replacement);
  console.log(`Replaced successfully!`);
}

// 2. Apply Edits in order
// A. Imports (Remove executeRaidPenalty and executeDisaster, add resolveRaidCombat)
replaceSafe(
  "import { selectTrialBattlefields, calculateBattlefieldDefense, calculateTotalDefense, resolveTrialCombat, executeRaidPenalty, getTrialSettings, executeDisaster, updateTrialPreview } from './trials.js';",
  "import { selectTrialBattlefields, calculateBattlefieldDefense, calculateTotalDefense, resolveTrialCombat, getTrialSettings, updateTrialPreview, PLAYER_TACTICS, resolveRaidCombat } from './trials.js';"
);

// B. getCardDevLevel (Start level force to 0)
replaceSafe(
  `function getCardDevLevel(card) {
  if (!card) return 0;
  if (card.devLevel !== undefined) return card.devLevel;
  if (card.rarity === 'l') return 3;
  if (card.rarity === 'r') return 2;
  if (card.rarity === 'uc') return 1;
  return 0;
}`,
  `function getCardDevLevel(card) {
  return 0;
}`
);

// C. el definition additions (Palace Menu modals & Raid/Trial panels)
replaceSafe(
  `  btnDrawExtra: document.getElementById('btn-draw-extra'),
  btnMulligan: document.getElementById('btn-mulligan'),
  btnOpenSocial: document.getElementById('btn-open-social'),
  btnEndTurn: document.getElementById('btn-end-turn'),`,
  `  btnDrawExtra: document.getElementById('btn-draw-extra'),
  btnMulligan: document.getElementById('btn-mulligan'),
  btnOpenSocial: document.getElementById('btn-palace-open-social'),
  btnEndTurn: document.getElementById('btn-end-turn'),`
);

replaceSafe(
  `  // Polity Modals
  btnOpenPolity: document.getElementById('btn-open-polity'),
  modalPolitySelect: document.getElementById('modal-polity-select'),
  btnClosePolity: document.getElementById('btn-close-polity'),
  currentPolityStatusCard: document.getElementById('current-polity-status-card'),
  polityOptionsList: document.getElementById('polity-options-list'),

  // Raid & Trial Battle Modals
  modalRaidEvent: document.getElementById('modal-raid-event'),
  raidEventText: document.getElementById('raid-event-text'),
  raidEventActions: document.getElementById('raid-event-actions'),
  modalTrialBattle: document.getElementById('modal-trial-battle'),
  trialBattleTitle: document.getElementById('trial-battle-title'),
  trialBattleTactic: document.getElementById('trial-battle-tactic'),
  trialBattlePower: document.getElementById('trial-battle-power'),
  trialUnassignedSoldiers: document.getElementById('trial-unassigned-soldiers'),
  trialBattlefieldsContainer: document.getElementById('trial-battlefields-container'),
  trialCombatLogZone: document.getElementById('trial-combat-log-zone'),
  btnStartBattle: document.getElementById('btn-start-battle'),
  btnConscriptTrial: document.getElementById('btn-conscript-trial'),
  btnConscriptSidebar: document.getElementById('btn-conscript-sidebar')
};`,
  `  // Polity Modals
  btnOpenPolity: document.getElementById('btn-palace-open-polity'),
  btnOpenFacilities: document.getElementById('btn-palace-open-facilities'),
  modalPolitySelect: document.getElementById('modal-polity-select'),
  btnClosePolity: document.getElementById('btn-close-polity'),
  currentPolityStatusCard: document.getElementById('current-polity-status-card'),
  polityOptionsList: document.getElementById('polity-options-list'),

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
};`
);

// D. startTurn (Remove disaster queued trigger, add Demihuman Raids triggers)
replaceSafe(
  `  // 4. Update trial alerts
  updateTrialPreview(state);
  resolveTrialCountdown();

  // 5. Trigger downstream river search if applicable
  checkRiverExpeditionEvents();

  // 6. Check if a trial is scheduled for the END of this turn!
  if (state.currentTurn === state.upcomingTrial.turn) {
    showTrialApproachingModal();
  }

  updateUI();
}`,
  `  // 4. Update trial alerts
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
}`
);

// E. handleBoardSlotClick (Palace Menu click at index 0)
replaceSafe(
  `function handleBoardSlotClick(index) {
  const slot = state.board[index];`,
  `function handleBoardSlotClick(index) {
  const slot = state.board[index];

  if (index === 0) {
    if (!activeFacilityToPlace && !activeLandCardToPlace && !activeAttachmentCard) {
      document.getElementById('modal-palace-menu').style.display = 'flex';
    }
    return;
  }`
);

// F. executeMerge dialog confirm callback index parameter fix
replaceSafe(
  `  el.btnConfirmMerge.onclick = () => {
    executeMerge(idxA, idxB, selectedTraits, mergeCost);
    closeMergeDialog();
  };`,
  `  el.btnConfirmMerge.onclick = () => {
    executeMerge(idxB, idxA, selectedTraits, mergeCost);
    closeMergeDialog();
  };`
);

// G. executeMerge implementation (upgrade idxB target, clear idxA source slot with coords to null)
replaceSafe(
  `function executeMerge(idxA, idxB, selectedTraits, cost) {
  state.adjustResource('fire', -cost);
  
  const landA = state.board[idxA];
  const landB = state.board[idxB];

  // 1. Upgrade Rarity/Dev level of land A
  landA.devLevel = Math.min(4, landA.devLevel + 1);
  updateLandRarity(landA);

  // 2. Set chosen traits
  const hasDupAttr = selectedTraits.length === 2 && 
                     selectedTraits[0].type === 'attr' && 
                     selectedTraits[1].type === 'attr' && 
                     selectedTraits[0].val === selectedTraits[1].val;
  const hasDupBonus = selectedTraits.length === 2 && 
                      selectedTraits[0].type === 'bonus' && 
                      selectedTraits[1].type === 'bonus' && 
                      selectedTraits[0].val === selectedTraits[1].val;

  landA.attribute = null;
  landA.bonus = null;

  selectedTraits.forEach(t => {
    if (t.type === 'attr') landA.attribute = t.val;
    if (t.type === 'bonus') landA.bonus = t.val;
  });

  landA.dupAttr = hasDupAttr;
  landA.dupBonus = hasDupBonus;

  // Verify capacity after merge and destroy facility if it exceeds capacity
  const newCapacity = state.getSlotCapacity(landA);
  const occupied = state.getSlotOccupiedCount(landA);
  if (occupied > newCapacity) {
    const oldFac = landA.facility;
    landA.facility = null;
    state.addLog(\`注意：容量低下により、施設「\${getFacilityName(oldFac)}」が崩壊・撤去されました。\`, 'warning');
  }

  // 3. Clear land B (merging removes B)
  landB.terrain = null;
  landB.attribute = null;
  landB.bonus = null;
  landB.facility = null;
  landB.devLevel = 0;
  landB.disasterTurns = 0;
  landB.damagedTurns = 0;
  landB.overlayLevel = 0;
  landB.isNew = false;

  // Calculate and immediately produce yield with the developed parameters
  const landYield = state.calculateLandYield(landA);
  state.adjustResource('food', landYield.food);
  state.adjustResource('materials', landYield.materials);
  state.adjustResource('defense', landYield.defense);
  state.adjustResource('mystic', landYield.mystic);

  state.addLog(\`土地開発：スロット \${idxA} と \${idxB} を結合し、開発度★ \${landA.devLevel} へ強化しました (-\${cost} 🔥)。開発時即時産出：🌾 +\${landYield.food} / 🧱 +\${landYield.materials} / 🛡️ +\${landYield.defense} / ✨ +\${landYield.mystic}\`, 'reward');
  triggerMergeFX(idxA);
  
  updateUI();
}`,
  `function executeMerge(targetIdx, sourceIdx, selectedTraits, cost) {
  state.adjustResource('fire', -cost);
  
  const landTarget = state.board[targetIdx];
  const landSource = state.board[sourceIdx];

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

  // 3. Clear landSource (consumed) and free up its board slot fully by resetting coordinates to null
  landSource.terrain = null;
  landSource.attribute = null;
  landSource.bonus = null;
  landSource.facility = null;
  landSource.devLevel = 0;
  landSource.disasterTurns = 0;
  landSource.damagedTurns = 0;
  landSource.overlayLevel = 0;
  landSource.isNew = false;
  landSource.x = null;
  landSource.y = null;

  // Calculate and immediately produce yield
  const landYield = state.calculateLandYield(landTarget);
  state.adjustResource('food', landYield.food);
  state.adjustResource('materials', landYield.materials);
  state.adjustResource('defense', landYield.defense);
  state.adjustResource('mystic', landYield.mystic);

  state.addLog(\`土地開発：スロット \${targetIdx} を開発度★ \${landTarget.devLevel} へ強化しました (-\${cost} 🔥)。開発時即時産出：🌾 +\${landYield.food} / 🧱 +\${landYield.materials} / 🛡️ +\${landYield.defense} / ✨ +\${landYield.mystic}\`, 'reward');
  triggerMergeFX(targetIdx);
  
  updateUI();
}`
);

// H. initGlobalDragAndDropListeners (Palace modals open/close and facilities open)
replaceSafe(
  `// Open and Close Social Tree Modal
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
});`,
  `// Open and Close Social Tree Modal
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
});`
);

// I. updateUI - remove soldiers auto-replenishment & logs from end turn
replaceSafe(
  `  // 3.5. Soldiers auto-replenishment (volunteers and barracks)
  let replenishedSoldiersCount = 0;
  if (state.facilities.barracks) {
    if (state.soldiers.length < state.soldierCapacity) {
      state.soldiers.push({
        id: state.nextSoldierId++,
        xp: 0,
        level: 1
      });
      replenishedSoldiersCount++;
    }
  } else if (state.soldiers.length === 0) {
    // Volunteer fallback
    state.soldiers.push({
      id: state.nextSoldierId++,
      xp: 0,
      level: 1
    });
    replenishedSoldiersCount++;
  }
  if (replenishedSoldiersCount > 0) {
    state.addLog(\`軍備：集落防衛のための義勇兵（兵士トークン）が \${replenishedSoldiersCount} 名補充されました。\`, 'system');
  }`,
  `  // 3.5. Soldiers auto-replenishment removed`
);

// J. runTrialPhase / renderTrialBattleModal / runTrialCombatResolution (tactics dropdown)
const trialPhaseOld = `// Execute Trial
function runTrialPhase() {
  const battlefields = selectTrialBattlefields(state);
  const tactic = state.upcomingTrial.tactic;
  const unassignedSoldiers = [...state.soldiers];

  // Show battle modal
  el.modalTrialBattle.style.display = 'flex';
  el.trialCombatLogZone.style.display = 'none';
  el.btnStartBattle.style.display = 'block';
  el.btnConscriptTrial.style.display = 'block';

  renderTrialBattleModal(battlefields, unassignedSoldiers, tactic);
}`;

// Since runTrialPhase has some variations in logs, we'll locate it by scanning and replacing down to showTrialResultModal
const startIdx = code.indexOf('// Execute Trial\nfunction runTrialPhase() {');
const endIdx = code.indexOf('function showTrialResultModal(trialResult) {');
if (startIdx === -1 || endIdx === -1) {
  console.error('Failed to find runTrialPhase boundaries in clean_main.js');
  process.exit(1);
}

code = code.slice(0, startIdx) + `// Execute Trial
function runTrialPhase() {
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

` + code.slice(endIdx);
console.log('Replaced runTrialPhase block successfully!');

// K. Recruit/Conscript function removal
replaceSafe(
  `// Recruit/Conscript a soldier
function conscriptSoldier() {
  if (state.fire < 1) {
    state.addLog('残り火 🔥 が不足しているため、徴兵できません！', 'warning');
    return false;
  }
  if (state.soldiers.length >= state.soldierCapacity) {
    state.addLog('兵士の収容上限に達しているため、これ以上徴兵できません！(兵舎等を建設してください)', 'warning');
    return false;
  }

  state.adjustResource('fire', -1);
  const newSoldier = {
    id: state.nextSoldierId++,
    xp: 0,
    level: 1
  };
  state.soldiers.push(newSoldier);
  state.addLog(\`新兵を1名徴兵しました！ (-1 🔥)\`, 'action');
  sound.playPlace();
  updateUI();
  return true;
}

// Bind conscript sidebar button
if (el.btnConscriptSidebar) {
  el.btnConscriptSidebar.addEventListener('click', () => {
    conscriptSoldier();
  });
}`,
  `// Recruit/Conscript a soldier removed`
);

// L. updateUI sidebar military panel removal
replaceSafe(
  `  // 11. Render military soldiers list in Right Sidebar
  const soldiersCountText = document.getElementById('soldiers-count-text');
  if (soldiersCountText) {
    soldiersCountText.innerText = \`兵士数: \${state.soldiers.length} / \${state.soldierCapacity}\`;
  }
  const btnConscriptSidebar = document.getElementById('btn-conscript-sidebar');
  if (btnConscriptSidebar) {
    btnConscriptSidebar.disabled = state.fire < 1 || state.soldiers.length >= state.soldierCapacity;
  }
  const soldiersContainer = document.getElementById('soldiers-list-container');
  if (soldiersContainer) {
    soldiersContainer.innerHTML = '';
    if (state.soldiers.length === 0) {
      soldiersContainer.innerHTML = \`<div style="font-size: 0.65rem; color: #9ca3af; text-align: center; padding: 4px;">兵士なし</div>\`;
    } else {
      state.soldiers.forEach(s => {
        const item = document.createElement('div');
        item.style.fontSize = '0.65rem';
        item.style.color = '#e5e7eb';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        item.style.padding = '2px 0';
        item.innerHTML = \`<span>⚔️ 兵士 (ID: \${s.id})</span> <span>Lv \${s.level} (XP: \${s.xp}/100)</span>\`;
        soldiersContainer.appendChild(item);
      });
    }
  }`,
  `  // Sidebar military section removed`
);

// 3. Write output to main.js on disk
const mainPath = path.join(__dirname, 'game', 'src', 'main.js');
fs.writeFileSync(mainPath, code, 'utf8');
console.log('Successfully generated the final clean main.js!');
