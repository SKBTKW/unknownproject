// src/main.js - Updated with Civ-Style Border River UI Rendering and All 14 Rules

import { GameState, ROLES, getExcessFlameBonusMultiplier, rotateBlockCells, BASE_TERRAIN_YIELD, GREEN_LEVEL_MODIFIERS, ELEVATION_DEFENSE_MULTIPLIERS } from './state.js';
import { resolveSlideExactTrialCombat, selectTrialBattlefields } from './trials.js';

const state = new GameState();
window.state = state;

const el = {
  currentTurn: document.getElementById('current-turn'),
  valFire: document.getElementById('val-fire'),
  valMaxFire: document.getElementById('val-max-fire'),
  valFireBonus: document.getElementById('val-fire-bonus'),
  valFood: document.getElementById('val-food'),
  valMaterials: document.getElementById('val-materials'),
  valDefense: document.getElementById('val-defense'),
  trialCountdown: document.getElementById('trial-countdown'),
  activeRoleDisplay: document.getElementById('active-role-display'),
  gridStageLabel: document.getElementById('grid-stage-label'),
  logConsole: document.getElementById('log-console'),
  gridCellsLayer: document.getElementById('grid-cells-layer'),
  cardOfferingsZone: document.getElementById('card-offerings-zone'),
  activeSynergiesList: document.getElementById('active-synergies-list'),
  btnEndTurn: document.getElementById('btn-end-turn'),
  btnToggleUI: document.getElementById('btn-toggle-ui'),
  modalRoleSelect: document.getElementById('modal-role-select'),
  modalDiceRoll: document.getElementById('modal-dice-roll'),
  dice1: document.getElementById('dice-1'),
  dice2: document.getElementById('dice-2'),
  diceResultContainer: document.getElementById('dice-result-container'),
  diceSumDisplay: document.getElementById('dice-sum-display'),
  diceOutcomeText: document.getElementById('dice-outcome-text'),
  btnCloseDiceModal: document.getElementById('btn-close-dice-modal')
};

const BLOCK_SHAPE_CATALOG = {
  C_1x1: { name: '1×1 (C)', rarity: 'C', cells: [{ dx: 0, dy: 0 }] },
  UC_1x2: { name: '1×2 直線 (UC)', rarity: 'UC', cells: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }] },
  UC_1x3_LINE: { name: '1×3 直線 (UC)', rarity: 'UC', cells: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 2, dy: 0 }] },
  UC_1x3_CORNER: { name: '1×3 L字/角型 (UC)', rarity: 'UC', cells: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }] },
  R_T_SHAPE: { name: '1×4 T型/凸型 (R)', rarity: 'R', cells: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 2, dy: 0 }, { dx: 1, dy: 1 }] },
  R_L_SHAPE: { name: '1×4 L型/靴型 (R)', rarity: 'R', cells: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 2, dy: 0 }, { dx: 1, dy: -1 }] },
  R_SZ_SHAPE: { name: '1×4 S/Z型 (R)', rarity: 'R', cells: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 1, dy: 1 }, { dx: 2, dy: 1 }] },
  R_LINE: { name: '1×4 直線 (R)', rarity: 'R', cells: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 2, dy: 0 }, { dx: 3, dy: 0 }] },
  L_2x2: { name: '2×2 正方形 (L)', rarity: 'L', cells: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }] }
};

const WEIGHTED_LAND_TYPES = [
  { elev: 1, gl: 1, weight: 32, label: '🌾 平地標準 (GL1)', type: '土地' },
  { elev: 1, gl: 2, weight: 20, label: '🌲 平地森 (GL2)', type: '土地' },
  { elev: 1, gl: 3, weight: 8,  label: '🌳 平地森林 (GL3)', type: '土地' },
  { elev: 1, gl: 0, weight: 5,  label: '🏜️ 平地砂漠 (GL0)', type: '土地' },

  { elev: 2, gl: 1, weight: 12, label: '⛰️ 丘陵標準 (GL1)', type: '土地' },
  { elev: 2, gl: 2, weight: 8,  label: '🪵 丘陵森 (GL2)', type: '土地' },
  { elev: 2, gl: 3, weight: 3,  label: '🌲 丘陵森林 (GL3)', type: '土地' },
  { elev: 2, gl: 0, weight: 2,  label: '⛏️ 丘陵砂漠 (GL0)', type: '土地' },

  { elev: 3, gl: null, weight: 6, label: '🏔️ 山岳標準 (高度3)', type: '土地' },
  { elev: 3, gl: null, weight: 2, label: '🏔️ 山岳森 (高度3)', type: '土地' },
  { elev: 3, gl: null, weight: 1, label: '🏔️ 山岳森林 (高度3)', type: '土地' },
  { elev: 3, gl: null, weight: 1, label: '🏔️ 山岳砂漠 (高度3)', type: '土地' }
];

