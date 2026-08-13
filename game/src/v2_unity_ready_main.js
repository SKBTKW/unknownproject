class Step1Terrain {
    constructor(id, name, defense, food, wood, mystic = 0) {
        this.id = id;
        this.name = name;
        this.defense = defense;
        this.food = food;
        this.wood = wood;
        this.mystic = mystic;
    }
}

const Step1Terrains = {
    GL1_GRASS: new Step1Terrain("GL1_GRASS", "草原", 0, 4, 0),
    GL2_FOREST: new Step1Terrain("GL2_FOREST", "森", 0, 4, 4),
    H1_PLAINS: new Step1Terrain("H1_PLAINS", "平地", 0, 0, 4),
    H2_HILL: new Step1Terrain("H2_HILL", "丘陵", 3, 0, 4),
    H3_MOUNTAIN: new Step1Terrain("H3_MOUNTAIN", "山岳", 5, 0, 3, 1),
    HQ: new Step1Terrain("HQ", "本営", 10, 10, 10, 1)
};

const CONNECTION_BONUS_TABLE = {
    "GL1_GRASS":          { food: 5, wood: 0, mystic: 0 },
    "GL2_FOREST":         { food: 2, wood: 3, mystic: 0 },
    "H1_PLAINS":          { food: 0, wood: 5, mystic: 0 },
    "H2_HILL":            { food: 0, wood: 4, mystic: 0 },
    "H3_MOUNTAIN":        { food: 0, wood: 5, mystic: 2 }
};

class GameState {
    constructor() {
        this.turn = 1;
        this.ember = 20;
        this.food = 30;
        this.wood = 30;
        this.mystic = 0; /* ✨ 初期値 0 */
        this.hasPickedThisTurn = false;
        
        this.stage = { size: 5, hqR: 2, hqC: 2 };
        this.grid = this.initGrid(5);
        this.reserveSlots = [null, null, null];
        this.gameLogs = [];
        this.toastQueue = [];

        this.addLog("[T1] ゲーム開始: 5x5 盤面が初期化されました。");
    }

    initGrid(size) {
        let grid = [];
        for (let r = 0; r < size; r++) {
            let row = [];
            for (let c = 0; c < size; c++) {
                const isHQ = (r === 2 && c === 2);
                row.push({
                    r, c,
                    isHQ,
                    placed: isHQ,
                    terrain: isHQ ? Step1Terrains.HQ : null,
                    merged: false,
                    searched: false,
                    hasSocket: false,
                    socketResource: null
                });
            }
            grid.push(row);
        }

        grid[0][1].hasSocket = true;
        grid[1][3].hasSocket = true;
        grid[3][1].hasSocket = true;

        return grid;
    }

    addLog(msg) {
        this.gameLogs.unshift(msg);
        if (this.gameLogs.length > 20) this.gameLogs.pop();
    }

    isHQVicinity(r, c) {
        if (r === 2 && c === 2) return false;
        return Math.abs(r - 2) <= 1 && Math.abs(c - 2) <= 1;
    }

