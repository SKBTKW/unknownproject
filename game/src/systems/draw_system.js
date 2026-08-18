/* =============================================================
   game/src/systems/draw_system.js
   カードドロー・オファリング生成・確率抽出専用独立コンポーネント
   ============================================================= */

(function() {
    class Step1DrawSystem {
        constructor(gameState) {
            this.state = gameState;
        }

        getLandCardMaster() {
            if (typeof window !== "undefined" && window.LAND_CARDS_DATA && Array.isArray(window.LAND_CARDS_DATA)) {
                return window.LAND_CARDS_DATA;
            }
            return [
                { id: "PLAINS_1X1", nameKey: "LAND_PLAINS_1X1_NAME", category: "LAND", weight: 1.0, minStage: 1, shape: [[1]], terrain: { food: 4, wood: 0, defense: 0, mystic: 0, terrainId: "GL1_PLAINS" } }
            ];
        }

        isCardEligible(c, stageNum, h2Count) {
            if (!c) return false;
            const cardStage = c.minStage || 1;
            if (cardStage > stageNum) return false;

            // 🚫 バフ（activeDrawBias または drawBias）が発生している時、バフ指定カード（biasTargetを持つカード）はオファリング提示されない
            if (c.biasTarget || c.id === "CMD_LAND_FOCUS" || c.id === "CMD_MILITARY_FOCUS" || c.id === "CMD_MYSTIC_FOCUS") {
                if (this.state && (this.state.activeDrawBias || this.state.drawBias)) {
                    return false;
                }
            }

            if (c.reqH2HillsOnBoard && h2Count < c.reqH2HillsOnBoard) return false;

            if (c.reqHillOrMountainAroundHQ) {
                let found = false;
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const r = 2 + dr;
                        const cCol = 2 + dc;
                        const cell = this.state.grid[r][cCol];
                        if (cell.placed && cell.terrain) {
                            const tid = cell.terrain.terrainId || cell.terrain.id;
                            if (tid === "H2_HILL" || tid === "H3_MOUNTAIN") { found = true; break; }
                        }
                    }
                    if (found) break;
                }
                if (!found) return false;
            }

            if (c.reqNoHillOrMountainAroundHQ) {
                let countHM = 0;
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const r = 2 + dr;
                        const cCol = 2 + dc;
                        const cell = this.state.grid[r][cCol];
                        if (cell.placed && cell.terrain) {
                            const tid = cell.terrain.terrainId || cell.terrain.id;
                            if (tid === "H2_HILL" || tid === "H3_MOUNTAIN") countHM++;
                        }
                    }
                }
                if (countHM === 0) return false;
            }

            if (c.reqUnmergedDesertOrMountain) {
                let found = false;
                for (let r = 0; r < 5; r++) {
                    for (let cCol = 0; cCol < 5; cCol++) {
                        const cell = this.state.grid[r][cCol];
                        if (cell.placed && !cell.merged && cell.terrain) {
                            const tid = cell.terrain.terrainId || cell.terrain.id;
                            if (tid === "GL0_DESERT" || tid === "H3_MOUNTAIN") { found = true; break; }
                        }
                    }
                }
                if (!found) return false;
            }

            if (c.reqStage2End) {
                if (this.state.turn < 20) return false;
            }

            if (c.maxPlacedBlocks !== undefined && typeof this.state.countPlacedTiles === 'function') {
                if (this.state.countPlacedTiles() > c.maxPlacedBlocks) return false;
            }
            if (c.maxDefense !== undefined && typeof this.state.calculateTotalDefense === 'function') {
                if (this.state.calculateTotalDefense() > c.maxDefense) return false;
            }
            if (c.maxMystic !== undefined && this.state.mystic !== undefined) {
                if (this.state.mystic > c.maxMystic) return false;
            }

            if (c.noSocketsOnBoard) {
                let hasSocket = false;
                for (let r = 0; r < 5; r++) {
                    for (let cCol = 0; cCol < 5; cCol++) {
                        const cell = this.state.grid[r][cCol];
                        if (cell.socketResource) {
                            hasSocket = true;
                            break;
                        }
                    }
                    if (hasSocket) break;
                }
                if (hasSocket) return false;
            }

            // 🚫 バフ（activeDrawBias または drawBias）が発生している時、バフ指定カード（biasTargetを持つカード）はオファリング提示されない
            const hasActiveBiasBuff = this.state && (this.state.activeDrawBias || this.state.drawBias);
            if ((c.biasTarget || c.id === "CMD_LAND_FOCUS") && hasActiveBiasBuff) {
                return false;
            }

            if (c.isUnique && this.state.usedUniqueCards && this.state.usedUniqueCards.includes(c.id)) {
                return false;
            }

            return true;
        }

        drawSingleCard() {
            const master = this.getLandCardMaster();
            const stageNum = (this.state && this.state.stage) ? (typeof this.state.stage === 'object' ? (this.state.stage.id || 1) : this.state.stage) : 1;
            const h2Count = (this.state && typeof this.state.countH2HillsOnBoard === 'function') ? this.state.countH2HillsOnBoard() : 0;

            let eligible = master.filter(c => this.isCardEligible(c, stageNum, h2Count));
            if (eligible.length === 0) eligible = master.filter(c => (c.category === "LAND" || !c.category) && (c.minStage || 1) <= stageNum);

            let getCardWeight = (c) => {
                let baseW = c.weight || 0.1;
                let cat = c.category || "LAND";
                let dirMult = 1.0;
                if (this.state && this.state.directiveSystem) {
                    dirMult = this.state.directiveSystem.getCategoryWeightMultiplier(cat);
                }
                let biasMult = 1.0;
                if (this.state && this.state.activeDrawBias === cat) {
                    biasMult = 2.0;
                }
                return baseW * dirMult * biasMult;
            };

            let totalW = eligible.reduce((acc, c) => acc + getCardWeight(c), 0);
            let rand = Math.random() * totalW;
            let chosen = eligible[0];

            for (let c of eligible) {
                let w = getCardWeight(c);
                if (rand <= w) {
                    chosen = c;
                    break;
                }
                rand -= w;
            }
            if (!chosen) chosen = eligible[0] || master[0];

            return {
                id: `card_${(this.state && this.state.turn) || 1}_${Date.now()}_${Math.floor(Math.random()*1000)}`,
                cardMasterId: chosen.id,
                nameKey: chosen.nameKey,
                category: chosen.category || "LAND",
                rarity: chosen.rarity || "C",
                currentShape: chosen.shape,
                terrain: chosen.terrain,
                effectDescKey: chosen.effectDescKey || null,
                emberCost: chosen.emberCost || 0,
                foodCost: chosen.foodCost || 0,
                woodCost: chosen.woodCost || 0,
                defenseCost: chosen.defenseCost || 0,
                isUnique: chosen.isUnique || false
            };
        }

        generateOfferingCards() {
            const newCards = [
                this.drawSingleCard(),
                this.drawSingleCard(),
                this.drawSingleCard()
            ];
            this.state.handOffering = newCards;
            this.state.offeringCards = newCards;
            return newCards;
        }
    }

    if (typeof window !== "undefined") {
        if (!window.Step1Engine) window.Step1Engine = {};
        window.Step1Engine.Step1DrawSystem = Step1DrawSystem;
        window.Step1DrawSystem = Step1DrawSystem;
    }
})();
