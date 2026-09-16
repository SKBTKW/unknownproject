// src/state.js - Fully Updated Game Engine with All 14 Rules + Civ-Style Border River Mechanics

export const ROLES = {
  GENERAL: 'GENERAL',
  PROPHET: 'PROPHET',
  PIONEER: 'PIONEER'
};

export const BASE_TERRAIN_YIELD = {
  1: { food: 10, wood: 10, def: 10 },
  2: { food: 5,  wood: 15, def: 20 },
  3: { food: 0,  wood: 20, def: 40 }
};

export const GREEN_LEVEL_MODIFIERS = {
  0: { food: -5, wood: -5, def: 0,  spirit: 0 },
  1: { food: 0,  wood: 0,  def: 0,  spirit: 0 },
  2: { food: 5,  wood: 5,  def: 5,  spirit: 0.5 },
  3: { food: 10, wood: 10, def: 10, spirit: 1.0 }
};

export const ELEVATION_DEFENSE_MULTIPLIERS = {
  1: 1.0,
  2: 1.5,
  3: 2.0
};

export function getExcessFlameBonusMultiplier(fire, maxFire) {
  const pct = (fire / maxFire) * 100;
  if (pct >= 80) return 1.20;
  if (pct >= 50) return 1.10;
  return 1.00;
}

export function rotateBlockCells(cells) {
  return cells.map(c => ({ dx: -c.dy, dy: c.dx }));
}

export class TileCell {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.elevation = 1;
    this.greenLevel = 1;
    this.isOccupied = false;
    this.isHQ = false;
    this.hasStarSocket = false;
    this.unlockedStarBonus = false;
    this.isExplored = false;
    this.hasRiverAdjacent = false; // Civ式: 境界線川に隣接しているか
    this.isHeadwaters = false;    // 💎 源流マス
    this.building = null;
  }

  getYield(fire, maxFire, fillMult = 1.0, stage = 1) {
    if (this.isHQ) {
      let hqMult = 1.0;
      if (stage === 2) hqMult = 1.4;
      if (stage === 3) hqMult = 1.8;
      return {
        food: Math.round(10 * hqMult),
        wood: Math.round(10 * hqMult),
        def: Math.round(10 * hqMult),
        spirit: Math.round(1.0 * hqMult * 10) / 10
      };
    }

    if (!this.isOccupied) {
      return { food: 0, wood: 0, def: 0, spirit: 0 };
    }

    let base = BASE_TERRAIN_YIELD[this.elevation] || { food: 0, wood: 0, def: 0 };
    let glMod = (this.elevation === 3) ? { food: 0, wood: 0, def: 0, spirit: 0 } : (GREEN_LEVEL_MODIFIERS[this.greenLevel] || { food: 0, wood: 0, def: 0, spirit: 0 });

    let food = base.food + glMod.food;
    let wood = base.wood + glMod.wood;
    let spirit = glMod.spirit || 0;

    const elevDefMult = ELEVATION_DEFENSE_MULTIPLIERS[this.elevation] || 1.0;
    let def = (base.def + glMod.def) * elevDefMult;

    // Civ式: 川（境界線）に隣接するマスへの水利バフ (🌾 +50%)
    if (this.hasRiverAdjacent) {
      food = Math.round(food * 1.5);
    }
    // 💎 源流マスの高価値バフ (🌾 +100% ＋ ✨1)
    if (this.isHeadwaters) {
      food = Math.round(food * 2.0);
      spirit += 1.0;
    }

    const flameMult = getExcessFlameBonusMultiplier(fire, maxFire);
    const starMult = this.unlockedStarBonus ? 1.25 : 1.0;

    food = Math.round(food * flameMult * fillMult * starMult);
    wood = Math.round(wood * flameMult * fillMult * starMult);
    def = Math.round(def * flameMult * fillMult * starMult);

    return { food: Math.max(0, food), wood: Math.max(0, wood), def: Math.max(0, def), spirit: Math.max(0, spirit) };
  }

  getDisplayName() {
    if (this.isHQ) return '🏰 本営';
    if (this.isHeadwaters) return '💎 清冽な源流 (食料2倍+✨1)';

    const elevNames = { 1: '平地', 2: '丘陵', 3: '山岳' };
    const glNames = { 0: '砂漠', 1: '標準', 2: '森', 3: '森林' };

    const eName = elevNames[this.elevation];
    const gName = (this.elevation === 3) ? '岩山' : glNames[this.greenLevel];
    return `${eName} (${gName})`;
  }
}