    countPlacedTiles() {
        let count = 0;
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                if (this.grid[r][c].placed && !this.grid[r][c].isHQ) count++;
            }
        }
        return count;
    }

    canPlaceShape(startR, startC, shapeMatrix) {
        const rows = shapeMatrix.length;
        const cols = shapeMatrix[0].length;
        const size = this.stage.size;

        for (let dr = 0; dr < rows; dr++) {
            for (let dc = 0; dc < cols; dc++) {
                if (shapeMatrix[dr][dc] === 1) {
                    const r = startR + dr;
                    const c = startC + dc;
                    if (r >= size || c >= size) return { can: false, reason: "盤面外には配置できません" };
                    if (this.grid[r][c].placed) return { can: false, reason: "既に土地が配置されています" };
                }
            }
        }

        let isAdjacent = false;
        for (let dr = 0; dr < rows; dr++) {
            for (let dc = 0; dc < cols; dc++) {
                if (shapeMatrix[dr][dc] === 1) {
                    const r = startR + dr;
                    const c = startC + dc;
                    const neighbors = [
                        [r-1, c], [r+1, c], [r, c-1], [r, c+1]
                    ];
                    for (let [nr, nc] of neighbors) {
                        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
                            if (this.grid[nr][nc].placed) {
                                isAdjacent = true;
                                break;
                            }
                        }
                    }
                }
                if (isAdjacent) break;
            }
        }

        if (!isAdjacent) return { can: false, reason: "既存の配置済み土地に隣接させる必要があります" };
        return { can: true };
    }

    placeShape(startR, startC, shapeMatrix, terrain) {
        const check = this.canPlaceShape(startR, startC, shapeMatrix);
        if (!check.can) return check;

        const rows = shapeMatrix.length;
        const cols = shapeMatrix[0].length;

        for (let dr = 0; dr < rows; dr++) {
            for (let dc = 0; dc < cols; dc++) {
                if (shapeMatrix[dr][dc] === 1) {
                    const r = startR + dr;
                    const c = startC + dc;
                    const cell = this.grid[r][c];
                    cell.placed = true;
                    cell.terrain = terrain;

                    this.checkConnectionBonus(r, c, terrain);
                }
            }
        }

        this.addLog(`土地配置: (${String.fromCharCode(65+startC)}${startR+1}) に ${terrain.name} を配置。`);
        return { success: true };
    }

    executeExploration(r, c) {
        const cell = this.grid[r][c];
        if (!cell.placed || cell.isHQ) return { success: false, reason: "未配置または本営マスは探索できません" };
        if (cell.searched) return { success: false, reason: "既に探索済みです" };
        if (this.ember <= 1) return { success: false, reason: "🔥 生命力が不足しています" };

        this.ember -= 1;
        cell.searched = true;

        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        const totalRoll = d1 + d2;
        const posStr = `(${String.fromCharCode(65+c)}${r+1})`;

        let resultMsg = "";
        if (totalRoll >= 9) {
            if (cell.hasSocket && !cell.socketResource) {
                const socketDef = { name: "野麦 🌾+3/T", bonusFood: 3, bonusWood: 0 };
                cell.socketResource = socketDef;
                resultMsg = `🎲 出目${totalRoll}: ★ ${socketDef.name} 開花露出!`;
                this.toastQueue.push({ r, c, text: `★ ${socketDef.name} 開花!` });
            } else {
                this.food += 3;
                this.wood += 3;
                resultMsg = `🎲 出目${totalRoll}: 発掘成功! 🌾+3 🧱+3 即時獲得!`;
                this.toastQueue.push({ r, c, text: "発掘! 🌾🧱+3" });
            }
        } else if (totalRoll >= 5) {
            this.food += 2;
            this.wood += 2;
            resultMsg = `🎲 出目${totalRoll}: 中額資源発掘 🌾+2 🧱+2 即時獲得!`;
            this.toastQueue.push({ r, c, text: "発掘! 🌾🧱+2" });
        } else {
            this.food += 1;
            resultMsg = `🎲 出目${totalRoll}: 少額食料発見 🌾+1 即時獲得!`;
            this.toastQueue.push({ r, c, text: "発見! 🌾+1" });
        }

        this.addLog(`2D6探索 ${posStr}: ${resultMsg}`);
        return { success: true, roll: totalRoll, msg: resultMsg };
    }

    checkConnectionBonus(r, c, terrain) {
        const size = this.stage.size;
        const visited = new Set();
        let connectionCount = 0;

        const dfs = (cr, cc) => {
            const key = `${cr},${cc}`;
            if (visited.has(key)) return;
            visited.add(key);
            connectionCount++;

            const neighbors = [[cr-1, cc], [cr+1, cc], [cr, cc-1], [cr, cc+1]];
            for (let [nr, nc] of neighbors) {
                if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
                    const nCell = this.grid[nr][nc];
                    if (nCell.placed && nCell.terrain && nCell.terrain.id === terrain.id && !nCell.isHQ) {
                        dfs(nr, nc);
                    }
                }
            }
        };

        dfs(r, c);

        const isHQVic = this.isHQVicinity(r, c);
        const mult = isHQVic ? 2 : 1;
        const b = CONNECTION_BONUS_TABLE[terrain.id] || { food: 2, wood: 2, mystic: 0 };

        if (connectionCount === 2) {
            const fVal = b.food * mult;
            const wVal = b.wood * mult;
            this.food += fVal;
            this.wood += wVal;
            this.toastQueue.push({ r, c, text: `連結+ ${fVal > 0 ? '🌾'+fVal : ''} ${wVal > 0 ? '🧱'+wVal : ''}` });
            this.addLog(`2連結即時ボーナス獲得 (${terrain.name})`);
        } else if (connectionCount === 3) {
            const fVal = b.food * 2 * mult;
            const wVal = b.wood * 2 * mult;
            const mVal = (b.mystic + 2) * mult;
            this.food += fVal;
            this.wood += wVal;
            this.mystic += mVal;
            this.toastQueue.push({ r, c, text: `3連結コンボ!` });
            this.addLog(`★ 3連結コンボボーナス獲得 (${terrain.name})`);
        } else if (connectionCount >= 4) {
            this.ember += 2 * mult;
            const fVal = b.food * 3 * mult;
            const wVal = b.wood * 3 * mult;
            const mVal = (b.mystic + 5) * mult;
            this.food += fVal;
            this.wood += wVal;
            this.mystic += mVal;
            this.toastQueue.push({ r, c, text: `4連結最大コンボ! 🔥+${2*mult}` });
            this.addLog(`★ 4連結最大コンボボーナス! 🔥+${2*mult} 回復! (${terrain.name})`);
        }
    }

    processTurnEndMaintenance() {
        const foodCost = 20;
        let deficit = 0;
        if (this.food >= foodCost) {
            this.food -= foodCost;
        } else {
            deficit = foodCost - this.food;
            this.food = 0;
            this.ember -= deficit;
            this.addLog(`⚠️ 食料不足! 🔥 -${deficit} ダメージ!`);
        }

        const isGameOver = (this.ember <= 0);
        const isGameClear = (this.turn >= 50 && this.ember > 0);

        return {
            foodCost,
            deficit,
            isGameOver,
            isGameClear
        };
    }

    calculateTotalDefense() {
        let total = 10;
        const size = this.stage.size;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const cell = this.grid[r][c];
                if (cell.placed && cell.terrain && !cell.isHQ) {
                    let tileDef = cell.terrain.defense || 0;
                    if (cell.socketResource) {
                        tileDef += cell.socketResource.bonusDefense || 0;
                    }
                    total += tileDef;
                }
            }
        }
        return total;
    }

    // 本営周囲8マスは配置済みマス (placed === true) のみ +1/マス 加算
    calculateTotalProduction() {
        let totalFood = 10;
        let totalWood = 10;
        let totalMystic = 1;
        const size = this.stage.size;

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const cell = this.grid[r][c];
                if (cell.placed && cell.terrain && !cell.isHQ) {
                    let food = cell.terrain.food || 0;
                    let wood = cell.terrain.wood || 0;
                    if (cell.socketResource) {
                        food += cell.socketResource.bonusFood || 0;
                        wood += cell.socketResource.bonusWood || 0;
                    }

                    /* 本営近郊（周囲8マス）かつ配置済みマスのみ +1/マス 加算 */
                    if (this.isHQVicinity(r, c)) {
                        food += 1;
                        wood += 1;
                    }

                    totalFood += food;
                    totalWood += wood;
                }
            }
        }

        return { totalFood, totalWood, totalMystic };
    }

    getResourceBreakdown() {
        const breakdown = {
            food: { base: 10, tiles: 0, sockets: 0, vicinity: 0, total: 10 },
            wood: { base: 10, tiles: 0, sockets: 0, vicinity: 0, total: 10 },
            defense: { base: 10, tiles: 0, sockets: 0, vicinity: 0, total: 10 },
            mystic: { base: 1, total: 1 }
        };

        const size = this.stage.size;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const cell = this.grid[r][c];
                if (cell.placed && cell.terrain && !cell.isHQ) {
                    breakdown.food.tiles += (cell.terrain.food || 0);
                    breakdown.wood.tiles += (cell.terrain.wood || 0);
                    breakdown.defense.tiles += (cell.terrain.defense || 0);

                    if (cell.socketResource) {
                        breakdown.food.sockets += (cell.socketResource.bonusFood || 0);
                        breakdown.wood.sockets += (cell.socketResource.bonusWood || 0);
                        breakdown.defense.sockets += (cell.socketResource.bonusDefense || 0);
                    }

                    if (this.isHQVicinity(r, c)) {
                        breakdown.food.vicinity += 1;
                        breakdown.wood.vicinity += 1;
                    }
                }
            }
        }

        breakdown.food.total = breakdown.food.base + breakdown.food.tiles + breakdown.food.sockets + breakdown.food.vicinity;
        breakdown.wood.total = breakdown.wood.base + breakdown.wood.tiles + breakdown.wood.sockets + breakdown.wood.vicinity;
        breakdown.defense.total = breakdown.defense.base + breakdown.defense.tiles + breakdown.defense.sockets + breakdown.defense.vicinity;

        return breakdown;
    }

    getTrialNotice() {
        const cycle = 15;
        const currentTurn = this.turn;
        const nextTrialTurn = Math.ceil(currentTurn / cycle) * cycle;
        const remaining = nextTrialTurn - currentTurn;

        const active = (remaining <= 5);
        return {
            active,
            remaining,
            trialTurn: nextTrialTurn
        };
    }

    checkMergePatterns() {
        const size = this.stage.size;
        let mergeFound = false;

        for (let r = 0; r < size - 1; r++) {
            for (let c = 0; c < size - 1; c++) {
                const c1 = this.grid[r][c];
                const c2 = this.grid[r][c+1];
                const c3 = this.grid[r+1][c];
                const c4 = this.grid[r+1][c+1];

                if (c1.placed && c2.placed && c3.placed && c4.placed) {
                    if (c1.terrain && c2.terrain && c3.terrain && c4.terrain &&
                        c1.terrain.id === c2.terrain.id &&
                        c1.terrain.id === c3.terrain.id &&
                        c1.terrain.id === c4.terrain.id &&
                        !c1.isHQ && !c2.isHQ && !c3.isHQ && !c4.isHQ &&
                        !c1.merged && !c2.merged && !c3.merged && !c4.merged) {

                        c1.merged = c2.merged = c3.merged = c4.merged = true;
                        mergeFound = true;

                        const isHQVic = this.isHQVicinity(r, c) || this.isHQVicinity(r+1, c+1);
                        const emberVal = isHQVic ? 2 : 1;
                        this.ember += emberVal;

                        if (c1.terrain.id === "H3_MOUNTAIN") {
                            this.toastQueue.push({ r, c, text: `🔥 +${emberVal} 🛡️ +30 (マージ)` });
                            this.addLog("🎉 H3 凸字山岳マージ成立!");
                        } else {
                            this.toastQueue.push({ r, c, text: `🔥 +${emberVal} (マージ)` });
                            this.addLog(`🎉 2x2 正方形マージ成立 (${c1.terrain.name})!`);
                        }
                    }
                }
            }
        }
        return mergeFound;
    }

    moveToReserve(cardIndex) {
        if (cardIndex < 0 || cardIndex >= this.handOffering.length) return false;
        const card = this.handOffering[cardIndex];

        for (let i = 0; i < 3; i++) {
            if (this.reserveSlots[i] === null) {
                this.reserveSlots[i] = card;
                this.handOffering.splice(cardIndex, 1);
                this.addLog(`カードを保留エリアへ移動: ${card.name}`);
                return true;
            }
        }
        return false;
    }
}

