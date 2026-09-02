import { TerritoryBadgeComponent } from './territory_badge_component.js';
import { EmberStatusComponent } from './ember_status_component.js';
import { FloatingFeedbackService } from './floating_feedback_service.js';

/**
 * 🏛️ TopHeaderComponent (最上部HUD・リソースバー・ステータス表示専門コンポーネント)
 * 
 * 責務:
 * 1. 資源（🌾食料 / 🧱資材 / 🛡️防衛力 / ✨神秘）および産出予測レートの描画更新
 * 2. ターン数・Stage規模・残りターン表示の更新
 * 3. 🔥残り火表示および EmberStatusComponent の更新統括
 * 4. 領土マスバッジ (TerritoryBadgeComponent) の更新
 * 5. ⚠️ 試練カウントダウンバッジの点灯・予告制御
 * 6. 資源数値の増減差分を検知し、FloatingFeedbackService で即座にトースト演出を発火
 */
export class TopHeaderComponent {
    constructor(uiController) {
        this.ui = uiController;
        this.emberStatusComponent = (typeof document !== 'undefined') ? new EmberStatusComponent() : null;
        this.lastEmberValue = null;
        this.lastFood = null;
        this.lastWood = null;
        this.lastDefense = null;
        this.lastMystic = null;
        this.initHeaderEvents();
    }

    /**
     * 📊 ヘッダー各種イベントの初期化 (TooltipSystemへの一本化により個別リスナー不要)
     */
    initHeaderEvents() {
        // TooltipSystem が data-tooltip="DATA_PANEL_BREAKDOWN" を自動委譲処理
    }

    get state() {
        return this.ui.state;
    }

    /**
     * DOM要素のテキストを安全に設定するヘルパー
     */
    setElementText(id, text) {
        if (typeof document === "undefined") return;
        const el = document.getElementById(id);
        if (el) el.innerText = (text !== undefined && text !== null) ? text : "";
    }

    /**
     * 🏛️ 最上部ヘッダー全体のリアルタイム更新
     * @param {Object} I18n 多言語辞書オブジェクト
     */
    render(I18n) {
        if (!this.state || typeof document === "undefined") return;

        const prods = (typeof this.state.calculateTotalProduction === "function") 
            ? this.state.calculateTotalProduction() 
            : { totalFood: 10, totalWood: 10, totalMystic: 1 };
        const defTotal = (typeof this.state.calculateTotalDefense === "function") 
            ? this.state.calculateTotalDefense() 
            : (this.state.defense || 10);

        // 1. タイトル ＆ ターン数
        this.setElementText("lblDataPanelTitle", I18n.t("UI_DATA_PANEL_TITLE"));
        this.setElementText("valTurn", this.state.turn);
        this.setElementText("valTurnBg", String(this.state.turn).padStart(2, '0'));

        // 2. 🔥 残り火ステータスコンポーネント (EmberStatusComponent) 連動
        if (this.emberStatusComponent && typeof this.emberStatusComponent.update === "function") {
            this.emberStatusComponent.update(this.state);
        }

        // 3. 🌾 食料 ＆ 純収支
        this.setElementText("valFood", this.state.food);
        if (this.lastFood !== null && this.state.food !== this.lastFood) {
            FloatingFeedbackService.spawnOnElement("#valFood", this.state.food - this.lastFood);
        }
        this.lastFood = this.state.food;

        const netFood = prods.netFood ?? prods.totalFood ?? 0;
        const foodSign = netFood > 0 ? `+${netFood}` : `${netFood}`;
        this.setElementText("valFoodProd", foodSign);
        const foodProdEl = document.getElementById("valFoodProd");
        if (foodProdEl) {
            foodProdEl.style.color = (netFood < 0) ? "#ff6b6b" : "#2ecc71";
        }

        // 4. 🧱 資材 ＆ 🛡️ 防衛力 ＆ ✨ 神秘
        this.setElementText("valWood", this.state.wood);
        if (this.lastWood !== null && this.state.wood !== this.lastWood) {
            FloatingFeedbackService.spawnOnElement("#valWood", this.state.wood - this.lastWood);
        }
        this.lastWood = this.state.wood;
        this.setElementText("valWoodProd", `+${prods.totalWood}`);

        this.setElementText("valDefense", defTotal);
        if (this.lastDefense !== null && defTotal !== this.lastDefense) {
            FloatingFeedbackService.spawnOnElement("#valDefense", defTotal - this.lastDefense);
        }
        this.lastDefense = defTotal;

        this.setElementText("valMystic", this.state.mystic);
        if (this.lastMystic !== null && this.state.mystic !== this.lastMystic) {
            FloatingFeedbackService.spawnOnElement("#valMystic", this.state.mystic - this.lastMystic);
        }
        this.lastMystic = this.state.mystic;
        this.setElementText("valMysticProd", `+${prods.totalMystic || 1}`);

        // 5. 🗺️ 領土バッジ (TerritoryBadgeComponent)
        const placedCount = (typeof this.state.countPlacedTiles === "function") ? this.state.countPlacedTiles() : 1;
        const badgeComp = (typeof TerritoryBadgeComponent !== "undefined" && TerritoryBadgeComponent) 
            ? TerritoryBadgeComponent 
            : (typeof window !== "undefined" ? window.TerritoryBadgeComponent : null);

        if (badgeComp) {
            if (!document.getElementById("mainTerritoryBadge") && typeof badgeComp.mount === "function") {
                badgeComp.mount();
            }
            if (typeof badgeComp.update === "function") {
                badgeComp.update(placedCount, this.state);
            }
        } else {
            const maxT = (this.state.stage && this.state.stage.maxTiles) ? this.state.stage.maxTiles : 24;
            this.setElementText("valPlacedCount", `${placedCount}/${maxT}`);
        }

        // 6. 🏛️ 方針バッジ連携
        if (typeof window !== "undefined" && typeof window.renderDirectiveHeaderBadge === "function") {
            window.renderDirectiveHeaderBadge();
        }

        // 7. ⚠️ 試練カウントダウンの動的表示 (予告期間中のみ点灯)
        const trialBadge = document.getElementById("trialCountdownBadge");
        if (trialBadge) {
            const nextTrial = this.state.nextTrialTurn || (this.state.stage && this.state.stage.id ? this.state.stage.id * 20 : 20);
            const turnsLeft = nextTrial - this.state.turn;
            if (turnsLeft > 0 && turnsLeft <= 5) {
                trialBadge.style.display = "inline-flex";
                this.setElementText("valTrialCountdown", turnsLeft);
            } else {
                trialBadge.style.display = "none";
            }
        }
    }
}
