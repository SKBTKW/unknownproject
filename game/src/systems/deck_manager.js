import { I18n } from '../i18n.js';
import { LAND_SYSTEM_DATA } from '../data/land_system.js';
import { DIRECTIVES } from './directive_system.js';
import { LAND_CARDS_MASTER } from '../data/land_cards_data.js';

class DeckManager {
    constructor(gameState, engine = null) {
        this.state = gameState;
        this.engine = engine;
        this._landCardMasterCache = null;
    }

    /**
     * 🎴 マスターデータベース（静的キャッシュ ＆ 即時解決）の取得
     */
    getLandCardMaster() {
        if (this._landCardMasterCache && this._landCardMasterCache.length > 0) {
            return this._landCardMasterCache;
        }

        if (Array.isArray(LAND_CARDS_MASTER) && LAND_CARDS_MASTER.length > 0) {
            this._landCardMasterCache = LAND_CARDS_MASTER;
            return this._landCardMasterCache;
        }

        const globalData = (typeof globalThis !== 'undefined' && globalThis.LAND_CARDS_DATA) ? globalThis.LAND_CARDS_DATA : (typeof window !== 'undefined' ? window.LAND_CARDS_DATA : null);
        if (Array.isArray(globalData) && globalData.length > 0) {
            this._landCardMasterCache = globalData;
            return this._landCardMasterCache;
        }

        // rules/09_card_list.md 仕様書完全準拠のフォールバックデータ
        this._landCardMasterCache = [
            { id: "CARD_PLAINS_1X1", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", gl: 1, e: 1, yields: { food: 4, wood: 0, defense: 0, mystic: 0 }, shape: [[1]], minStage: 1, reqE2: 0, rarity: "C", weight: 1.0 },
            { id: "CARD_PLAINS_1X2", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", gl: 1, e: 1, yields: { food: 4, wood: 0, defense: 0, mystic: 0 }, shape: [[1, 1]], minStage: 1, reqE2: 0, rarity: "C", weight: 0.8 },
            { id: "CARD_PLAINS_1X3_S", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", gl: 1, e: 1, yields: { food: 4, wood: 0, defense: 0, mystic: 0 }, shape: [[1, 1, 1]], minStage: 2, reqE2: 0, rarity: "R", weight: 0.18 },
            { id: "CARD_PLAINS_1X3_L", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", gl: 1, e: 1, yields: { food: 4, wood: 0, defense: 0, mystic: 0 }, shape: [[1, 0], [1, 1]], minStage: 2, reqE2: 0, rarity: "R", weight: 0.14 },
            { id: "CARD_FOREST_1X1", terrainId: "GL2_FOREST", nameKey: "TERRAIN_FOREST", gl: 2, e: 1, yields: { food: 2, wood: 2, defense: 2, mystic: 0 }, shape: [[1]], minStage: 1, reqE2: 0, rarity: "C", weight: 1.0 },
            { id: "CARD_FOREST_1X2", terrainId: "GL2_FOREST", nameKey: "TERRAIN_FOREST", gl: 2, e: 1, yields: { food: 2, wood: 2, defense: 2, mystic: 0 }, shape: [[1, 1]], minStage: 1, reqE2: 0, rarity: "UC", weight: 0.6 },
            { id: "CARD_DEEP_FOREST_1X1", terrainId: "GL3_DEEP_FOREST", nameKey: "TERRAIN_DEEP_FOREST", gl: 3, e: 1, yields: { food: 1, wood: 3, defense: 3, mystic: 1 }, shape: [[1]], minStage: 1, reqE2: 0, rarity: "R", weight: 0.15 },
            { id: "CARD_DEEP_FOREST_1X2", terrainId: "GL3_DEEP_FOREST", nameKey: "TERRAIN_DEEP_FOREST", gl: 3, e: 1, yields: { food: 1, wood: 3, defense: 3, mystic: 1 }, shape: [[1, 1]], minStage: 2, reqE2: 0, rarity: "R", weight: 0.05 },
            { id: "CARD_HILL_1X1", terrainId: "E2_HILL", nameKey: "TERRAIN_HILL", gl: 1, e: 2, yields: { food: 2, wood: 1, defense: 1, mystic: 0 }, shape: [[1]], minStage: 1, reqE2: 0, rarity: "UC", weight: 0.50 },
            { id: "CARD_HILL_1X2", terrainId: "E2_HILL", nameKey: "TERRAIN_HILL", gl: 1, e: 2, yields: { food: 2, wood: 1, defense: 1, mystic: 0 }, shape: [[1, 1]], minStage: 1, reqE2: 0, rarity: "UC", weight: 0.35 },
            { id: "CARD_HILL_1X3_L", terrainId: "E2_HILL", nameKey: "TERRAIN_HILL", gl: 1, e: 2, yields: { food: 2, wood: 1, defense: 1, mystic: 0 }, shape: [[1, 0], [1, 1]], minStage: 2, reqE2: 0, rarity: "R", weight: 0.12 },
            { id: "CARD_MOUNTAIN_1X1", terrainId: "E3_MOUNTAIN", nameKey: "TERRAIN_MOUNTAIN", gl: 2, e: 3, yields: { food: 0, wood: 3, defense: 5, mystic: 1 }, shape: [[1]], minStage: 2, reqE2: 3, rarity: "R", weight: 0.20 },
            { id: "CARD_MOUNTAIN_1X2", terrainId: "E3_MOUNTAIN", nameKey: "TERRAIN_MOUNTAIN", gl: 2, e: 3, yields: { food: 0, wood: 3, defense: 5, mystic: 1 }, shape: [[1, 1]], minStage: 2, reqE2: 3, rarity: "R", weight: 0.15 },
            { id: "CARD_MOUNTAIN_1X3_S", terrainId: "E3_MOUNTAIN", nameKey: "TERRAIN_MOUNTAIN", gl: 2, e: 3, yields: { food: 0, wood: 3, defense: 5, mystic: 1 }, shape: [[1, 1, 1]], minStage: 2, reqE2: 3, rarity: "R", weight: 0.03 },
            { id: "CARD_DESERT_1X1", terrainId: "GL0_DESERT", nameKey: "TERRAIN_DESERT", gl: 0, e: 1, yields: { food: 0, wood: 0, defense: 0, mystic: 5 }, shape: [[1]], minStage: 1, reqE2: 0, rarity: "R", weight: 0.15 },
            { id: "CARD_DESERT_1X2", terrainId: "GL0_DESERT", nameKey: "TERRAIN_DESERT", gl: 0, e: 1, yields: { food: 0, wood: 0, defense: 0, mystic: 5 }, shape: [[1, 1]], minStage: 2, reqE2: 0, rarity: "UR", weight: 0.03 },

            // コマンドカード 『土地探索』 (ドロー条件: 盤面にソケットが存在しない時)
            { id: "CMD_LAND_EXPLORATION", category: "COMMAND", nameKey: "CMD_LAND_EXPLORATION_NAME", descriptionKey: "CMD_LAND_EXPLORATION_DESC", cost: { food: 30, wood: 30, ember: 1 }, noSocketsOnBoard: true, minStage: 1, rarity: "R", weight: 0.40 },
            { id: "CMD_CONSERVE_EMBER", category: "COMMAND", nameKey: "CMD_CONSERVE_EMBER_NAME", descriptionKey: "CMD_CONSERVE_EMBER_DESC", cost: {}, maxEmber: 18, minStage: 1, rarity: "C", weight: 0.40 },
            { id: "CMD_RATIONING", category: "COMMAND", nameKey: "CMD_RATIONING_NAME", descriptionKey: "CMD_RATIONING_DESC", cost: {}, maxFood: 40, minStage: 1, rarity: "C", weight: 0.40 },
            { id: "CMD_MEDITATION", category: "COMMAND", nameKey: "CMD_MEDITATION_NAME", descriptionKey: "CMD_MEDITATION_DESC", cost: {}, maxMystic: 20, minStage: 1, rarity: "UC", weight: 0.30 },
            { id: "CMD_VIGILANCE", category: "COMMAND", nameKey: "CMD_VIGILANCE_NAME", descriptionKey: "CMD_VIGILANCE_DESC", cost: { wood: 15 }, reqTrialOrLowDefense: true, minStage: 1, rarity: "C", weight: 0.35 }
        ];
        return this._landCardMasterCache;
    }

    /**
     * 🔍 カード抽選適格性判定
     */
    isCardEligible(c, stageNum, h2Count) {
        if (!c) return false;
        const cardStage = c.minStage || 1;
        if (cardStage > stageNum) return false;

        // 🚫 バフ発動中は同系統バイアス付与カードの重複提示を遮断
        if (c.biasTarget || c.id === "CMD_LAND_FOCUS" || c.id === "CMD_MILITARY_FOCUS" || c.id === "CMD_MYSTIC_FOCUS") {
            if (this.state && (this.state.activeDrawBias || this.state.drawBias)) {
                return false;
            }
        }

        if (c.reqE2HillsOnBoard && h2Count < c.reqE2HillsOnBoard) return false;

        if (c.reqHillOrMountainAroundHQ && this.state && this.state.grid) {
            let found = false;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const r = 2 + dr;
                    const cCol = 2 + dc;
                    const cell = this.state.grid[r][cCol];
                    if (cell && cell.placed && cell.terrain) {
                        const tid = cell.terrain.terrainId || cell.terrain.id;
                        if (tid === "E2_HILL" || tid === "E3_MOUNTAIN") { found = true; break; }
                    }
                }
                if (found) break;
            }
            if (!found) return false;
        }

        if (c.reqNoHillOrMountainAroundHQ && this.state && this.state.grid) {
            let countHM = 0;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const r = 2 + dr;
                    const cCol = 2 + dc;
                    const cell = this.state.grid[r][cCol];
                    if (cell && cell.placed && cell.terrain) {
                        const tid = cell.terrain.terrainId || cell.terrain.id;
                        if (tid === "E2_HILL" || tid === "E3_MOUNTAIN") countHM++;
                    }
                }
            }
            if (countHM === 0) return false;
        }

        if (c.reqUnmergedDesertOrMountain && this.state && this.state.grid) {
            let found = false;
            for (let r = 0; r < 5; r++) {
                for (let cCol = 0; cCol < 5; cCol++) {
                    const cell = this.state.grid[r][cCol];
                    if (cell && cell.placed && !cell.merged && cell.terrain) {
                        const tid = cell.terrain.terrainId || cell.terrain.id;
                        if (tid === "GL0_DESERT" || tid === "E3_MOUNTAIN") { found = true; break; }
                    }
                }
            }
            if (!found) return false;
        }

        if (c.reqStage2End && this.state) {
            if (this.state.turn < 20) return false;
        }

        if (c.maxPlacedBlocks !== undefined && this.state && typeof this.state.countPlacedTiles === 'function') {
            if (this.state.countPlacedTiles() > c.maxPlacedBlocks) return false;
        }
        if (c.maxDefense !== undefined && this.state && typeof this.state.calculateTotalDefense === 'function') {
            if (this.state.calculateTotalDefense() > c.maxDefense) return false;
        }
        if (c.maxMystic !== undefined && this.state && this.state.mystic !== undefined) {
            if (this.state.mystic > c.maxMystic) return false;
        }
        if (c.maxFood !== undefined && this.state && this.state.food !== undefined) {
            if (this.state.food > c.maxFood) return false;
        }
        if (c.maxEmber !== undefined && this.state && this.state.ember !== undefined) {
            if (this.state.ember > c.maxEmber) return false;
        }
        if (c.reqTrialOrLowDefense && this.state) {
            const notice = (typeof this.state.getTrialNotice === 'function') ? this.state.getTrialNotice() : { active: false };
            const def = (typeof this.state.calculateTotalDefense === 'function') ? this.state.calculateTotalDefense() : (this.state.defense || 0);
            if (!notice.active && def > 30) return false;
        }

        if (c.noSocketsOnBoard && this.state && this.state.grid) {
            let hasSocket = false;
            for (let r = 0; r < 5; r++) {
                for (let cCol = 0; cCol < 5; cCol++) {
                    const cell = this.state.grid[r][cCol];
                    if (cell && cell.socketResource) {
                        hasSocket = true;
                        break;
                    }
                }
                if (hasSocket) break;
            }
            if (hasSocket) return false;
        }

        if (c.reqWood !== undefined && this.state && this.state.wood < c.reqWood) return false;
        if (c.reqFood !== undefined && this.state && this.state.food < c.reqFood) return false;

        if (c.reqPlains !== undefined && this.state && this.state.grid) {
            let plainsCount = 0;
            for (let r = 0; r < 5; r++) {
                for (let cCol = 0; cCol < 5; cCol++) {
                    const cell = this.state.grid[r][cCol];
                    if (cell && cell.placed && !cell.isHQ && cell.terrain) {
                        const tid = cell.terrain.terrainId || cell.terrain.id || "";
                        if (tid.includes("PLAINS")) plainsCount++;
                    }
                }
            }
            if (plainsCount < c.reqPlains) return false;
        }

        if (c.isUnique && this.state && this.state.usedUniqueCards && this.state.usedUniqueCards.includes(c.id)) {
            return false;
        }

        return true;
    }

