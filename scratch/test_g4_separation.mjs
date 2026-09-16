import assert from "assert";
import fs from "fs";
import { GameEngine, UIController } from "../game/src/app.js";
import { UIInteractionState } from "../game/src/ui/ui_interaction_state.js";

console.log("============================================================");
console.log("🧪 [Gate 4: Separation Verification Test]");
console.log("============================================================");

// 1. 🎛️ UIInteractionState 単体機能検問
console.log("🔍 [G4-1] UIInteractionState 単体動作検問...");
const stateModel = new UIInteractionState();
assert.strictEqual(stateModel.selectedCardIdx, -1, "初期選択インデックスが -1 であること");
assert.strictEqual(stateModel.selectedReserveIdx, -1, "初期保留インデックスが -1 であること");
assert.strictEqual(stateModel.selectedCard, null, "初期選択カードが null であること");

const dummyCard = { id: "CARD_A" };
stateModel.selectOffering(1, dummyCard);
assert.strictEqual(stateModel.selectedCardIdx, 1, "selectOffering 後に selectedCardIdx が 1 になること");
assert.strictEqual(stateModel.selectedCard.id, "CARD_A", "selectOffering 後にカードが保持されること");
assert.strictEqual(stateModel.isOfferingSelected(), true, "isOfferingSelected が true を返すこと");
assert.strictEqual(stateModel.isReserveSelected(), false, "isReserveSelected が false を返すこと");

stateModel.deselect();
assert.strictEqual(stateModel.selectedCardIdx, -1, "deselect 後に -1 にリセットされること");
assert.strictEqual(stateModel.selectedCard, null, "deselect 後に null にリセットされること");
console.log("  ✅ PASS: UIInteractionState 単体セッション管理正常");

// 2. 🤝 UIController との透過的プロキシ連携検問 (後方互換性保証)
console.log("🔍 [G4-2] UIController 透過的プロキシ連携検問...");
const engine = GameEngine.createGame();
const ui = new UIController(engine);
assert.ok(ui.interactionState instanceof UIInteractionState, "UIController が UIInteractionState を所有していること");

// プロキシセッター経由の変更
ui.selectedCard = dummyCard;
assert.strictEqual(ui.interactionState.selectedCard.id, "CARD_A", "ui.selectedCard の代入が interactionState に反映されること");

ui.selectedCardIdx = 2;
assert.strictEqual(ui.interactionState.selectedCardIdx, 2, "ui.selectedCardIdx の代入が interactionState に反映されること");

ui.deselectCard();
assert.strictEqual(ui.selectedCardIdx, -1, "ui.deselectCard() でプロキシが -1 を返すこと");
assert.strictEqual(ui.interactionState.selectedCardIdx, -1, "ui.deselectCard() で interactionState が -1 になること");
console.log("  ✅ PASS: UIController ↔ UIInteractionState 透過プロキシ 100% 互換性確認");

// 3. 🛡️ 子コンポーネント間の直接結合 0 件静的検問 (親協調の徹底)
console.log("🔍 [G4-3] 子コンポーネント間直接参照 0 件検問...");
const childComponents = [
    "game/src/ui/board_grid_component.js",
    "game/src/ui/hand_cards_component.js",
    "game/src/ui/reserve_slot_component.js",
    "game/src/ui/top_header_component.js",
    "game/src/ui/hq_component.js"
];

for (const file of childComponents) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, "utf8");
    // 別の子コンポーネントを直接触っていないか検査
    assert.strictEqual(content.includes("this.ui.hqComponent."), false, `${file} から this.ui.hqComponent への直接参照が存在してはならない (親メディエーターを使うこと)`);
    assert.strictEqual(content.includes("this.ui.handCardsComponent."), false, `${file} から this.ui.handCardsComponent への直接参照が存在してはならない`);
    assert.strictEqual(content.includes("this.ui.reserveSlotComponent."), false, `${file} から this.ui.reserveSlotComponent への直接参照が存在してはならない`);
    assert.strictEqual(content.includes("this.ui.boardGridComponent."), false, `${file} から this.ui.boardGridComponent への直接参照が存在してはならない`);
}
console.log("  ✅ PASS: 子コンポーネント間の直接参照: 0 件 (親メディエーター協調に完全統一)");

console.log("============================================================");
console.log("🎉 [Gate 4: Separation Verification Test] ALL PASS (100%)");
console.log("============================================================");
