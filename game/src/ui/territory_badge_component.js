/* =============================================================
   game/src/ui/territory_badge_component.js
   土地グリッド底面右下隅吸着 20%拡大・シンプル領土占有バッジ
   ============================================================= */

export class TerritoryBadgeComponent {
    constructor() {
        this.containerEl = null;
        this.badgeEl = null;
        this.iconEl = null;
        this.countEl = null;
        this.currentCount = 0;
        this.maxCount = 24;
        this.stage = 1;
    }

    /**
     * 🏗️ UIの初期構築 (サイズ20%拡大 ＆ アイコン＋数値のみのシンプル設計)
     */
     mount(containerEl) {
        if (!containerEl) {
            containerEl = document.getElementById("territoryBadgeContainer") || document.querySelector(".grid-board-anchor");
        }
        if (!containerEl) return;
        this.containerEl = containerEl;
        this.containerEl.innerHTML = "";

        this.badgeEl = document.createElement("div");
        this.badgeEl.className = "main-area-badge territory-grid-bottom-right";
        this.badgeEl.id = "mainTerritoryBadge";
        this.badgeEl.title = "🏛️ 領土開墾進捗 (クリックで文明方針変更)";
        this.badgeEl.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 7px;
            background: rgba(18, 24, 38, 0.95);
            border: 2px solid #1abc9c;
            color: #1abc9c;
            font-weight: 900;
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 16px;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.8), 0 0 12px rgba(26, 188, 156, 0.3);
            backdrop-filter: blur(8px);
            transition: all 0.2s ease;
            user-select: none;
            cursor: pointer;
            white-space: nowrap;
        `;
        this.badgeEl.onclick = () => {
            if (typeof window.openDirectiveModal === "function") {
                window.openDirectiveModal();
            }
        };

        this.iconEl = document.createElement("span");
        this.iconEl.id = "lblMainBadgeIcon";
        this.iconEl.style.cssText = "font-size: 18px; display: inline-flex; align-items: center;";
        this.iconEl.innerText = "🏛️";

        this.countEl = document.createElement("span");
        this.countEl.id = "valPlacedCount";
        this.countEl.style.cssText = "color: #ffffff; font-size: 16px; font-weight: bold; letter-spacing: 0.5px; margin-left: 2px;";
        this.countEl.innerText = "0/24";

        this.badgeEl.appendChild(this.iconEl);
        this.badgeEl.appendChild(this.countEl);
        this.containerEl.appendChild(this.badgeEl);
    }

    // 🎯 ステージ最大マス数の取得 (インスタンス・クラス両対応)
    getMaxTilesForStage(stageNum = 1) {
        return TerritoryBadgeComponent.getMaxTilesForStage(stageNum);
    }

    static getMaxTilesForStage(stageNum = 1) {
        if (stageNum === 3) return 80;
        if (stageNum === 2) return 48;
        return 24; // Stage 1 デフォルト
    }

    /**
     * 🔄 占有数・ステージ最大マス数の更新
     */
    update(placedCount = 0, stageOrState = 1, options = {}) {
        this.currentCount = placedCount;

        if (!this.countEl && typeof document !== "undefined") {
            const container = document.getElementById("territoryBadgeContainer") || document.querySelector(".board-container-wrapper");
            if (container) this.mount(container);
        }

        if (typeof stageOrState === "object" && stageOrState !== null) {
            this.stage = stageOrState.stage || (stageOrState.turn ? Math.min(3, Math.floor((stageOrState.turn - 1) / 20) + 1) : 1);
        } else if (typeof stageOrState === "number") {
            this.stage = stageOrState;
        } else {
            this.stage = 1;
        }

        this.maxCount = TerritoryBadgeComponent.getMaxTilesForStage(this.stage);

        if (!this.countEl) return;

        const pct = Math.round((this.currentCount / this.maxCount) * 100);
        this.countEl.innerHTML = `<span style="color:#2ecc71;">${this.currentCount}</span><span style="color:#7f8c8d;">/${this.maxCount}</span> <small style="font-size:13px; color:#a4b0be; margin-left:5px; font-weight:normal;">(${pct}%)</small>`;

        if (this.badgeEl) {
            this.badgeEl.title = `Stage ${this.stage} 支配地占有率: ${pct}% (開拓済み: ${this.currentCount}マス / 最大: ${this.maxCount}マス / 残り: ${this.maxCount - this.currentCount}マス)`;
            if (pct >= 80) {
                this.badgeEl.style.borderColor = "#f1c40f";
                this.badgeEl.style.boxShadow = "0 5px 16px rgba(0,0,0,0.75), 0 0 16px rgba(241, 196, 15, 0.5)";
            } else {
                this.badgeEl.style.borderColor = "#1abc9c";
                this.badgeEl.style.boxShadow = "0 5px 16px rgba(0,0,0,0.75), 0 0 12px rgba(26, 188, 156, 0.35)";
            }
        }
    }

    // 🛡️ static メソッドによるインスタンスへの安全委譲 (クラス呼出・インスタンス呼出両対応)
    static mount(containerEl) {
        return territoryBadgeInstance.mount(containerEl);
    }
    static update(placedCount, stageOrState, options) {
        return territoryBadgeInstance.update(placedCount, stageOrState, options);
    }
}

const territoryBadgeInstance = new TerritoryBadgeComponent();

if (typeof window !== "undefined") {
    window.TerritoryBadgeComponent = territoryBadgeInstance;
}
if (typeof globalThis !== "undefined") {
    globalThis.TerritoryBadgeComponent = territoryBadgeInstance;
}

export { territoryBadgeInstance };
export default territoryBadgeInstance;