export class GameState {
  constructor() {
    this.currentTurn = 1;
    this.stage = 1;
    this.gridSize = 5;
    this.fire = 30;
    this.maxFire = 30;
    this.food = 100;
    this.materials = 50;
    this.defense = 0;
    this.spirit = 0;

    this.role = ROLES.GENERAL;
    this.hasDiscoveredRiverThisPlay = false; // 1プレイ1回限定川発見フラグ

    this.grid = Array(8).fill(null).map((_, y) => Array(8).fill(null).map((_, x) => new TileCell(x, y)));
    
    // Civ式 境界線川フラグ (横の境界線: 9行x8列, 縦の境界線: 8行x9列)
    this.horizontalRivers = Array(9).fill(null).map(() => Array(8).fill(false));
    this.verticalRivers = Array(8).fill(null).map(() => Array(9).fill(false));

    this.hand = [];
    this.logs = [];

    this.initMasterBoard();
  }

  initMasterBoard() {
    // 5x5中央 (x2, y2)
    this.grid[2][2].isHQ = true;
    this.grid[2][2].isOccupied = true;

    // ★ボーナスソケット
    this.grid[1][3].hasStarSocket = true;
    this.grid[3][1].hasStarSocket = true;
    this.grid[4][4].hasStarSocket = true;

    this.trials = [
      { turn: 10, name: '⚔️ 蛮族の夜襲 (Stage 1)', power: 50 },
      { turn: 25, name: '🛡️ 帝国遠征軍の侵攻 (Stage 2)', power: 200 },
      { turn: 50, name: '🔥 終焉の長夜 (最終試練)', power: 800 }
    ];

    this.addLog('✨ ゲーム開始！5×5初期盤面 (中央 (2,2) 🏰 1×1本営)');
  }

  addLog(msg, type = 'info') {
    this.logs.unshift({ turn: this.currentTurn, message: msg, type });
    if (this.logs.length > 50) this.logs.pop();
  }

  calculateSynergyStatus() {
    let occupiedCount = 0;
    let activeSize = this.gridSize;
    let minB = Math.floor((8 - activeSize) / 2);
    let maxB = minB + activeSize;
    let totalUnlockedCells = activeSize * activeSize;

    let hasRiver = false;
    for (let r = minB; r < maxB; r++) {
      for (let c = minB; c < maxB; c++) {
        if (this.grid[r][c].isOccupied) {
          occupiedCount++;
          if (this.grid[r][c].hasRiverAdjacent || this.grid[r][c].isHeadwaters) hasRiver = true;
        }
      }
    }

    let fillRatio = occupiedCount / totalUnlockedCells;
    let fillMult = 1.0;
    let fillBonusDesc = 'なし';

    if (fillRatio >= 0.80) {
      fillMult = 1.20;
      fillBonusDesc = '+20% (充填率80%+ 達成)';
    } else if (fillRatio >= 0.50) {
      fillMult = 1.10;
      fillBonusDesc = '+10% (充填率50%+ 達成)';
    }

    return { hasRiverAdjacent: hasRiver, fillMult, fillBonusDesc };
  }

  // Civ式 境界線川の生成 ＆ 隣接マスへの水利バフ伝搬
  spawnCivStyleBorderRiver(startX, startY, length = 4, elev = 2) {
    let curX = startX;
    let curY = startY;

    // 起点に 💎 源流 (山岳0.3%, 丘陵0.1%)
    this.grid[curY][curX].isHeadwaters = true;
    this.grid[curY][curX].hasRiverAdjacent = true;

    for (let i = 0; i < length; i++) {
      // 下または右へ境界線を伸ばす
      if (i % 2 === 0 && curY + 1 < 8) {
        this.verticalRivers[curY][curX] = true;
        this.grid[curY][curX].hasRiverAdjacent = true;
        if (curX - 1 >= 0) this.grid[curY][curX - 1].hasRiverAdjacent = true;
        curY++;
      } else if (curX + 1 < 8) {
        this.horizontalRivers[curY][curX] = true;
        this.grid[curY][curX].hasRiverAdjacent = true;
        if (curY - 1 >= 0) this.grid[curY - 1][curX].hasRiverAdjacent = true;
        curX++;
      }
    }
  }

