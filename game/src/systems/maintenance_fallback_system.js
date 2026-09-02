/* =============================================================
   MaintenanceFallbackSystem
   ターン終了時の食料維持費予測・不足補填・状態適用の正本
   ============================================================= */

const MYSTIC_FOOD_RATE = 6;
const MATERIAL_COST_PER_FOOD = 5;

function toNonNegativeInteger(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.floor(value));
}

function createNoSpendPlan(deficit) {
    const initialDeficit = toNonNegativeInteger(deficit);
    return Object.freeze({
        initialDeficit,
        mysticSpent: 0,
        mysticFoodCovered: 0,
        materialSpent: 0,
        materialFoodCovered: 0,
        totalFoodCovered: 0,
        remainingDeficit: initialDeficit,
        canFullyCover: initialDeficit === 0,
        emberPenalty: initialDeficit > 0 ? 1 : 0
    });
}

function createHypotheticalPlan(deficit, mystic, material) {
    const initialDeficit = toNonNegativeInteger(deficit);
    const availableMystic = toNonNegativeInteger(mystic);
    const availableMaterial = toNonNegativeInteger(material);

    const mysticSpent = Math.min(
        availableMystic,
        Math.ceil(initialDeficit / MYSTIC_FOOD_RATE)
    );
    const mysticFoodCovered = Math.min(
        initialDeficit,
        mysticSpent * MYSTIC_FOOD_RATE
    );
    const afterMystic = Math.max(0, initialDeficit - mysticFoodCovered);

    const materialFoodUnits = Math.min(
        Math.floor(availableMaterial / MATERIAL_COST_PER_FOOD),
        afterMystic
    );
    const materialSpent = materialFoodUnits * MATERIAL_COST_PER_FOOD;
    const materialFoodCovered = materialFoodUnits;
    const totalFoodCovered = mysticFoodCovered + materialFoodCovered;
    const remainingDeficit = Math.max(0, initialDeficit - totalFoodCovered);

    return Object.freeze({
        initialDeficit,
        mysticSpent,
        mysticFoodCovered,
        materialSpent,
        materialFoodCovered,
        totalFoodCovered,
        remainingDeficit,
        canFullyCover: remainingDeficit === 0,
        emberPenalty: remainingDeficit > 0 ? 1 : 0
    });
}

class MaintenanceFallbackSystem {
    static resolveFoodMaintenanceCost(state) {
        let baseFoodCost = 20;
        if (state && state.emberSystem && typeof state.emberSystem.getFoodMaintenanceCost === "function") {
            baseFoodCost = state.emberSystem.getFoodMaintenanceCost();
        } else {
            const ember = state && Number.isFinite(state.ember) ? state.ember : 20;
            if (ember >= 24) baseFoodCost = 25;
            else if (ember <= 9) baseFoodCost = 15;
        }

        const rationingApplied = Boolean(state && state.foodCostHalvedTurns > 0);
        const emergencyLevyApplied = Boolean(
            state
            && state.emergencyLevyTurns > 0
            && !state.emergencyLevyStartsNextTurn
        );
        let foodCost = rationingApplied
            ? Math.floor(baseFoodCost / 2)
            : baseFoodCost;
        if (emergencyLevyApplied) foodCost += 5;

        return Object.freeze({
            baseFoodCost,
            foodCost,
            rationingApplied,
            emergencyLevyApplied
        });
    }

    static previewFoodDeficitFallback({
        deficit,
        mystic,
        material,
        autoFallbackEnabled = true
    } = {}) {
        const initialDeficit = toNonNegativeInteger(deficit);
        const hypotheticalFallbackPlan = createHypotheticalPlan(
            initialDeficit,
            mystic,
            material
        );

        // 不足が残るなら資源を払ってもゲーム上の利益がないため、自動案は無消費に戻す。
        const automaticPlan = autoFallbackEnabled && hypotheticalFallbackPlan.canFullyCover
            ? hypotheticalFallbackPlan
            : createNoSpendPlan(initialDeficit);

        return Object.freeze({
            initialDeficit,
            autoFallbackEnabled: Boolean(autoFallbackEnabled),
            automaticPlan,
            hypotheticalFallbackPlan
        });
    }

    static previewMaintenancePayment(state, {
        autoFallbackEnabled = true,
        food = state && state.food,
        mystic = state && state.mystic,
        material = state && (state.wood ?? state.material)
    } = {}) {
        const maintenance = this.resolveFoodMaintenanceCost(state);
        const foodBeforeMaintenance = toNonNegativeInteger(food);
        const deficit = Math.max(0, maintenance.foodCost - foodBeforeMaintenance);
        const fallback = this.previewFoodDeficitFallback({
            deficit,
            mystic,
            material,
            autoFallbackEnabled
        });

        return Object.freeze({
            ...maintenance,
            foodBeforeMaintenance,
            deficit,
            ...fallback
        });
    }

    static previewTurnEndMaintenance(state, { autoFallbackEnabled = true } = {}) {
        const production = state && typeof state.calculateTotalProduction === "function"
            ? state.calculateTotalProduction()
            : { grossFood: 0, totalWood: 0, totalMystic: 0 };
        const grossFood = toNonNegativeInteger(production.grossFood);
        const totalWood = toNonNegativeInteger(production.totalWood);
        const totalMystic = toNonNegativeInteger(production.totalMystic);
        const foodBeforeProduction = toNonNegativeInteger(state && state.food);
        const foodAfterProduction = foodBeforeProduction + grossFood;
        const mysticAfterProduction = toNonNegativeInteger(state && state.mystic) + totalMystic;
        const materialAfterProduction = toNonNegativeInteger(
            state && (state.wood ?? state.material)
        ) + totalWood;
        const maintenance = this.previewMaintenancePayment(state, {
            autoFallbackEnabled,
            food: foodAfterProduction,
            mystic: mysticAfterProduction,
            material: materialAfterProduction
        });

        return Object.freeze({
            ...maintenance,
            production,
            grossFood,
            totalWood,
            totalMystic,
            foodBeforeProduction,
            foodAfterProduction,
            mysticAfterProduction,
            materialAfterProduction
        });
    }

    static applyFoodDeficitFallback(state, plan) {
        if (!state || !plan || !plan.canFullyCover || plan.remainingDeficit > 0) {
            return Object.freeze({ applied: false, foodCovered: 0 });
        }

        const mysticSpent = toNonNegativeInteger(plan.mysticSpent);
        const materialSpent = toNonNegativeInteger(plan.materialSpent);
        const availableMystic = toNonNegativeInteger(state.mystic);
        const availableMaterial = toNonNegativeInteger(state.wood ?? state.material);
        if (availableMystic < mysticSpent || availableMaterial < materialSpent) {
            return Object.freeze({ applied: false, foodCovered: 0 });
        }

        state.mystic = availableMystic - mysticSpent;
        state.wood = availableMaterial - materialSpent;
        state.material = state.wood;
        state.food = toNonNegativeInteger(state.food) + toNonNegativeInteger(plan.totalFoodCovered);

        return Object.freeze({
            applied: mysticSpent > 0 || materialSpent > 0,
            mysticSpent,
            materialSpent,
            foodCovered: toNonNegativeInteger(plan.totalFoodCovered)
        });
    }

    static createNoSpendPlan(deficit) {
        return createNoSpendPlan(deficit);
    }
}

export {
    MATERIAL_COST_PER_FOOD,
    MYSTIC_FOOD_RATE,
    MaintenanceFallbackSystem
};
export default MaintenanceFallbackSystem;