    /**
     * 🎲 単一カードの重み付け抽選
     * @param {Array<string>} [excludedCommandIds=[]] - 同一オファリング内・保留枠で重複排除するコマンドカードIDリスト
     */
    drawSingleCard(excludedCommandIds = []) {
        const master = this.getLandCardMaster();
        const stageNum = (this.state && this.state.stage) ? (typeof this.state.stage === 'object' ? (this.state.stage.id || 1) : this.state.stage) : 1;
        const h2Count = (this.state && typeof this.state.countE2HillsOnBoard === 'function') ? this.state.countE2HillsOnBoard() : 0;

        let eligible = master.filter(c => this.isCardEligible(c, stageNum, h2Count));

        // 🛡️ 同一コマンドカード重複ピック禁止ガードレール
        if (Array.isArray(excludedCommandIds) && excludedCommandIds.length > 0) {
            eligible = eligible.filter(c => !(c.category && c.category !== "LAND" && excludedCommandIds.includes(c.id)));
        }

        if (eligible.length === 0) {
            eligible = master.filter(c => (c.category === "LAND" || !c.category) && (c.minStage || 1) <= stageNum);
        }

        const activeBiasCategory = (this.state && this.state.activeDrawBias) ? this.state.activeDrawBias.targetCategory : null;

        let totalW = eligible.reduce((acc, c) => {
            let w = c.weight || 0.1;
            const cat = c.category || "LAND";
            let dirMult = 1.0;
            if (this.state && this.state.directiveSystem) {
                dirMult = this.state.directiveSystem.getCategoryWeightMultiplier(cat);
            }
            let biasMult = 1.0;
            if (activeBiasCategory && cat === activeBiasCategory) {
                biasMult = 2.0;
            }
            return acc + (w * dirMult * biasMult);
        }, 0);

        let rand = Math.random() * totalW;
        let chosen = eligible[0];

        for (let c of eligible) {
            let w = c.weight || 0.1;
            const cat = c.category || "LAND";
            let dirMult = 1.0;
            if (this.state && this.state.directiveSystem) {
                dirMult = this.state.directiveSystem.getCategoryWeightMultiplier(cat);
            }
            let biasMult = 1.0;
            if (activeBiasCategory && cat === activeBiasCategory) {
                biasMult = 2.0;
            }
            const finalW = w * dirMult * biasMult;
            if (rand <= finalW) {
                chosen = c;
                break;
            }
            rand -= finalW;
        }

        const picked = chosen || eligible[0] || master[0];
        return {
            id: `card_${(this.state ? this.state.turn : 1)}_${Date.now()}_${Math.random()}`,
            cardMasterId: picked.id,
            nameKey: picked.nameKey,
            terrain: picked,
            currentShape: picked.shape || [[1]]
        };
    }

