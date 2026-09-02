import assert from "assert";
import {
    GameEngine,
    GameSettings,
    MaintenanceFallbackSystem,
    TooltipSystem,
    UIController
} from "../game/src/app.js";

console.log("============================================================");
console.log("🌾 Maintenance / Food Deficit Fallback Regression Tests");
console.log("============================================================");

// 1. gross産出を加算し、維持費はmaintenanceで1回だけ控除する。
const singleChargeEngine = GameEngine.createGame({ runSeed: 260902 });
const initialFood = singleChargeEngine.state.food;
const singleChargePreview = singleChargeEngine.previewTurnEndMaintenance({
    autoFallbackEnabled: false
});
singleChargeEngine.nextTurn({ autoFallbackEnabled: false });
const expectedFood = initialFood
    + singleChargePreview.grossFood
    - singleChargePreview.foodCost;
assert.strictEqual(singleChargeEngine.state.food, expectedFood);
assert.strictEqual(singleChargeEngine.state.food, 40);
assert.strictEqual(singleChargePreview.production.totalFood, -10);
assert.strictEqual(singleChargePreview.production.netFood, -10);
assert.strictEqual(singleChargePreview.production.grossFood, 10);
assert.strictEqual(singleChargePreview.foodCost, 20);

// 2. 配給・緊急徴発を含む最終維持費がpreviewと実決済で一致する。
const rationingEngine = GameEngine.createGame({ runSeed: 260902 });
rationingEngine.state.foodCostHalvedTurns = 1;
const rationingPreview = rationingEngine.previewTurnEndMaintenance({
    autoFallbackEnabled: false
});
assert.strictEqual(rationingPreview.foodCost, 10);
rationingEngine.nextTurn({ autoFallbackEnabled: false });
assert.strictEqual(rationingEngine.lastTurnMaintenanceResult.foodCost, 10);
assert.strictEqual(rationingEngine.state.food, 50);
assert.strictEqual(rationingEngine.state.foodCostHalvedTurns, 0);

const levyEngine = GameEngine.createGame({ runSeed: 260902 });
levyEngine.state.emergencyLevyTurns = 1;
levyEngine.state.emergencyLevyStartsNextTurn = false;
const levyPreview = levyEngine.previewTurnEndMaintenance({
    autoFallbackEnabled: false
});
assert.strictEqual(levyPreview.foodCost, 25);
levyEngine.nextTurn({ autoFallbackEnabled: false });
assert.strictEqual(levyEngine.lastTurnMaintenanceResult.foodCost, 25);
assert.strictEqual(levyEngine.state.food, 35);
assert.strictEqual(levyEngine.state.emergencyLevyTurns, 0);

// 3. OFFでもautomaticPlanと仮想計画を分離し、必要量を取得できる。
const offFull = MaintenanceFallbackSystem.previewFoodDeficitFallback({
    deficit: 11,
    mystic: 1,
    material: 25,
    autoFallbackEnabled: false
});
assert.strictEqual(offFull.automaticPlan.mysticSpent, 0);
assert.strictEqual(offFull.automaticPlan.materialSpent, 0);
assert.strictEqual(offFull.automaticPlan.remainingDeficit, 11);
assert.strictEqual(offFull.hypotheticalFallbackPlan.mysticSpent, 1);
assert.strictEqual(offFull.hypotheticalFallbackPlan.mysticFoodCovered, 6);
assert.strictEqual(offFull.hypotheticalFallbackPlan.materialSpent, 25);
assert.strictEqual(offFull.hypotheticalFallbackPlan.materialFoodCovered, 5);
assert.strictEqual(offFull.hypotheticalFallbackPlan.canFullyCover, true);

// 4. 部分補填しかできない場合は、仮想必要量を返しても実行案は無消費。
const offPartial = MaintenanceFallbackSystem.previewFoodDeficitFallback({
    deficit: 10,
    mystic: 0,
    material: 10,
    autoFallbackEnabled: false
});
assert.strictEqual(offPartial.hypotheticalFallbackPlan.materialSpent, 10);
assert.strictEqual(offPartial.hypotheticalFallbackPlan.totalFoodCovered, 2);
assert.strictEqual(offPartial.hypotheticalFallbackPlan.remainingDeficit, 8);
assert.strictEqual(offPartial.hypotheticalFallbackPlan.canFullyCover, false);
assert.strictEqual(offPartial.automaticPlan.materialSpent, 0);

// 5. ONで全額補填可能なら自動消費し、食料不足由来の🔥-1を回避する。
const autoFullEngine = GameEngine.createGame({ runSeed: 260902 });
autoFullEngine.state.food = 0;
autoFullEngine.nextTurn({ autoFallbackEnabled: true });
assert.strictEqual(autoFullEngine.state.food, 0);
assert.strictEqual(autoFullEngine.state.mystic, 0);
assert.strictEqual(autoFullEngine.state.wood, 20);
assert.strictEqual(autoFullEngine.state.ember, 19);
assert.strictEqual(autoFullEngine.lastTurnMaintenanceResult.fallbackResult.applied, true);