  placeBlock(elev, gl, cells, targetX, targetY) {
    for (let c of cells) {
      let gx = targetX + c.dx;
      let gy = targetY + c.dy;
      if (gx < 0 || gx >= 8 || gy < 0 || gy >= 8) return false;
      if (this.grid[gy][gx].isOccupied) return false;
    }

    let isAdjacentToExisting = false;
    for (let c of cells) {
      let gx = targetX + c.dx;
      let gy = targetY + c.dy;
      const neighbors = [
        { x: gx + 1, y: gy }, { x: gx - 1, y: gy },
        { x: gx, y: gy + 1 }, { x: gx, y: gy - 1 }
      ];
      for (let n of neighbors) {
        if (n.x >= 0 && n.x < 8 && n.y >= 0 && n.y < 8) {
          if (this.grid[n.y][n.x].isOccupied) {
            let slope = Math.abs(elev - this.grid[n.y][n.x].elevation);
            if (slope > 1) return false;
            isAdjacentToExisting = true;
          }
        }
      }
    }
    if (!isAdjacentToExisting) return false;

    // 配置実行
    for (let c of cells) {
      let gx = targetX + c.dx;
      let gy = targetY + c.dy;
      let cell = this.grid[gy][gx];
      cell.isOccupied = true;
      cell.elevation = elev;
      cell.greenLevel = (elev === 3) ? 1 : gl;

      if (cell.hasStarSocket && !cell.unlockedStarBonus) {
        cell.unlockedStarBonus = true;
        this.addLog(`★ 【ソケットボーナス解禁】 (${gx},${gy}) に固有バフ解禁！`, 'success');
      }
    }

    // 1プレイ1回限定 川・源流発見チェック (距離 ≧ 3 ＆ 2マス以上)
    if (!this.hasDiscoveredRiverThisPlay && cells.length >= 2) {
      const hqX = (this.stage === 3) ? 3 : 2;
      const hqY = (this.stage === 3) ? 3 : 2;
      const dist = Math.abs(targetX - hqX) + Math.abs(targetY - hqY);

      if (dist >= 3) {
        let riverChance = 0.02;
        let sourceChance = 0.00;

        if (elev === 2) { riverChance = 0.04; sourceChance = 0.001; }
        if (elev === 3) { riverChance = 0.06; sourceChance = 0.003; }

        const rand = Math.random();
        if (rand < (riverChance + sourceChance)) {
          this.hasDiscoveredRiverThisPlay = true;
          const length = Math.floor(Math.random() * 4) + 3; // 3〜6マス/辺規模
          this.spawnCivStyleBorderRiver(targetX, targetY, length, elev);

          if (rand < sourceChance) {
            this.addLog(`💎 【1プレイ1回限定】 奇跡の『清冽な源流』を発見！(規模: ${length}辺) 水利バフ🌾+100%＆✨+1発動！`, 'success');
          } else {
            this.addLog(`🌊 【1プレイ1回限定】 『本流』を発見！(Civ式 規模: ${length}辺) 水利バフ🌾+50%発動！`, 'success');
          }
        }
      }
    }

    return true;
  }

  deforestTile(x, y) {
    let cell = this.grid[y][x];
    if (cell.isOccupied && !cell.isHQ && cell.elevation !== 3 && cell.greenLevel > 1) {
      cell.greenLevel--;
      this.materials += 15;
      this.addLog(`🪓 伐採を実行: (${x},${y}) の緑化度を低下させ、資材 🧱+15 を獲得。`);
      return true;
    }
    return false;
  }

  exploreTileWith2D6(x, y) {
    let cell = this.grid[y][x];
    if (cell.isOccupied && !cell.isHQ && !cell.isExplored) {
      if (this.fire < 1) return false;
      this.fire--;
      cell.isExplored = true;

      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const sum = d1 + d2;

      if (sum === 12) {
        this.spirit += 10;
        this.addLog(`🏛️ 2D6探索 [出目12 ゾロ目!] (${x},${y}) で古代遺跡を発見！ 神秘 ✨+10 獲得！`, 'success');
      } else if (sum >= 9) {
        this.food += 30;
        this.addLog(`💎 2D6探索 [出目${sum}] レア資源発見！ 食料 🌾+30 獲得。`, 'info');
      } else {
        this.materials += 10;
        this.addLog(`🌾 2D6探索 [出目${sum}] 通常発見。資材 🧱+10 獲得。`, 'info');
      }
      return true;
    }
    return false;
  }
}