    /**
     * 🃏 手札オファリングの生成 (標準 3 枚 ＆ 同一コマンドカード重複排除)
     */
    generateOfferingCards() {
        const offeringSize = (this.state && this.state.handOfferingSize) ? this.state.handOfferingSize : 3;
        const newCards = [];
        const excludedCommandIds = [];

        // 📥 保留スロットにあるコマンドカードも手札重複から除外
        if (this.state && this.state.reserveSlots) {
            this.state.reserveSlots.forEach(rc => {
                if (rc && !rc.isBlank) {
                    const tObj = rc.terrain || rc;
                    if (tObj && tObj.category && tObj.category !== "LAND") {
                        const mId = rc.cardMasterId || tObj.id || rc.id;
                        if (mId) excludedCommandIds.push(mId);
                    }
                }
            });
        }

        for (let i = 0; i < offeringSize; i++) {
            const drawn = this.drawSingleCard(excludedCommandIds);
            newCards.push(drawn);
            if (drawn && drawn.terrain && drawn.terrain.category && drawn.terrain.category !== "LAND") {
                const cId = drawn.cardMasterId || drawn.terrain.id;
                if (cId) excludedCommandIds.push(cId);
            }
        }

        if (this.state) {
            this.state.handOffering = newCards;
            this.state.offeringCards = newCards;
        }
        return newCards;
    }

