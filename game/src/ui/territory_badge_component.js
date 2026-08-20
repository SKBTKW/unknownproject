/* =============================================================
   game/src/ui/territory_badge_component.js
   土地グリッド右下隅吸着 領土占有状況・ステージ連動開拓数表示コンポーネント
   ============================================================= */

export class TerritoryBadgeComponent {
    constructor() {
        this.containerEl = null;
        this.badgeEl = null;
        this.labelEl = null;
        this.countEl = null;
        this.currentCount = 0;
        this.maxCount = 24;
        this.stage = 1;
    }

    /**
     * 🏗️ UIの初期構築 (土地グリッド右下隅へ吸着配置)
     */
    mount(containerEl) {
        if (!containerEl) return;
        this.containerEl = containerEl;
        this.containerEl.innerHTML = "";

        this.badgeEl = document.createElement("div");
        this.badgeEl.className = "main-area-badge territory-grid-bottom-right";
        this.badgeEl.id = "mainTerritoryBadge";
        this.badgeEl.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(18, 24, 38, 0.92);
            border: 1.5px solid #1abc9c;
            color: #1abc9c;
            font-weight: 900;
            padding: 5px 14px;
            border-radius: 20px;
            font-size: 13px;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.7), 0 0 10px rgba(26, 188, 156, 0.3);
            backdrop-filter: blur(8px);
            transition: all 0.2s ease;
            user-select: none;
            cursor: default;
        `;

        this.labelEl = document.createElement("span");
        this.labelEl.id = "lblMainBadge";
        this.labelEl.innerText = "🏛️ 領土占有";

        this.countEl = document.createElement("span");
        this.countEl.id = "valPlacedCount";
        this.countEl.style.cssText = "color: #ffffff; font-size: 13.5px; font-weight: bold;";
        this.countEl.innerText = "0/24";

        this.badgeEl.appendChild(this.labelEl);
        this.badgeEl.appendChild(this.countEl);
        this.containerEl.appendChild(this.badgeEl);
    }

    /**
     * 🎯 ステージに応じた最大開拓可能マス数の取得
     * - Stage 1 (5x5): 本営1マスを除く 24 マス
     * - Stage 2 (7x7): 本営1マスを除く 48 マス
     * - Stage 3 (9x9): 本営1マスを除く 80 マス
     */
    static getMaxTilesForStage(stageNum = 1) {
        if (stageNum === 3) return 80;
        if (stageNum === 2) return 48;
        return 24; // Stage 1 デフォルト
    }

    /**
     * 🔄 占有数・ステージ最大マス数の更新
     * @param {number} placedCount - 配置済みマス数 (本営を除く累積ブロック数)
     * @param {number|Object} [stageOrState=1] - ステージ番号またはGameState
     * @param {Object} [options={}] - オプション
     */
    update(placedCount = 0, stageOrState = 1, options = {}) {
        this.currentCount = placedCount;

        if (typeof stageOrState === "object" && stageOrState !== null) {
            this.stage = stageOrState.stage || (stageOrState.turn ? Math.min(3, Math.floor((stageOrState.turn - 1) / 20) + 1) : 1);
        } else if (typeof stageOrState === "number") {
            this.stage = stageOrState;
        } else {
            this.stage = 1;
        }

        this.maxCount = TerritoryBadgeComponent.getMaxTilesForStage(this.stage);

        if (!this.countEl) return;

        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' && window.I18n ? window.I18n : { t: k => k });
        const labelText = options.labelText || I18n.t("UI_MAIN_AREA_BADGE") || "🏛️ 領土占有";

        if (this.labelEl) {
            this.labelEl.innerText = labelText;
        }

        const pct = Math.round((this.currentCount / this.maxCount) * 100);
        this.countEl.innerHTML = `<span style="color:#2ecc71;">${this.currentCount}</span><span style="color:#7f8c8d;">/${this.maxCount}</span> <small style="font-size:11px; color:#a4b0be; margin-left:4px;">(${pct}%)</small>`;

        if (this.badgeEl) {
            this.badgeEl.title = `Stage ${this.stage} 支配地占有率: ${pct}% (開拓済み: ${this.currentCount}マス / 最大: ${this.maxCount}マス / 残り: ${this.maxCount - this.currentCount}マス)`;
            if (pct >= 80) {
                this.badgeEl.style.borderColor = "#f1c40f";
                this.badgeEl.style.boxShadow = "0 4px 14px rgba(0,0,0,0.7), 0 0 14px rgba(241, 196, 15, 0.5)";
            } else {
                this.badgeEl.style.borderColor = "#1abc9c";
                this.badgeEl.style.boxShadow = "0 4px 14px rgba(0,0,0,0.7), 0 0 10px rgba(26, 188, 156, 0.3)";
            }
        }
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