function getRandomBlockShapeForTerrain(elev, currentGridSize = 5) {
  let candidateShapes = [];

  if (elev === 1) {
    candidateShapes = Object.values(BLOCK_SHAPE_CATALOG);
  } else if (elev === 2) {
    candidateShapes = [
      BLOCK_SHAPE_CATALOG.UC_1x2,
      BLOCK_SHAPE_CATALOG.UC_1x3_CORNER,
      BLOCK_SHAPE_CATALOG.R_L_SHAPE
    ];
  } else {
    candidateShapes = [
      BLOCK_SHAPE_CATALOG.R_T_SHAPE,
      BLOCK_SHAPE_CATALOG.UC_1x3_LINE,
      BLOCK_SHAPE_CATALOG.R_LINE
    ];
  }

  const allowedShapes = candidateShapes.filter(shape => {
    if (shape.rarity === 'R' && currentGridSize < 7) return false;
    if (shape.rarity === 'L' && currentGridSize < 8) return false;
    return true;
  });

  if (allowedShapes.length === 0) return candidateShapes[0];
  return allowedShapes[Math.floor(Math.random() * allowedShapes.length)];
}

const CARD_DATABASE = {
  MILITARY: [
    { category: 'MILITARY', label: '⚔️ 兵舎建設 (🛡️+15/T)', cost: '🧱60', type: '施設' },
    { category: 'MILITARY', label: '🏰 監視塔建設 (🛡️+10/T)', cost: '🧱40', type: '施設' },
    { category: 'MILITARY', label: '🛡️ 防御陣形 (戦術)', cost: '🔥0', type: '戦術' }
  ],
  SOCIETY: [
    { category: 'SOCIETY', label: '🌾 農業革新 (全食料+25%)', cost: '🧱50', type: '技術' },
    { category: 'SOCIETY', label: '🧱 採石術 (全資材+25%)', cost: '🧱50', type: '技術' },
    { category: 'SOCIETY', label: '✨ 予知の神託 (試練予知)', cost: '✨30', type: '神秘' }
  ]
};

let selectedHandCard = null;
let uiPositionTop = true;

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.select-role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectRole(btn.dataset.role);
    });
  });

  if (el.btnEndTurn) {
    el.btnEndTurn.addEventListener('click', () => {
      endTurn();
    });
  }

  if (el.btnToggleUI) {
    el.btnToggleUI.addEventListener('click', () => {
      uiPositionTop = !uiPositionTop;
      document.body.className = uiPositionTop ? 'ui-mode-top' : 'ui-mode-bottom';
      state.addLog(`UI配置を切替: ${uiPositionTop ? '上部固定' : '下部ドック集約'}`);
    });
  }

  if (el.btnCloseDiceModal) {
    el.btnCloseDiceModal.addEventListener('click', () => {
      if (el.modalDiceRoll) el.modalDiceRoll.style.display = 'none';
      renderGrid();
      updateUI();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') {
      rotateSelectedCard();
    }
  });
});

function triggerVisual2D6DiceRoll(c, r) {
  if (state.fire < 1) {
    state.addLog('残り火(🔥)が足りず探索を実行できません。', 'warning');
    return;
  }

  if (el.modalDiceRoll) el.modalDiceRoll.style.display = 'flex';
  if (el.diceResultContainer) el.diceResultContainer.style.display = 'none';

  el.dice1.classList.add('dice-rolling');
  el.dice2.classList.add('dice-rolling');

  setTimeout(() => {
    el.dice1.classList.remove('dice-rolling');
    el.dice2.classList.remove('dice-rolling');

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const sum = d1 + d2;

    const diceIcons = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    el.dice1.innerText = diceIcons[d1 - 1];
    el.dice2.innerText = diceIcons[d2 - 1];

    if (state.exploreTileWith2D6(c, r)) {
      if (el.diceResultContainer) el.diceResultContainer.style.display = 'block';
      if (el.diceSumDisplay) el.diceSumDisplay.innerText = `出目合計: 🎲${d1} + 🎲${d2} = ${sum}`;

      if (sum === 12) {
        el.diceOutcomeText.innerText = '🏛️ 【ゾロ目6】 古代遺跡を発見！ 神秘 ✨+10 獲得！';
        el.diceOutcomeText.style.color = '#fbbf24';
      } else if (sum >= 9) {
        el.diceOutcomeText.innerText = '💎 【豊かな土地】 レア資源発見！ 食料 🌾+30 獲得！';
        el.diceOutcomeText.style.color = '#34d399';
      } else if (sum >= 5) {
        el.diceOutcomeText.innerText = '🌾 【通常発見】 通常資源発見。資材 🧱+10 獲得！';
        el.diceOutcomeText.style.color = '#60a5fa';
      } else {
        el.diceOutcomeText.innerText = '💀 【不発】 特段の発見はなかった。';
        el.diceOutcomeText.style.color = '#f87171';
      }
    }
  }, 1000);
}