    /**
     * 🎲 1ターン1回マリガン実行 (🔥-1, 連続使用遮断)
     */
    mulligan() {
        if (!this.state) return { success: false, reason: "NO_STATE" };
        if (this.state.hasPickedThisTurn) return { success: false, reason: "ALREADY_PICKED_THIS_TURN" };
        if (this.state.hasMulliganedThisTurn) return { success: false, reason: "ALREADY_MULLIGANED_THIS_TURN" };
        if (this.state.ember < 1) return { success: false, reason: "INSUFFICIENT_EMBER" };

        this.state.ember -= 1;
        this.state.hasMulliganedThisTurn = true;
        this.generateOfferingCards();

        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' && window.I18n ? window.I18n : { t: k => k });
        if (typeof this.state.addLog === 'function') {
            this.state.addLog(I18n.t("LOG_MULLIGAN_EXECUTED") || "🎲 マリガン実行: 🔥 -1 を消費して手札を再抽選しました。");
        }

        return { success: true };
    }

    /**
     * 📥 手札 ➔ 保留スロットへの移動 (最大3枠)
     */
    moveToReserve(cardIdx) {
        if (!this.state || !this.state.handOffering || !this.state.reserveSlots) return false;
        const card = this.state.handOffering[cardIdx];
        if (!card || card.isBlank) return false;

        const emptyIdx = this.state.reserveSlots.findIndex(slot => slot === null);
        if (emptyIdx === -1) return false;

        card.originalHandIdx = cardIdx;
        this.state.reserveSlots[emptyIdx] = card;

        // 手札の抜け部分はカード裏表示 (isBlank: true)
        this.state.handOffering[cardIdx] = {
            isBlank: true,
            originalCard: card,
            id: `blank_${cardIdx}`
        };

        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' && window.I18n ? window.I18n : { t: k => k });
        const cName = card.terrain ? I18n.t(card.terrain.nameKey) : "土地カード";
        if (typeof this.state.addLog === 'function') {
            this.state.addLog(I18n.t("LOG_RESERVE_ADDED", { name: cName, slot: emptyIdx + 1 }) || `📥 保留登録: ${cName} を保留スロット ${emptyIdx + 1} へ移動。`);
        }
        return true;
    }