class Step1DrawSystem {
    constructor(state) {
        this.state = state;
        this.deck = [
            { id: "C_GRASS", name: "草原", terrain: Step1Terrains.GL1_GRASS, shape: [[1,1]] },
            { id: "C_FOREST", name: "森", terrain: Step1Terrains.GL2_FOREST, shape: [[1,1]] },
            { id: "C_HILL", name: "丘陵", terrain: Step1Terrains.H2_HILL, shape: [[1,1]] },
            { id: "C_MOUNTAIN", name: "山岳", terrain: Step1Terrains.H3_MOUNTAIN, shape: [[1,1]] }
        ];
    }

    generateOfferingCards() {
        let drawn = [];
        for (let i = 0; i < 3; i++) {
            const item = this.deck[Math.floor(Math.random() * this.deck.length)];
            drawn.push({
                ...item,
                currentShape: JSON.parse(JSON.stringify(item.shape))
            });
        }
        this.state.handOffering = drawn;
        this.state.hasPickedThisTurn = false;
    }
}

function rotateShapeMatrix(matrix) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    let rotated = Array.from({ length: cols }, () => Array(rows).fill(0));
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            rotated[c][rows - 1 - r] = matrix[r][c];
        }
    }
    return rotated;
}

if (typeof window !== 'undefined') {
    window.Step1Engine = {
        Step1Terrain,
        Step1Terrains,
        GameState,
        Step1DrawSystem,
        rotateShapeMatrix
    };
}