// 6. ONでも全額補填不能なら資源を浪費せず、通常の🔥-1を受ける。
const autoPartialEngine = GameEngine.createGame({ runSeed: 260902 });
autoPartialEngine.state.food = 0;
autoPartialEngine.state.wood = 0;
autoPartialEngine.state.material = 0;
autoPartialEngine.nextTurn({ autoFallbackEnabled: true });
assert.strictEqual(autoPartialEngine.state.mystic, 1);
assert.strictEqual(autoPartialEngine.state.wood, 10);
assert.strictEqual(autoPartialEngine.state.ember, 18);
assert.strictEqual(autoPartialEngine.lastTurnMaintenanceResult.fallbackResult.applied, false);

// 7. OFF全額補填可能: そのまま終了なら無消費、承認時だけ消費する。
const offSkipEngine = GameEngine.createGame({ runSeed: 260902 });
offSkipEngine.state.food = 0;
offSkipEngine.nextTurn({
    autoFallbackEnabled: false,
    useHypotheticalFallback: false
});
assert.strictEqual(offSkipEngine.state.mystic, 1);
assert.strictEqual(offSkipEngine.state.wood, 40);
assert.strictEqual(offSkipEngine.state.ember, 18);

const offConfirmEngine = GameEngine.createGame({ runSeed: 260902 });
offConfirmEngine.state.food = 0;
offConfirmEngine.nextTurn({
    autoFallbackEnabled: false,
    useHypotheticalFallback: true
});
assert.strictEqual(offConfirmEngine.state.mystic, 0);
assert.strictEqual(offConfirmEngine.state.wood, 20);
assert.strictEqual(offConfirmEngine.state.ember, 19);

// 8. Tooltipは全額可能と部分補填不能を別表示する。
const tooltip = new TooltipSystem();
tooltip.I18n = {
    t(key, params = {}) {
        return `${key}:${JSON.stringify(params)}`;
    }
};
const fullTooltip = tooltip.renderTurnEndPreview(offConfirmEngine.state, false);
assert.ok(fullTooltip.startsWith("TOOLTIP_FOOD_FALLBACK_CONFIRM:"));

const partialPreviewEngine = GameEngine.createGame({ runSeed: 260902 });
partialPreviewEngine.state.food = 0;
partialPreviewEngine.state.wood = 0;
partialPreviewEngine.state.material = 0;
const partialTooltip = tooltip.renderTurnEndPreview(partialPreviewEngine.state, false);
assert.ok(partialTooltip.startsWith("TOOLTIP_FOOD_FALLBACK_INSUFFICIENT:"));

// 9. OFFクリックは全額補填可能時だけ確認し、不能時は確認せず無消費で進む。
const originalWindow = globalThis.window;
let dialogOptions = null;
const executedOptions = [];
globalThis.window = {
    gameSettings: { get: key => key === "autoFoodDeficitFallback" ? false : true },
    ModalSystem: {
        showConfirmDialog(options) {
            dialogOptions = options;
        }
    }
};
const fullUiEngine = {
    state: { hasPickedThisTurn: true },
    nextTurn(options) {
        executedOptions.push(options);
    },
    previewTurnEndMaintenance() {
        return {
            deficit: 10,
            hypotheticalFallbackPlan: {
                canFullyCover: true,
                mysticSpent: 1,
                materialSpent: 20
            }
        };
    }
};
const fullUi = new UIController(fullUiEngine);
fullUi.confirmFoodDeficitFallback();
assert.ok(dialogOptions);
assert.strictEqual(executedOptions.length, 0);
dialogOptions.onConfirm();
assert.deepStrictEqual(executedOptions[0], {
    autoFallbackEnabled: false,
    useHypotheticalFallback: true
});

dialogOptions = null;
const partialExecutedOptions = [];
const partialUiEngine = {
    state: { hasPickedThisTurn: true },
    nextTurn(options) {
        partialExecutedOptions.push(options);
    },
    previewTurnEndMaintenance() {
        return {
            deficit: 10,
            hypotheticalFallbackPlan: {
                canFullyCover: false,
                mysticSpent: 0,
                materialSpent: 10
            }
        };
    }
};
const partialUi = new UIController(partialUiEngine);
partialUi.confirmFoodDeficitFallback();
assert.strictEqual(dialogOptions, null);
assert.deepStrictEqual(partialExecutedOptions[0], {
    autoFallbackEnabled: false,
    useHypotheticalFallback: false
});
if (originalWindow === undefined) delete globalThis.window;
else globalThis.window = originalWindow;

// 10. 設定既定値はON。
const settings = new GameSettings();
assert.strictEqual(settings.get("autoFoodDeficitFallback"), true);

console.log("✅ Gross production / single maintenance charge PASS");
console.log("✅ Final maintenance cost SSOT PASS");
console.log("✅ Automatic / hypothetical plan separation PASS");
console.log("✅ Full-only resource spending PASS");
console.log("✅ ON / OFF execution paths PASS");
console.log("✅ Tooltip / confirmation gate / default setting PASS");