function rotateSelectedCard() {
  if (selectedHandCard !== null && state.hand[selectedHandCard] && !state.hand[selectedHandCard].isUsed) {
    const card = state.hand[selectedHandCard];
    if (card.category === 'LAND' && card.shape) {
      card.shape.cells = rotateBlockCells(card.shape.cells);
      state.addLog(`🔄 ${card.label} (${card.shape.name}) を90度回転！`, 'info');
      renderHand();
    }
  }
}

function selectRole(role) {
  state.role = role;
  if (el.modalRoleSelect) el.modalRoleSelect.style.display = 'none';
  el.activeRoleDisplay.innerText = role === ROLES.GENERAL ? '将軍' : (role === ROLES.PROPHET ? '預言者' : '開拓者');
  el.activeRoleDisplay.className = `role-badge ${role}`;
  startTurn();
}

function startTurn() {
  if (state.currentTurn <= 15) {
    state.stage = 1;
    state.gridSize = 5;
  } else if (state.currentTurn <= 30) {
    state.stage = 2;
    state.gridSize = 7;
  } else {
    state.stage = 3;
    state.gridSize = 8;
  }

  drawHandOfferings();
  updateUI();
  renderGrid();
}

function getRandomWeightedLand() {
  const rand = Math.random() * 100;
  let cumulative = 0;

  for (const land of WEIGHTED_LAND_TYPES) {
    cumulative += land.weight;
    if (rand <= cumulative) {
      return land;
    }
  }
  return WEIGHTED_LAND_TYPES[0];
}

function drawHandOfferings() {
  state.hand = [];

  for (let i = 0; i < 3; i++) {
    const rand = Math.random();
    let card;

    if (rand < 0.50) {
      const landOpt = getRandomWeightedLand();
      const shapeObj = getRandomBlockShapeForTerrain(landOpt.elev, state.gridSize);
      const shape = { ...shapeObj, cells: JSON.parse(JSON.stringify(shapeObj.cells)) };
      card = { ...landOpt, category: 'LAND', shape, id: `hand-${i}` };
    } else if (rand < 0.75) {
      const milOpt = CARD_DATABASE.MILITARY[Math.floor(Math.random() * CARD_DATABASE.MILITARY.length)];
      card = { ...milOpt, id: `hand-${i}` };
    } else {
      const socOpt = CARD_DATABASE.SOCIETY[Math.floor(Math.random() * CARD_DATABASE.SOCIETY.length)];
      card = { ...socOpt, id: `hand-${i}` };
    }

    card.isUsed = false;
    state.hand.push(card);
  }

  renderHand();
}

function calculateTotalBlockYield(elev, gl, cellCount) {
  let base = BASE_TERRAIN_YIELD[elev] || { food: 0, wood: 0, def: 0 };
  let glMod = elev === 3 ? { food: 0, wood: 0, def: 0, spirit: 0 } : (GREEN_LEVEL_MODIFIERS[gl] || { food: 0, wood: 0, def: 0, spirit: 0 });

  let foodPerCell = base.food + glMod.food;
  let woodPerCell = base.wood + glMod.wood;
  const elevDefMult = ELEVATION_DEFENSE_MULTIPLIERS[elev] || 1.0;
  let defPerCell = (base.def + glMod.def) * elevDefMult;
  let spiritPerCell = glMod.spirit || 0;

  return {
    food: Math.max(0, Math.round(foodPerCell * cellCount)),
    wood: Math.max(0, Math.round(woodPerCell * cellCount)),
    def: Math.max(0, Math.round(defPerCell * cellCount)),
    spirit: Math.max(0, Math.round(spiritPerCell * cellCount * 10) / 10)
  };
}

