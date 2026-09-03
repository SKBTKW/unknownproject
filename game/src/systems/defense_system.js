const BASE_HQ_DEFENSE = 10;

function toNonNegativeInteger(value, fallback = 0) {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(0, Math.floor(value));
}

function resolveTerrainDefense(terrain) {
    if (!terrain) return 0;
    if (terrain.defense !== undefined) return toNonNegativeInteger(terrain.defense);
    if (terrain.baseYieldsPerTile && terrain.baseYieldsPerTile.defense !== undefined) {
        return toNonNegativeInteger(terrain.baseYieldsPerTile.defense);
    }
    if (terrain.yields && terrain.yields.defense !== undefined) {
        return toNonNegativeInteger(terrain.yields.defense);
    }
    return 0;
}

/**
 * 最大防衛力（盤面からの導出値）と現在防衛力（保存値）を分離して管理する。
 */
export class DefenseSystem {
    constructor(state, {
        rebuildCostResolver = null,
        mysticFallbackResolver = null
    } = {}) {
        this.state = state;
        this.rebuildCostResolver = rebuildCostResolver;
        this.mysticFallbackResolver = mysticFallbackResolver;

        if (this.state) {
            const legacyDefense = toNonNegativeInteger(this.state.defense, BASE_HQ_DEFENSE);
            if (!Number.isFinite(this.state.defenseCapacityBonus)) {
                this.state.defenseCapacityBonus = Math.max(0, legacyDefense - BASE_HQ_DEFENSE);
            }
            this._syncLegacyDefenseValue();
            this.reconcileWithMax({ initializeCurrent: this.state.currentDefense === undefined || this.state.currentDefense === null });
        }
    }

