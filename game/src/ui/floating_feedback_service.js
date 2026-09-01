/**
 * 🌟 FloatingFeedbackService (汎用フローティング演出サービス)
 * 
 * 責務:
 * 1. ヘッダーリソース数値・本営残り火・マージボーナス・将来の市民の声 (Barks) の
 *    フロート演出を一元的に生成・制御・自動破棄する。
 * 2. 増加 (+X: 橙✕白枠 ✕ 上昇) と 減少 (-X: 青✕白枠 ✕ 下降) を厳格に統一。
 * 3. アニメーション完了後に DOM から即座に削除し、メモリリーク・ゴースト要素を 100% 防止する。
 */

export class FloatingFeedbackService {
    /**
     * 🎯 指定された DOM 要素の真ん中手前にポップアップをドンッと出現させる
     * @param {HTMLElement|string} target - ターゲット要素またはセレクタ
     * @param {number|string} deltaOrText - 表示する数値 (+10, -5) またはテキスト
     * @param {Object} [options={}]
     * @param {boolean} [options.isPlus=null] - プラス判定 (省略時は数値から自動判定)
     * @param {number} [options.durationMs=1100] - 表示時間 (ms)
     * @param {string} [options.className="header-resource-delta-popup"] - CSS クラス
     */
    static spawnOnElement(target, deltaOrText, options = {}) {
        if (typeof document === "undefined") return;

        const targetEl = typeof target === "string" ? document.querySelector(target) : target;
        if (!targetEl || typeof targetEl.getBoundingClientRect !== "function") return;

        const rect = targetEl.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return; // 非表示要素ならスキップ

        let isPlus = options.isPlus;
        let displayText = String(deltaOrText);

        if (typeof deltaOrText === "number") {
            if (isPlus === null || isPlus === undefined) {
                isPlus = deltaOrText > 0;
            }
            displayText = deltaOrText > 0 ? `+${deltaOrText}` : `${deltaOrText}`;
        }

        const className = options.className || "header-resource-delta-popup";
        const durationMs = options.durationMs || 1100;

        const popupEl = document.createElement("div");
        popupEl.className = `${className} ${isPlus ? "is-plus" : "is-minus"}`;
        popupEl.textContent = displayText;

        // 🎯 ターゲット要素の手前中央にピッタリ配置
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        popupEl.style.left = `${centerX}px`;
        popupEl.style.top = `${centerY}px`;

        document.body.appendChild(popupEl);

        // 🛡️ アニメーション完了後に確実に破棄 (メモリリーク防止)
        setTimeout(() => {
            if (popupEl.parentNode) {
                popupEl.parentNode.removeChild(popupEl);
            }
        }, durationMs);
    }

    /**
     * 🗺️ 盤面マス (r, c) の上にポップアップを出現させる (マージボーナス・将来のBarks用)
     * @param {number} r - 行
     * @param {number} c - 列
     * @param {string} text - 表示テキスト
     * @param {Object} [options={}]
     */
    static spawnAtCell(r, c, text, options = {}) {
        if (typeof document === "undefined") return;

        const cellEl = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`) 
            || document.querySelector(`#cell_${r}_${c}`);
        if (!cellEl) return;

        this.spawnOnElement(cellEl, text, {
            className: options.className || "float-toast-bonus",
            durationMs: options.durationMs || 1800,
            isPlus: options.isPlus !== undefined ? options.isPlus : true
        });
    }
}

if (typeof window !== "undefined") {
    window.FloatingFeedbackService = FloatingFeedbackService;
}
if (typeof globalThis !== "undefined") {
    globalThis.FloatingFeedbackService = FloatingFeedbackService;
}
