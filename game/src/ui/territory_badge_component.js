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
            containerEl = document.getElementById("territoryBadgeFooterSlot") || document.getElementById("territoryBadgeContainer");
        }
        if (!containerEl) return;
        this.containerEl = containerEl;
        this.containerEl.innerHTML = "";

        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
        this.badgeEl = document.createElement("div");
        this.badgeEl.className = "territory-badge-pill";
        this.badgeEl.id = "mainTerritoryBadge";
        this.badgeEl.setAttribute("data-tooltip-title", I18n ? I18n.t("UI_TERRITORY_PROGRESS_TOOLTIP") : "🏛️ Territory Reclamation");
        this.badgeEl.onclick = () => {
            if (typeof window.showBreakdownModal === "function") {
                window.showBreakdownModal();
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

        this.update(this.currentCount, this.stage);
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

    static getStageEmberThresholds(stageNum = 1) {
        if (stageNum === 3) return { decayStop: 48, autoHeat: 68 };
        if (stageNum === 2) return { decayStop: 24, autoHeat: 40 };
        return { decayStop: 8, autoHeat: 20 };
    }

    /**
     * 🔄 占有数・ステージ最大マス数の更新
     */
    update(placedCount = 0, stageOrState = 1, options = {}) {
        this.currentCount = placedCount;

        if (!this.countEl && typeof document !== "undefined") {
            const container = document.getElementById("territoryBadgeFooterSlot") || document.getElementById("territoryBadgeContainer");
            if (container) this.mount(container);
        }

        let stateObj = null;
        if (typeof stageOrState === "object" && stageOrState !== null) {
            stateObj = stageOrState;
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
            const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
            const thresholds = (stateObj && typeof stateObj.getStageEmberThresholds === "function") 
                ? stateObj.getStageEmberThresholds() 
                : TerritoryBadgeComponent.getStageEmberThresholds(this.stage);

            const decayDiff = thresholds.decayStop - this.currentCount;
            const heatDiff = thresholds.autoHeat - this.currentCount;

            const decayStatus = (decayDiff <= 0) 
                ? (I18n ? I18n.t("UI_TERRITORY_STATUS_ACHIEVED") : "Achieved") 
                : (I18n ? I18n.t("UI_TERRITORY_STATUS_REMAINING", { count: decayDiff }) : `${decayDiff} tiles left`);

            const heatStatus = (heatDiff <= 0) 
                ? (I18n ? I18n.t("UI_TERRITORY_STATUS_ACHIEVED") : "Achieved") 
                : (I18n ? I18n.t("UI_TERRITORY_STATUS_REMAINING", { count: heatDiff }) : `${heatDiff} tiles left`);

            const breakdown = (stateObj && typeof stateObj.getTerritoryBreakdown === "function")
                ? stateObj.getTerritoryBreakdown()
                : { plains: this.currentCount, forest: 0, deepForest: 0, hill: 0, mountain: 0, desert: 0 };

            // 🗺️ 所有している土地属性のみを抽出し、占有率(%)とともに動的生成
            const terrainItems = [];
            const totalOwned = this.currentCount || 0;
            const plainsCount = breakdown.plains || 0;
            const forestCount = (breakdown.forest || 0) + (breakdown.deepForest || 0);
            const hillCount = breakdown.hill || 0;
            const mountainCount = breakdown.mountain || 0;
            const desertCount = breakdown.desert || 0;

            if (plainsCount > 0) {
                const sharePct = totalOwned > 0 ? Math.round((plainsCount / totalOwned) * 100) : 0;
                terrainItems.push(`・🌾 ${I18n ? I18n.t("TERRAIN_PLAINS") : "草原"}: ${plainsCount}マス (${sharePct}%)`);
            }
            if (forestCount > 0) {
                const sharePct = totalOwned > 0 ? Math.round((forestCount / totalOwned) * 100) : 0;
                terrainItems.push(`・🌲 ${I18n ? I18n.t("TERRAIN_FOREST") : "森"}: ${forestCount}マス (${sharePct}%)`);
            }
            if (hillCount > 0) {
                const sharePct = totalOwned > 0 ? Math.round((hillCount / totalOwned) * 100) : 0;
                terrainItems.push(`・⛰️ ${I18n ? I18n.t("TERRAIN_HILL") : "丘陵"}: ${hillCount}マス (${sharePct}%)`);
            }
            if (mountainCount > 0) {
                const sharePct = totalOwned > 0 ? Math.round((mountainCount / totalOwned) * 100) : 0;
                terrainItems.push(`・🏔️ ${I18n ? I18n.t("TERRAIN_MOUNTAIN") : "山岳"}: ${mountainCount}マス (${sharePct}%)`);
            }
            if (desertCount > 0) {
                const sharePct = totalOwned > 0 ? Math.round((desertCount / totalOwned) * 100) : 0;
                terrainItems.push(`・🏜️ ${I18n ? I18n.t("TERRAIN_DESERT") : "砂漠"}: ${desertCount}マス (${sharePct}%)`);
            }

            const headerText = I18n ? I18n.t("UI_TERRITORY_BREAKDOWN_HEADER") : "🗺️ 所有土地の占有内訳:";
            const emptyText = I18n ? I18n.t("UI_TERRITORY_BREAKDOWN_EMPTY") : "・(未開墾)";
            const breakdownContent = terrainItems.length > 0 ? terrainItems.join("<br>") : emptyText;
            const breakdownSection = `${headerText}<br>${breakdownContent}`;

            const titleText = I18n ? I18n.t("UI_TERRITORY_STAGE_PROGRESS_TITLE", { stage: this.stage }) : `Territory Reclamation (Stage ${this.stage})`;
            const descHtml = I18n ? I18n.t("UI_TERRITORY_STAGE_PROGRESS_DESC", {
                stage: this.stage,
                current: this.currentCount,
                max: this.maxCount,
                pct,
                breakdownSection,
                decayReq: thresholds.decayStop,
                decayStatus,
                heatReq: thresholds.autoHeat,
                heatStatus
            }) : `Territory: ${this.currentCount}/${this.maxCount}`;

            this.badgeEl.setAttribute("data-tooltip-title", titleText);
            this.badgeEl.setAttribute("data-tooltip", descHtml);
            this.badgeEl.removeAttribute("title");

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