    static calculateMaxDefense(state) {
        if (!state) return BASE_HQ_DEFENSE;

        const size = Array.isArray(state.grid) && state.grid.length ? state.grid.length : 5;
        const center = Math.floor(size / 2);
        const hqCell = state.grid?.[center]?.[center];
        const hqDefense = hqCell?.terrain
            ? resolveTerrainDefense(hqCell.terrain)
            : BASE_HQ_DEFENSE;

        let maxDefense = hqDefense;
        let vicinityCount = 0;

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const cell = state.grid?.[r]?.[c];
                if (!cell || !cell.placed || cell.isHQ || !cell.terrain) continue;

                maxDefense += resolveTerrainDefense(cell.terrain);
                maxDefense += toNonNegativeInteger(cell.socketResource?.bonusDefense);
                if (typeof state.isHQVicinity === "function" && state.isHQVicinity(r, c)) {
                    vicinityCount++;
                }
            }
        }

        maxDefense += toNonNegativeInteger(state.permanentVicinityDefenseBonus) * vicinityCount;
        maxDefense += toNonNegativeInteger(state.defenseCapacityBonus);

        // 既存カードの期限付き防衛上限補正を維持する。
        if (state.vigilanceTurns > 0 && !state.vigilanceStartsNextTurn) {
            maxDefense += 3;
        }

        if (state.directiveSystem && typeof state.directiveSystem.getResourceMultiplier === "function") {
            maxDefense = Math.floor(maxDefense * state.directiveSystem.getResourceMultiplier("defense"));
        }

        return toNonNegativeInteger(maxDefense);
    }

    calculateMaxDefense() {
        return DefenseSystem.calculateMaxDefense(this.state);
    }

    getMaxDefense() {
        return this.reconcileWithMax().maxDefense;
    }

    getCurrentDefense() {
        return this.reconcileWithMax().currentDefense;
    }

    getTrialAvailableDefense() {
        return this.getCurrentDefense();
    }

    setCurrentDefense(amount) {
        if (!this.state) return 0;
        const maxDefense = this.calculateMaxDefense();
        this.state.maxDefense = maxDefense;
        this.state.currentDefense = Math.min(toNonNegativeInteger(amount), maxDefense);
        return this.state.currentDefense;
    }

    reduceCurrentDefense(amount) {
        const reduction = toNonNegativeInteger(amount);
        const before = this.getCurrentDefense();
        const after = this.setCurrentDefense(before - reduction);
        return { before, after, reduced: before - after, maxDefense: this.state.maxDefense };
    }

    recoverCurrentDefense(amount) {
        const recovery = toNonNegativeInteger(amount);
        const before = this.getCurrentDefense();
        const after = this.setCurrentDefense(before + recovery);
        return { before, after, recovered: after - before, maxDefense: this.state.maxDefense };
    }

    recoverToMax() {
        const maxDefense = this.getMaxDefense();
        const before = this.getCurrentDefense();
        this.state.currentDefense = maxDefense;
        return { before, after: maxDefense, recovered: maxDefense - before, maxDefense };
    }

    increaseMaxCapacity(amount) {
        if (!this.state) return this.reconcileWithMax();
        this.state.defenseCapacityBonus = toNonNegativeInteger(this.state.defenseCapacityBonus) + toNonNegativeInteger(amount);
        this._syncLegacyDefenseValue();
        return this.reconcileWithMax();
    }

    reconcileWithMax({ initializeCurrent = false } = {}) {
        if (!this.state) {
            return { currentDefense: 0, maxDefense: BASE_HQ_DEFENSE, clamped: false };
        }

        const previousCurrent = this.state.currentDefense;
        const maxDefense = this.calculateMaxDefense();
        let currentDefense;

        if (initializeCurrent || previousCurrent === undefined || previousCurrent === null) {
            currentDefense = maxDefense;
        } else {
            currentDefense = Math.min(toNonNegativeInteger(previousCurrent), maxDefense);
        }

        this.state.maxDefense = maxDefense;
        this.state.currentDefense = currentDefense;
        return {
            currentDefense,
            maxDefense,
            clamped: Number.isFinite(previousCurrent) && currentDefense < previousCurrent
        };
    }

    getDefenseRebuildCost() {
        const currentDefense = this.getCurrentDefense();
        const maxDefense = this.getMaxDefense();
        const missingDefense = Math.max(0, maxDefense - currentDefense);

        if (missingDefense === 0) {
            return { defined: true, food: 0, material: 0, missingDefense };
        }
        if (typeof this.rebuildCostResolver !== "function") {
            return { defined: false, reason: "REBUILD_COST_UNDEFINED", missingDefense };
        }

        const resolved = this.rebuildCostResolver({
            state: this.state,
            currentDefense,
            maxDefense,
            missingDefense
        });
        if (!resolved || !Number.isFinite(resolved.food) || !Number.isFinite(resolved.material)) {
            return { defined: false, reason: "REBUILD_COST_UNDEFINED", missingDefense };
        }

        return {
            defined: true,
            food: toNonNegativeInteger(resolved.food),
            material: toNonNegativeInteger(resolved.material),
            missingDefense
        };
    }

    getDefenseRebuildPlan({ allowMysteryFallback = false } = {}) {
        const cost = this.getDefenseRebuildCost();
        const currentDefense = this.getCurrentDefense();
        const maxDefense = this.getMaxDefense();

        if (!cost.defined) {
            return {
                canRebuild: false,
                reason: cost.reason,
                currentDefense,
                maxDefense,
                cost,
                ordinaryPlan: null,
                mysteryFallbackPlan: null
            };
        }
        if (cost.missingDefense === 0) {
            return {
                canRebuild: false,
                reason: "DEFENSE_ALREADY_FULL",
                currentDefense,
                maxDefense,
                cost,
                ordinaryPlan: { foodSpent: 0, materialSpent: 0, mysticSpent: 0, canPay: true },
                mysteryFallbackPlan: null
            };
        }

        const food = toNonNegativeInteger(this.state.food);
        const material = toNonNegativeInteger(this.state.wood ?? this.state.material);
        const mystic = toNonNegativeInteger(this.state.mystic);
        const foodShortfall = Math.max(0, cost.food - food);
        const materialShortfall = Math.max(0, cost.material - material);
        const ordinaryPlan = {
            foodSpent: cost.food,
            materialSpent: cost.material,
            mysticSpent: 0,
            canPay: foodShortfall === 0 && materialShortfall === 0
        };

        let mysteryFallbackPlan = null;
        if (foodShortfall > 0 || materialShortfall > 0) {
            if (typeof this.mysticFallbackResolver === "function") {
                const resolvedMystic = this.mysticFallbackResolver({
                    state: this.state,
                    cost,
                    foodShortfall,
                    materialShortfall
                });
                if (Number.isFinite(resolvedMystic)) {
                    const mysticSpent = toNonNegativeInteger(resolvedMystic);
                    mysteryFallbackPlan = {
                        foodSpent: Math.min(food, cost.food),
                        materialSpent: Math.min(material, cost.material),
                        mysticSpent,
                        canPay: mystic >= mysticSpent
                    };
                }
            }
            if (!mysteryFallbackPlan) {
                mysteryFallbackPlan = {
                    foodSpent: Math.min(food, cost.food),
                    materialSpent: Math.min(material, cost.material),
                    mysticSpent: null,
                    canPay: false,
                    reason: "MYSTIC_FALLBACK_RATE_UNDEFINED"
                };
            }
        }

        const selectedPlan = ordinaryPlan.canPay
            ? ordinaryPlan
            : (allowMysteryFallback && mysteryFallbackPlan?.canPay ? mysteryFallbackPlan : null);

        return {
            canRebuild: !!selectedPlan,
            reason: selectedPlan ? null : "INSUFFICIENT_REBUILD_RESOURCES",
            currentDefense,
            maxDefense,
            cost,
            ordinaryPlan,
            mysteryFallbackPlan,
            selectedPlan
        };
    }

    canRebuildDefense(options = {}) {
        return this.getDefenseRebuildPlan(options).canRebuild;
    }

    rebuildDefense({ allowMysteryFallback = false, confirmMysteryFallback = false } = {}) {
        const plan = this.getDefenseRebuildPlan({ allowMysteryFallback });
        if (!plan.canRebuild || !plan.selectedPlan) {
            return { success: false, reason: plan.reason, plan };
        }

        const payment = plan.selectedPlan;
        if (payment.mysticSpent > 0 && !confirmMysteryFallback) {
            return { success: false, reason: "MYSTIC_CONFIRMATION_REQUIRED", plan };
        }

        const currentFood = toNonNegativeInteger(this.state.food);
        const currentMaterial = toNonNegativeInteger(this.state.wood ?? this.state.material);
        const currentMystic = toNonNegativeInteger(this.state.mystic);
        if (currentFood < payment.foodSpent || currentMaterial < payment.materialSpent || currentMystic < payment.mysticSpent) {
            return { success: false, reason: "INSUFFICIENT_REBUILD_RESOURCES", plan };
        }

        this.state.food = currentFood - payment.foodSpent;
        this.state.wood = currentMaterial - payment.materialSpent;
        this.state.material = this.state.wood;
        this.state.mystic = currentMystic - payment.mysticSpent;
        const recovery = this.recoverToMax();

        return { success: true, payment: { ...payment }, recovery, plan };
    }

    _syncLegacyDefenseValue() {
        if (!this.state) return;
        this.state.defense = BASE_HQ_DEFENSE + toNonNegativeInteger(this.state.defenseCapacityBonus);
    }
}

export { BASE_HQ_DEFENSE };
export default DefenseSystem;
