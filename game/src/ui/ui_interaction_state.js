/**
 * 🎛️ UIInteractionState (UI インタラクション・セッション状態モジュール)
 * 
 * 責務:
 * 1. ゲームルール (GameState) とは完全に分離された
 *    「現在のプレイヤーの UI 操作状態 (セッション状態)」を一元管理する。
 * 2. 選択中カード、選択元枠、ポップオーバー開閉、プレビュー固定等を Single Source of Truth として保持。
 * 3. 状態遷移メソッドを提供し、UIController および各子コンポーネントに明確な境界を与える。
 */

export class UIInteractionState {
    constructor() {
        this.reset();
    }

    /**
     * 🧹 選択状態の完全リセット
     */
    reset() {
        this.selectedCard = null;
        this.selectedCardIdx = -1;
        this.selectedReserveIdx = -1;
        this.isReservePopoverOpen = false;
        this.pinnedPreviewCard = null;
        this.hoveredCell = null; // { r, c }
    }

    /**
     * 🃏 手札オファリングの選択
     * @param {number} idx - オファリング枠インデックス
     * @param {Object} card - カードオブジェクト
     */
    selectOffering(idx, card) {
        this.selectedCard = card;
        this.selectedCardIdx = idx;
        this.selectedReserveIdx = -1;
    }

    /**
     * 📦 保留枠カードの選択
     * @param {number} idx - 保留枠インデックス
     * @param {Object} card - カードオブジェクト
     */
    selectReserve(idx, card) {
        this.selectedCard = card;
        this.selectedCardIdx = -1;
        this.selectedReserveIdx = idx;
    }

    /**
     * 🛑 選択解除
     */
    deselect() {
        this.selectedCard = null;
        this.selectedCardIdx = -1;
        this.selectedReserveIdx = -1;
        this.isReservePopoverOpen = false;
    }

    /**
     * 🔍 現在手札が選択されているか
     */
    isOfferingSelected() {
        return this.selectedCardIdx !== -1 && this.selectedCard !== null;
    }

    /**
     * 🔍 現在保留枠が選択されているか
     */
    isReserveSelected() {
        return this.selectedReserveIdx !== -1 && this.selectedCard !== null;
    }
}

if (typeof window !== "undefined") {
    window.UIInteractionState = UIInteractionState;
}
if (typeof globalThis !== "undefined") {
    globalThis.UIInteractionState = UIInteractionState;
}