function renderHand() {
  if (!el.cardOfferingsZone) return;
  el.cardOfferingsZone.innerHTML = '';

  state.hand.forEach((card, index) => {
    const cardEl = document.createElement('div');
    const isSelected = selectedHandCard === index;
    cardEl.className = `card-item ${card.isUsed ? 'used' : ''} ${isSelected ? 'selected' : ''}`;

    if (card.isUsed) {
      cardEl.style.opacity = '0.35';
      cardEl.style.cursor = 'default';
    } else {
      cardEl.onclick = () => {
        if (card.category === 'LAND') {
          selectedHandCard = index;
          renderHand();
          state.addLog(`選択中: ${card.label} (${card.shape.name})`);
        } else {
          card.isUsed = true;
          state.addLog(`カード発動: ${card.label} (${card.type}) を発動！`, 'success');
          renderHand();
          updateUI();
        }
      };
    }

    const badgeColor = card.category === 'LAND' ? '#10b981' : (card.category === 'MILITARY' ? '#ef4444' : '#a855f7');
    const rarityLabel = card.shape ? ` [${card.rarity || card.shape.rarity}]` : '';

    let shapePreviewHTML = '';
    let yieldSummaryHTML = '';

    if (card.category === 'LAND' && card.shape) {
      const cells = card.shape.cells;
      let minDx = 0, minDy = 0;
      cells.forEach(c => {
        if (c.dx < minDx) minDx = c.dx;
        if (c.dy < minDy) minDy = c.dy;
      });

      const filledSet = new Set(cells.map(c => `${c.dx - minDx},${c.dy - minDy}`));

      let gridCellsHTML = '';
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const isFilled = filledSet.has(`${c},${r}`);
          gridCellsHTML += `<div class="mini-preview-cell ${isFilled ? 'filled' : ''}"></div>`;
        }
      }
      shapePreviewHTML = `<div class="card-shape-preview-grid" title="ブロック形状ミニプレビュー (Rキーで回転)">${gridCellsHTML}</div>`;

      const totalYield = calculateTotalBlockYield(card.elev, card.gl, cells.length);
      let yieldParts = [];
      if (totalYield.food > 0) yieldParts.push(`🌾+${totalYield.food}`);
      if (totalYield.wood > 0) yieldParts.push(`🧱+${totalYield.wood}`);
      if (totalYield.def > 0) yieldParts.push(`🛡️+${totalYield.def}`);
      if (totalYield.spirit > 0) yieldParts.push(`✨+${totalYield.spirit}`);
      if (yieldParts.length === 0) yieldParts.push(`🌾0 (砂漠)`);

      yieldSummaryHTML = `<div class="card-yield-summary" title="毎ターンの見込み合計産出量">${yieldParts.join(' ')}</div>`;
    }

    let rotateBtnHTML = '';
    if (card.category === 'LAND' && !card.isUsed && isSelected) {
      rotateBtnHTML = `<button id="btn-rotate-card" style="margin-top:6px; padding:3px 8px; font-size:0.7rem; background:#3b82f6; border:none; border-radius:4px; color:#fff; cursor:pointer; font-weight:bold;">🔄 回転 (R)</button>`;
    }

    cardEl.innerHTML = `
      <span style="font-size:0.65rem; background:${badgeColor}; padding:2px 6px; border-radius:4px; font-weight:bold;">${card.type}${rarityLabel}</span>
      <div style="font-weight: bold; color: #fbbf24; margin-top:6px; font-size:0.85rem;">${card.label}</div>
      <div style="color: #9ca3af; font-size:0.7rem; margin-top: 2px;">${card.shape ? card.shape.name : card.cost}</div>
      ${shapePreviewHTML}
      ${yieldSummaryHTML}
      ${rotateBtnHTML}
    `;

    el.cardOfferingsZone.appendChild(cardEl);

    const btnRotate = cardEl.querySelector('#btn-rotate-card');
    if (btnRotate) {
      btnRotate.onclick = (e) => {
        e.stopPropagation();
        rotateSelectedCard();
      };
    }
  });
}