    /**
     * 📤 保留スロット ➔ 手札への復元
     */
    returnFromReserve(reserveIdx) {
        if (!this.state || !this.state.handOffering || !this.state.reserveSlots) return false;
        const card = this.state.reserveSlots[reserveIdx];
        if (!card) return false;

        const origIdx = card.originalHandIdx;
        if (origIdx !== undefined && this.state.handOffering[origIdx] && this.state.handOffering[origIdx].isBlank) {
            this.state.handOffering[origIdx] = card;
            delete card.originalHandIdx;
            this.state.reserveSlots[reserveIdx] = null;

            const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' && window.I18n ? window.I18n : { t: k => k });
            const cName = card.terrain ? I18n.t(card.terrain.nameKey) : "土地カード";
            if (typeof this.state.addLog === 'function') {
                this.state.addLog(I18n.t("LOG_RESERVE_RETURNED", { name: cName }) || `↩ [保留復元] ${cName} を手札に戻しました。`);
            }
            return true;
        }
        return false;
    }

    /**
     * 📜 コマンドカードの発動処理
     */
    playCommandCard(cardObj, targetTile = null, handIdx = -1, reserveIdx = -1) {
        if (!this.state || !cardObj || cardObj.category === "LAND") return { success: false, reason: "NOT_A_COMMAND_CARD" };

        const cost = cardObj.cost || {};
        const matCost = cost.material !== undefined ? cost.material : (cost.wood || 0);
        const curMat = this.state.material !== undefined ? this.state.material : (this.state.wood || 0);

        if (cost.food && this.state.food < cost.food) return { success: false, reason: "NOT_ENOUGH_FOOD" };
        if (matCost > 0 && curMat < matCost) return { success: false, reason: "NOT_ENOUGH_MATERIAL" };
        if (cost.mystic && this.state.mystic < cost.mystic) return { success: false, reason: "NOT_ENOUGH_MYSTIC" };
        if (cost.ember && this.state.ember < cost.ember) return { success: false, reason: "NOT_ENOUGH_EMBER" };

        if (cost.food) this.state.food -= cost.food;
        if (matCost > 0) {
            this.state.wood = Math.max(0, (this.state.wood || 0) - matCost);
            this.state.material = this.state.wood;
        }
        if (cost.mystic) this.state.mystic -= cost.mystic;
        if (cost.ember) this.state.ember -= cost.ember;

        const cId = cardObj.id;
        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' && window.I18n ? window.I18n : { t: k => k });
        const cName = I18n.t(cardObj.nameKey) || I18n.t(`${cardObj.id}_NAME`) || I18n.t(cardObj.id) || cardObj.id;

        // 🎴 発動スロットの消費（手札の場合は空きスロット化、保留の場合は空スロット化）
        if (handIdx >= 0 && this.state.handOffering && this.state.handOffering[handIdx]) {
            this.state.handOffering[handIdx] = { isBlank: true, originalCard: cardObj, id: `blank_${handIdx}_${Date.now()}` };
            this.state.hasPickedThisTurn = true;
        } else if (reserveIdx >= 0 && this.state.reserveSlots) {
            this.state.reserveSlots[reserveIdx] = null;
            this.state.hasPickedThisTurn = true;
        }

        if (cId === "CMD_AGRICULTURAL_POLICY") {
            // 🌾 農地改革: コスト 🧱-20
            this.state.permanentPlainsFoodBonus = (this.state.permanentPlainsFoodBonus || 0) + 1;
            this.state.addLog(`📜【${cName}】発動 (コスト: 🧱-20) ➔ 全ての草原マスの食料産出が 🌾+1/T 永続加算されました！`);
        } else if (cId === "CMD_BLACK_MARKET") {
            // 💰 闇市場の一括売却: コスト 🌾-25
            this.state.wood += 35;
            this.state.mystic += 10;
            this.state.addLog(`📜【${cName}】発動 (コスト: 🌾-25) ➔ 🧱+35 ＆ ✨+10 を一括獲得しました！`);
        } else if (cId === "CMD_IRON_RAMPART") {
            // 🛡️ 鉄壁の防壁構築: コスト 🧱-20
            this.state.defense += 25;
            this.state.permanentVicinityDefenseBonus = (this.state.permanentVicinityDefenseBonus || 0) + 2;
            this.state.addLog(`🛡️【${cName}】発動 (コスト: 🧱-20) ➔ 防衛力 🛡️+25 獲得 ＆ 本営近郊8マスの防衛力が 🛡️+2/T 永続加算されました！`);
        } else if (cId === "CMD_BALLISTA_SET") {
            // 🏹 迎撃用弩砲陣地: コスト 🧱-30
            this.state.defense += 40;
            this.state.nextTrialDamageMitigation = 0.5;
            this.state.addBuff({
                id: cId,
                name: "🏹 大型バリスタ配備",
                shortName: "防衛+40/軽減50%",
                icon: "🏹",
                description: "防衛力 🛡️+40 ＆ 次回試練ダメージ50%軽減",
                badgeText: "試練対策",
                category: "CARD_EFFECT"
            });
            this.state.addLog(`🏹【${cName}】発動 (コスト: 🧱-30) ➔ 防衛力 🛡️+40 獲得 ＆ 次回の試練被ダメージを 50% 軽減（半減無効化）！`);
        } else if (cId === "CMD_REKINDLE_EMBER") {
            // ✨ 🔥の聖なる再燃: コスト ✨-10
            this.state.ember = this.state.ember + 3;
            this.state.reserveFeeWaivedTurns = 3;
            this.state.addBuff({
                id: cId,
                name: "✨ 🔥の再点火",
                shortName: "保留費無料化",
                icon: "✨",
                description: "保留スロット利用料 3T無料化",
                badgeText: "残り 3T",
                category: "CARD_EFFECT",
                remainingTurns: 3
            });
            this.state.addLog(`✨【${cName}】発動 (コスト: ✨-10) ➔ 🔥+3 回復 ＆ 3ターンの間手札保留スロット利用料を無料化しました！`);
        } else if (cId === "CMD_TRANSMUTE_GOLDEN") {
            // 💎 黄金秘境への変容: コスト ✨-20
            if (targetTile && targetTile.r !== undefined && targetTile.c !== undefined && this.state.grid) {
                const cell = this.state.grid[targetTile.r][targetTile.c];
                cell.socketResource = { nameKey: "SOCKET_SACRED_VEIN", bonusMystic: 5, bonusEmber: 1 };
                this.state.addLog(`💎【${cName}】発動 (コスト: ✨-20) ➔ 土地 (${targetTile.r}, ${targetTile.c}) を聖なる光脈 (✨+5 ＆ 🔥+1/T) へ変容しました！`);
            } else {
                this.state.mystic += 10;
                this.state.addLog(`💎【${cName}】発動 (コスト: ✨-20) ➔ ✨+10 を獲得しました！`);
            }
        } else if (cId === "FAC_GREAT_WINDMILL") {
            // 🏛️ 大風車工房の建設: コスト 🧱-15
            if (!this.state.activeConstructionProjects) this.state.activeConstructionProjects = [];
            this.state.activeConstructionProjects.push({ name: "FAC_GREAT_WINDMILL", remainingTurns: 3, woodCostPerTurn: 4 });
            this.state.addLog(`🏛️【${cName}】発動 (コスト: 🧱-15) ➔ 大風車の建設を開始しました (3ターン継続投資)！`);
        } else if (cId === "LGD_DESPERATE_PACT") {
            // 📜 背水の盟約: コスト なし
            this.state.ember = this.state.ember + 5;
            this.state.handOfferingSize = 4;
            this.state.nextTrialMultiplier = 1.5;
            this.state.addLog(`🔥【${cName}】発動 ➔ 🔥+5 獲得 ＆ 手札オファリング枠が永久に4枚へ拡張されました！`);
        } else if (cId === "CMD_LAND_FOCUS") {
            // 📜 土地探索重視: コスト 🌾-10 🧱-10
            this.state.activeDrawBias = { targetCategory: "LAND", type: "UNTIL_BLOCKS", untilValue: 6 };
            this.state.addBuff({
                id: cId,
                name: "📜 土地探索注力",
                shortName: "土地確率2倍",
                icon: "📜",
                description: "盤面6ブロック到達まで土地出現率2倍",
                badgeText: "ドロー制御",
                category: "CARD_EFFECT"
            });
            this.state.addLog(`📜【${cName}】発動 (コスト: 🌾-10 🧱-10) ➔ 盤面6ブロック到達まで土地出現率が 2倍 になりました！`);
        } else if (cId === "CMD_MILITARY_FOCUS") {
            // ⚔️ 軍事重視: コスト 🧱-20
            this.state.activeDrawBias = { targetCategory: "MILITARY", type: "UNTIL_DEFENSE", untilValue: 20 };
            this.state.addBuff({
                id: cId,
                name: "🛡️ 軍備強化注力",
                shortName: "軍事確率2倍",
                icon: "🛡️",
                description: "防衛力20到達まで軍事出現率2倍",
                badgeText: "ドロー制御",
                category: "CARD_EFFECT"
            });
            this.state.addLog(`⚔️【${cName}】発動 (コスト: 🧱-20) ➔ 防衛力20到達まで軍事カード出現率が 2倍 になりました！`);
        } else if (cId === "CMD_MYSTIC_FOCUS") {
            // ✨ 神秘重視: コスト 🔥-1
            this.state.activeDrawBias = { targetCategory: "MYSTIC", type: "TURNS", remainingTurns: 3 };
            this.state.addBuff({
                id: cId,
                name: "✨ 神秘探求注力",
                shortName: "神秘確率2倍",
                icon: "✨",
                description: "3ターンの間神秘出現率2倍",
                badgeText: "残り 3T",
                category: "CARD_EFFECT",
                remainingTurns: 3
            });
        } else if (cId === "CMD_CONSERVE_EMBER") {
            // 🔥 残火の節約: コスト 無料
            this.state.emberConsumptionReducedTurns = 1;
            this.state.addBuff({
                id: cId,
                name: "🔥 残火の節約",
                shortName: "自然減衰-1軽減",
                icon: "🔥",
                description: "次ターンの🔥消費(自然減衰)を 1 軽減",
                badgeText: "残り 1T",
                category: "CARD_EFFECT",
                remainingTurns: 1
            });
            this.state.addLog(`🔥【${cName}】発動 (コスト: 無料) ➔ 次ターンの🔥自然減衰を 1 軽減 (消費0) します！`);
        } else if (cId === "CMD_RATIONING") {
            // 🌾 節約配給: コスト 無料
            this.state.foodCostHalvedTurns = 1;
            this.state.food += 5;
            this.state.addBuff({
                id: cId,
                name: "🌾 節約配給",
                shortName: "食料維持費50%減",
                icon: "🌾",
                description: "今ターンの食料維持費を50%軽減 ＆ 🌾+5 獲得",
                badgeText: "残り 1T",
                category: "CARD_EFFECT",
                remainingTurns: 1
            });
            this.state.addLog(`🌾【${cName}】発動 (コスト: 無料) ➔ 今ターンの食料維持費を 50% 軽減し、🌾+5 を緊急獲得しました！`);
        } else if (cId === "CMD_MEDITATION") {
            // 🧘 静かなる瞑想: コスト 無料
            this.state.mystic += 3;
            this.state.activeDrawBias = { targetCategory: "LAND", type: "TURNS", remainingTurns: 1 };
            this.state.addBuff({
                id: cId,
                name: "🧘 静かなる瞑想",
                shortName: "✨+3 / 次T土地優先",
                icon: "🧘",
                description: "✨+3 獲得 ＆ 次ターンの土地出現を優先保証",
                badgeText: "残り 1T",
                category: "CARD_EFFECT",
                remainingTurns: 1
            });
            this.state.addLog(`🧘【${cName}】発動 (コスト: 無料) ➔ ✨+3 を獲得し、次ターンの手札に土地カードを優先保証しました！`);
        } else if (cId === "CMD_VIGILANCE") {
            // 🛡️ 警戒態勢: コスト 🧱-15 (2ターンの間、獲得する全ての🛡️に+3ボーナス)
            this.state.vigilanceTurns = 2;
            this.state.temporaryDefenseTurns = 2;
            this.state.addBuff({
                id: cId,
                name: "🛡️ 警戒態勢",
                shortName: "全🛡️獲得+3",
                icon: "🛡️",
                description: "2ターンの間、獲得する全ての🛡️に+3ボーナス",
                badgeText: "残り 2T",
                category: "CARD_EFFECT",
                remainingTurns: 2
            });
            this.state.addLog(`🛡️【${cName}】発動 (コスト: 🧱-15) ➔ 2ターンの間、獲得する全ての 🛡️ に +3 の追加ボーナスが付与されます！`);
        } else if (cId === "CMD_LAND_EXPLORATION") {
            const candidates = [];
            if (this.state.grid) {
                for (let r = 0; r < 5; r++) {
                    for (let c = 0; c < 5; c++) {
                        const cell = this.state.grid[r][c];
                        if (cell && cell.placed && !cell.isHQ && !cell.searched && !cell.merged) {
                            candidates.push({ r, c });
                        }
                    }
                }
            }

            if (candidates.length === 0) {
                return { success: false, reason: "NO_EXPLORABLE_TILES" };
            }

            const chosen = candidates[Math.floor(Math.random() * candidates.length)];
            this.state.addLog(`📜 ${cName}を発動！ コスト (🌾-30 🧱-30 🔥-1) を払い位置 (${String.fromCharCode(65+chosen.c)}${chosen.r+1}) で2D6探索を開始！`);
            const expRes = this.executeExploration(chosen.r, chosen.c);
            return { success: expRes.success };
        }

        if (cardObj.isUnique) {
            if (!this.state.usedUniqueCards) this.state.usedUniqueCards = [];
            this.state.usedUniqueCards.push(cId);
        }

        this.state.hasPickedThisTurn = true;
        return { success: true };
    }

