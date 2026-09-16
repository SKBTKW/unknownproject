/**
 * 🌟 FloatingFeedbackService (UIフィードバック分類: Popup専用サービス)
 * 
 * 📜 【UIフィードバック3大分類の責務定義】
 * 1. Popup  : 数値変化を瞬間的に伝えるもの (本営🔥増減 / データパネル🌾🧱🛡️✨増減)
 *             ※イベント説明・文章は表示しない。数値差分 (+10, -5) 専用。
 * 2. Toast  : ゲームイベントの成立内容を短く伝えるもの (MERGE成立 / LINK成立 / 資源発見)
 *             ※toastQueue 経由で UIController がスタッガー・安全クランプ描画。
 * 3. Tooltip: ユーザーがホバー/タップした時に詳細を表示するもの (EmberStatus / TooltipSystem)
 * 
 * 責務:
 * 1. データパネルの資源数値差分 (+10, -5) ポップアップ描画
 * 2. 将来の PopupService 統合を見据えた純粋な数値差分 View レイヤー
 */

export class FloatingFeedbackService {
    /**
     * 📊 数値差分Popup表示 (統一インターフェース)
     * @param {Object} param
     * @param {string} param.resource - "FOOD" | "WOOD" | "DEFENSE" | "MYSTIC" | "EMBER"
     * @param {number} param.delta - 増減数値
     * @param {HTMLElement|string} param.target - マウント要素またはセレクタ
     */
    static showResourcePopup({ resource, delta, target }) {
        if (!delta) return;
        this.spawnOnElement(target, delta);
    }

    /**
     * 🎯 指定された DOM 要素の真ん中手前にポップアップを出現させる (数値差分専用)
     * @param {HTMLElement|string} target - ターゲット要素またはセレクタ
     * @param {number|string} deltaOrText - 表示する数値 (+10, -5)
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