function renderGrid() {
  if (!el.gridCellsLayer) return;
  el.gridCellsLayer.innerHTML = '';

  const activeSize = state.gridSize;
  const minBound = Math.floor((8 - activeSize) / 2);
  const maxBound = minBound + activeSize;

  if (el.gridStageLabel) {
    el.gridStageLabel.innerText = `Stage ${state.stage} (${activeSize}×${activeSize} 領域)`;
  }

  const synergy = state.calculateSynergyStatus();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const tile = state.grid[r][c];
      const isUnlocked = (r >= minBound && r < maxBound && c >= minBound && c < maxBound);

      const cellEl = document.createElement('div');
      let extraClasses = '';

      // Civ式 境界線川のCSSネオン描画判定
      if (state.horizontalRivers[r][c]) extraClasses += ' river-border-top';
      if (state.verticalRivers[r][c]) extraClasses += ' river-border-left';

      cellEl.className = `grid-tile-cell ${isUnlocked ? 'unlocked' : 'locked'}${extraClasses}`;

      if (isUnlocked) {
        if (tile.isHQ) {
          cellEl.style.background = 'radial-gradient(circle, #f59e0b 0%, #78350f 100%)';
          cellEl.style.borderColor = '#fbbf24';
          cellEl.innerHTML = '<span style="font-weight:bold; color:#fff;">🏰本営</span>';
        } else if (tile.isOccupied) {
          if (tile.isHeadwaters) {
            cellEl.style.background = 'radial-gradient(circle, #06b6d4 0%, #1e3a8a 100%)';
            cellEl.style.borderColor = '#22d3ee';
          } else if (tile.elevation === 3) {
            cellEl.style.background = '#4b5563';
          } else if (tile.elevation === 2) {
            cellEl.style.background = '#854d0e';
          } else if (tile.greenLevel === 3) {
            cellEl.style.background = '#064e3b';
          } else if (tile.greenLevel === 2) {
            cellEl.style.background = '#047857';
          } else if (tile.greenLevel === 0) {
            cellEl.style.background = '#78350f';
          } else {
            cellEl.style.background = '#15803d';
          }

          const y = tile.getYield(state.fire, state.maxFire, synergy.fillMult, state.stage);
          const name = tile.getDisplayName();
          
          let starTag = tile.unlockedStarBonus ? ` <small style="color:#fbbf24; font-weight:bold;">[★]</small>` : '';
          let searchTag = tile.isExplored ? ` <small style="color:#3b82f6;">🎲</small>` : '';
          let lakeTag = tile.isHeadwaters ? '💎 源流' : name.split(' ')[0];

          cellEl.innerHTML = `<span>${lakeTag}${starTag}${searchTag}</span>`;
          cellEl.title = `${name} (産出 🌾${y.food} 🧱${y.wood} 🛡️${y.def} ✨${y.spirit}) | [Shift+クリックで1🔥消費し🎲2D6ダイス探索判定]`;

          cellEl.oncontextmenu = (e) => {
            e.preventDefault();
            if (state.deforestTile(c, r)) {
              renderGrid();
              updateUI();
            }
          };
        } else {
          if (tile.hasStarSocket) {
            cellEl.style.background = 'radial-gradient(circle, rgba(251,191,36,0.3) 0%, rgba(30,41,59,0.8) 100%)';
            cellEl.style.borderColor = '#fbbf24';
            cellEl.innerHTML = '<span style="color:#fbbf24; font-size:1.1rem; font-weight:bold; animation: pulse 1.5s infinite;">★</span>';
            cellEl.title = '★ 未開放ソケット！土地ブロックを重ねると固有ボーナスが発動！';
          } else {
            cellEl.style.background = 'rgba(30, 41, 59, 0.7)';
          }
        }

        cellEl.onclick = (e) => {
          if (e.shiftKey && tile.isOccupied && !tile.isHQ && !tile.isExplored) {
            triggerVisual2D6DiceRoll(c, r);
            return;
          }

          if (selectedHandCard !== null && !state.hand[selectedHandCard].isUsed) {
            const card = state.hand[selectedHandCard];
            if (card.category === 'LAND') {
              if (state.placeBlock(card.elev, card.gl, card.shape.cells, c, r)) {
                card.isUsed = true;
                selectedHandCard = null;
                renderHand();
                renderGrid();
                updateUI();
              } else {
                state.addLog('配置不可！本営または既存ブロックに隣接させて重ねずに配置してください。', 'warning');
              }
            }
          }
        };
      }

      el.gridCellsLayer.appendChild(cellEl);
    }
  }
}