    /**
     * 🔍 2D6 土地探索判定
     */
    executeExploration(r, c) {
        if (!this.state || !this.state.grid) return { success: false, reason: "NO_GRID" };
        const cell = this.state.grid[r][c];
        if (!cell || !cell.placed || cell.isHQ) return { success: false, reason: "INVALID_CELL" };
        if (cell.searched) return { success: false, reason: "ALREADY_SEARCHED" };

        cell.searched = true;
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        const totalRoll = d1 + d2;
        const posStr = `(${String.fromCharCode(65+c)}${r+1})`;
        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' && window.I18n ? window.I18n : { t: k => k });

        let resultMsg = "";
        if (totalRoll >= 8) {
            if (!cell.socketResource) {
                const baseTerrainId = cell.terrain ? (cell.terrain.terrainId || cell.terrain.id) : "GL1_PLAINS";
                const sysMaster = (typeof globalThis !== 'undefined' && globalThis.LAND_SYSTEM_DATA && globalThis.LAND_SYSTEM_DATA.sockets) ? globalThis.LAND_SYSTEM_DATA.sockets : null;
                let socketDef = null;

                if (sysMaster && sysMaster[baseTerrainId]) {
                    const candidates = sysMaster[baseTerrainId];
                    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
                    socketDef = {
                        nameKey: chosen.nameKey,
                        bonusFood: chosen.bonusYields.food || 0,
                        bonusWood: chosen.bonusYields.wood || 0,
                        bonusDefense: chosen.bonusYields.defense || 0,
                        bonusMystic: chosen.bonusYields.mystic || 0
                    };
                } else {
                    socketDef = { nameKey: "SOCKET_WILD_WHEAT", bonusFood: 3, bonusWood: 0, bonusMystic: 0 };
                }

                cell.socketResource = socketDef;
                const sName = I18n.t(socketDef.nameKey);
                resultMsg = `🎲 Roll ${totalRoll}: ★ ${sName}`;
                if (this.state.toastQueue) {
                    this.state.toastQueue.push({ r, c, text: I18n.t("TOAST_SOCKET_SPAWNED", { name: sName }) });
                }
            } else {
                this.state.food += 3;
                this.state.wood += 3;
                resultMsg = `🎲 Roll ${totalRoll}: Success 🌾+3 🧱+3`;
                if (this.state.toastQueue) {
                    this.state.toastQueue.push({ r, c, text: I18n.t("TOAST_EXPLORATION_SUCCESS") });
                }
            }
        } else if (totalRoll >= 5) {
            this.state.food += 2;
            resultMsg = `🎲 Roll ${totalRoll}: Result 🌾+2`;
            if (this.state.toastQueue) {
                this.state.toastQueue.push({ r, c, text: I18n.t("TOAST_EXPLORATION_MED") });
            }
        } else {
            this.state.food += 1;
            resultMsg = `🎲 Roll ${totalRoll}: Result 🌾+1`;
            if (this.state.toastQueue) {
                this.state.toastQueue.push({ r, c, text: I18n.t("TOAST_EXPLORATION_LOW") });
            }
        }

        if (typeof this.state.addLog === 'function') {
            this.state.addLog(I18n.t("LOG_EXPLORATION_RESULT", { pos: posStr, result: resultMsg }));
        }
        return { success: true };
    }

    /**
     * 🔄 ターン進行時のリフレッシュ（マリガン権回復）
     */
    onNextTurn() {
        if (!this.state) return;
        this.state.turn++;
        this.state.hasPickedThisTurn = false;
        this.state.hasMulliganedThisTurn = false;
        this.generateOfferingCards();
    }
}

if (typeof window !== "undefined") {
    window.DeckManager = DeckManager;
    window.Step1DrawSystem = DeckManager;
}
if (typeof globalThis !== "undefined") {
    globalThis.DeckManager = DeckManager;
    globalThis.Step1DrawSystem = DeckManager;
}

const Step1DrawSystem = DeckManager;
export { DeckManager, Step1DrawSystem };
export default DeckManager;