function endTurn() {
  state.currentTurn++;
  const synergy = state.calculateSynergyStatus();

  let turnFood = 0;
  let turnWood = 0;
  let turnDef = 0;

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const yData = state.grid[y][x].getYield(state.fire, state.maxFire, synergy.fillMult, state.stage);
      turnFood += yData.food;
      turnWood += yData.wood;
      turnDef += yData.def;
    }
  }

  const foodUpkeepCost = 20;
  const netFoodHarvest = Math.max(0, turnFood - foodUpkeepCost);
  state.food += netFoodHarvest;

  let fireDelta = -1;
  let statusText = "標準減衰 (-1🔥)";

  if (state.food >= 500) {
    fireDelta = +1;
    statusText = "蓄積500達成! 飽食熱気 (+1🔥自動回復)";
  } else if (state.food >= 200) {
    fireDelta = 0;
    statusText = "蓄積200達成! 活気満腹 (🔥減衰ゼロ)";
  }

  state.fire = Math.min(state.maxFire, Math.max(0, state.fire + fireDelta));
  state.materials += turnWood;
  state.defense = turnDef;

  state.addLog(`Turn ${state.currentTurn - 1} 終了: 🌾+${turnFood} (維持費🌾-20消費 ➔ 純増🌾+${netFoodHarvest}), 食料蓄積 ${state.food} [${statusText}], 🧱+${turnWood}, 🛡️${turnDef} 回収。`);

  const activeTrial = state.trials.find(t => t.turn === state.currentTurn);
  if (activeTrial) {
    const battlefields = selectTrialBattlefields(state);
    const result = resolveSlideExactTrialCombat(state, battlefields);

    if (result.isSuccess) {
      state.addLog(`✨ ${activeTrial.name} 完全防衛成功！`, 'success');
    } else {
      state.addLog(`🚨 ${activeTrial.name} 防衛失敗！ (残り火 -${result.fireLoss}🔥)`, 'warning');
    }
  }

  if (state.currentTurn > 50 || state.fire <= 0) {
    state.addLog(state.fire > 0 ? "🎉 50ターン突破！ゲームクリア！" : "☠️ 残り火が消滅しました...", 'system');
  } else {
    startTurn();
  }
}

function updateUI() {
  if (el.currentTurn) el.currentTurn.innerText = state.currentTurn;
  if (el.valFire) el.valFire.innerText = state.fire;
  if (el.valMaxFire) el.valMaxFire.innerText = state.maxFire;
  
  const mult = getExcessFlameBonusMultiplier(state.fire, state.maxFire);
  const bonusPercent = Math.round((mult - 1) * 100);
  if (el.valFireBonus) {
    el.valFireBonus.innerText = `${bonusPercent >= 0 ? '+' : ''}${bonusPercent}%`;
    el.valFireBonus.style.color = bonusPercent > 0 ? '#10b981' : (bonusPercent < 0 ? '#ef4444' : '#9ca3af');
  }

  if (el.valFood) el.valFood.innerText = state.food;
  if (el.valMaterials) el.valMaterials.innerText = state.materials;
  if (el.valDefense) el.valDefense.innerText = state.defense;

  const synergy = state.calculateSynergyStatus();
  if (el.activeSynergiesList) {
    el.activeSynergiesList.innerHTML = `
      <li>🌊 水利ボーナス: ${synergy.hasRiverAdjacent ? '<span style="color:#10b981">🌾+50% 発動中 (Civ式境界線川)</span>' : '待機中'}</li>
      <li>🏁 盤面充填率: <span style="color:#fbbf24">${synergy.fillBonusDesc}</span></li>
    `;
  }

  if (el.logConsole) {
    el.logConsole.innerHTML = state.logs.map(l => `<div class="log-entry ${l.type}">[T${l.turn}] ${l.message}</div>`).join('');
  }

  const nextTrial = state.trials.find(t => t.turn >= state.currentTurn);
  if (nextTrial && el.trialCountdown) {
    const diff = nextTrial.turn - state.currentTurn;
    if (diff <= 7) {
      el.trialCountdown.innerHTML = `<span style="color:#ef4444; font-weight:bold;">⚠️ 【試練予報発令】${nextTrial.name} まで残り ${diff} ターン (目標防衛力: 🛡️${nextTrial.power})</span>`;
    } else {
      el.trialCountdown.innerHTML = `<span style="color:#9ca3af;">平穏な日々... (次回の試練予報待機中)</span>`;
    }
  }
}
