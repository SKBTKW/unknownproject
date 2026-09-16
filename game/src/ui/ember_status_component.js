/**
 * ====================================================================
 * 🎮 EmberStatusComponent (残り火詳細ステータス・HUDコンポーネント)
 * ====================================================================
 * 
 * 責務:
 * 1. 🔥 残り火の状態（旺盛/標準/危機）、食料維持費、自然減衰/自家発熱、保留維持費の統合計算 (Single Source of Truth)
 * 2. PC マウスオーバー ＆ スマホ/タッチ タップトグル両対応の詳細 HUD ツールチップ描画
 * 3. データロジック (calculateStatus) と DOM レンダリングの完全分離 (Mobile & Unity Ready)
 */

export class EmberStatusComponent {
    /**
     * @param {HTMLElement} [anchorElement=null] - ツールチップを吸着させるアンカー要素 (HQ【C3】マス: #hqEmberCellAnchor)
     */
    constructor(anchorElement = null) {
        this.anchorElement = anchorElement || (typeof document !== 'undefined' ? (document.getElementById('hqEmberCellAnchor') || document.querySelector('.cell.hq')) : null);
        this.tooltipElement = null;
        this.isOpen = false;
        this.hoverTimer = null;
        this.latestState = null;
        this._boundMouseEnter = () => {
            clearTimeout(this.hoverTimer);
            this.hoverTimer = setTimeout(() => this.show(), 120);
        };
        this._boundMouseLeave = () => {
            clearTimeout(this.hoverTimer);
            this.hoverTimer = setTimeout(() => this.hide(), 180);
        };
        this._boundClick = (e) => {
            e.stopPropagation();
            this.toggle();
        };

        if (typeof document !== 'undefined') {
            this.initDOM();
            this.bindEvents();
        }
    }

    /**
     * 🔗 新しいアンカー要素（HQマス等）に再バインド
     * @param {HTMLElement} newAnchor
     */
    bindToAnchor(newAnchor) {
        if (!newAnchor || typeof document === 'undefined') return;
        if (this.anchorElement && this.anchorElement !== newAnchor) {
            this.anchorElement.removeEventListener('mouseenter', this._boundMouseEnter);
            this.anchorElement.removeEventListener('mouseleave', this._boundMouseLeave);
            this.anchorElement.removeEventListener('click', this._boundClick);
        }
        this.anchorElement = newAnchor;
        this.initDOM();
        this.bindEvents();
        if (this.latestState) {
            this.update(this.latestState);
        }
    }

    /**
     * 🧮 残り火ステータスの純粋データ計算 (Unity / Headless テスト対応)
     * @param {Object} state - GameState オブジェクト
     * @returns {Object} 詳細なステータス構造体
     */
    static calculateStatus(state) {
        if (state && state.emberSystem && typeof state.emberSystem.calculateTurnBalance === 'function') {
            return state.emberSystem.calculateTurnBalance();
        }

        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });

        if (!state) {
            return {
                ember: 20,
                food: 50,
                statusLevel: 'STANDARD',
                statusTitle: I18n ? I18n.t('UI_STATUS_TITLE_STANDARD') : '🔥 標準',
                statusBadgeClass: 'status-standard',
                statusEffectText: I18n ? I18n.t('UI_STATUS_EFFECT_STANDARD') : '通常状態 (安定燃焼)',
                foodCost: 20,
                emberDelta: -1,
                emberDeltaText: '-1 🔥/T',
                reserveCost: 0,
                reserveCostText: '0 🔥',
                totalTurnDelta: -1,
                nextMilestoneText: '',
                nextMilestoneProgress: 0
            };
        }

        const ember = state.ember !== undefined ? state.ember : 20;
        const food = state.food !== undefined ? state.food : 0;

        // 1. 🔥 状態ステッピング判定
        let statusLevel = 'STANDARD';
        let statusTitle = I18n ? I18n.t('UI_STATUS_TITLE_STANDARD') : '🔥 標準';
        let statusBadgeClass = 'status-standard';
        let statusEffectText = I18n ? I18n.t('UI_STATUS_EFFECT_STANDARD') : '通常維持状態 (食料維持費 🌾20/T)';
        let foodCost = 20;

        if (ember >= 24) {
            statusLevel = 'PROSPEROUS';
            statusTitle = I18n ? I18n.t('UI_STATUS_TITLE_PROSPEROUS') : '🔥 旺盛';
            statusBadgeClass = 'status-prosperous';
            statusEffectText = I18n ? I18n.t('UI_STATUS_EFFECT_PROSPEROUS') : '全産出 +10% ブースト ＆ 毎ターン ✨+2/T';
            foodCost = 25;
        } else if (ember <= 9) {
            statusLevel = 'CRISIS';
            statusTitle = I18n ? I18n.t('UI_STATUS_TITLE_CRISIS') : '🔥 危機 (微火)';
            statusBadgeClass = 'status-crisis';
            statusEffectText = I18n ? I18n.t('UI_STATUS_EFFECT_CRISIS') : '省エネ復興中 (食料維持費 🌾15/T 減圧)';
            foodCost = 15;
        }

        // 2. 🗺️ 領土マス数 ＆ Stage連動による燃焼減衰・自家発熱判定
        const tileCount = (state && typeof state.getTerritoryTileCount === 'function') ? state.getTerritoryTileCount() : 0;
        const thresholds = (state && typeof state.getStageEmberThresholds === 'function') ? state.getStageEmberThresholds() : { decayStop: 8, autoHeat: 20 };

        let emberDelta = -1;
        let emberDeltaText = '-1 🔥/T';
        let nextMilestoneText = '';
        let nextMilestoneProgress = Math.min(1.0, tileCount / thresholds.decayStop);

        if (tileCount >= thresholds.autoHeat) {
            emberDelta = 1;
            emberDeltaText = '+1 🔥/T';
            nextMilestoneProgress = 1.0;
        } else if (tileCount >= thresholds.decayStop) {
            emberDelta = 0;
            emberDeltaText = '0 🔥/T';
            nextMilestoneProgress = (tileCount - thresholds.decayStop) / (thresholds.autoHeat - thresholds.decayStop);
        }

        // 3. 📥 保留スロット維持費判定
        let reserveCost = 0;
        let reserveCostText = '0 🔥';
        const hasReserved = state.reserveSlots && state.reserveSlots.some(s => s !== null && !s.isBlank);
        if (hasReserved) {
            if (state.reserveFeeWaivedTurns && state.reserveFeeWaivedTurns > 0) {
                reserveCost = 0;
                reserveCostText = '0 🔥';
            } else {
                reserveCost = -1;
                reserveCostText = '-1 🔥/T';
            }
        }

        const totalTurnDelta = emberDelta + reserveCost;

        return {
            ember,
            food,
            statusLevel,
            statusTitle,
            statusBadgeClass,
            statusEffectText,
            foodCost,
            emberDelta,
            emberDeltaText,
            reserveCost,
            reserveCostText,
            totalTurnDelta,
            nextMilestoneText,
            nextMilestoneProgress
        };
    }

    /**
     * 🏗️ DOM 要素の初期構築
     */
    initDOM() {
        if (!this.anchorElement) return;

        const existing = document.getElementById('emberDetailTooltip');
        if (existing) existing.remove();

        this.tooltipElement = document.createElement('div');
        this.tooltipElement.id = 'emberDetailTooltip';
        this.tooltipElement.className = 'ember-detail-tooltip-container ember-tooltip-hidden';
        this.tooltipElement.setAttribute('role', 'tooltip');
        this.tooltipElement.setAttribute('aria-hidden', 'true');

        this.anchorElement.appendChild(this.tooltipElement);
        this.anchorElement.style.cursor = 'pointer';
    }

    /**
     * 🖱️ イベントハンドラのバインド (PC Hover ＆ スマホ Tap トグル)
     */
    bindEvents() {
        if (!this.anchorElement) return;

        this.anchorElement.addEventListener('mouseenter', this._boundMouseEnter);
        this.anchorElement.addEventListener('mouseleave', this._boundMouseLeave);
        this.anchorElement.addEventListener('click', this._boundClick);

        if (!this._globalClickBound) {
            document.addEventListener('click', (e) => {
                if (this.isOpen && this.anchorElement && !this.anchorElement.contains(e.target)) {
                    this.hide();
                }
            });
            this._globalClickBound = true;
        }
    }

    /**
     * 🔄 ステータス更新 ＆ HTML レンダリング
     * @param {Object} state - GameState オブジェクト
     */
    update(state) {
        this.latestState = state;
        if (this.anchorElement) {
            const b = this.anchorElement.querySelector('.hq-ember-val-badge') || document.getElementById('hqEmberValBadge');
            if (b) b.innerText = (state && state.ember !== undefined ? state.ember : 20);
        }
        if (!this.tooltipElement) return;
        const info = EmberStatusComponent.calculateStatus(state);

        const deltaSign = info.totalTurnDelta > 0 ? '+' + info.totalTurnDelta : '' + info.totalTurnDelta;
        const deltaClass = info.totalTurnDelta > 0 ? 'text-positive' : (info.totalTurnDelta === 0 ? 'text-neutral' : 'text-negative');

        this.tooltipElement.innerHTML = `
            <div class="ember-tooltip-card">
                <div class="ember-tooltip-header">
                    <span class="ember-tooltip-title">${info.statusTitle}</span>
                    <span class="ember-tooltip-badge ${info.statusBadgeClass}">🔥 ${info.ember}</span>
                </div>
                <div class="ember-tooltip-effect">${info.statusEffectText}</div>

                <div class="ember-tooltip-divider"></div>

                <div class="ember-tooltip-section-title">${I18n ? I18n.t("UI_EMBER_BREAKDOWN_TITLE") : "📊 毎ターンの維持 ＆ 収支内訳"}</div>
                <div class="ember-tooltip-row">
                    <span class="row-label">${I18n ? I18n.t("UI_EMBER_ROW_FOOD_MAINT") : "🌾 食料維持費:"}</span>
                    <span class="row-val text-warning">-${info.foodCost} / T</span>
                </div>
                <div class="ember-tooltip-row">
                    <span class="row-label">${I18n ? I18n.t("UI_EMBER_ROW_FOOD_ACCUM") : "🔥 食料蓄積効果:"}</span>
                    <span class="row-val">${info.emberDeltaText}</span>
                </div>
                <div class="ember-tooltip-row">
                    <span class="row-label">${I18n ? I18n.t("UI_EMBER_ROW_RESERVE_MAINT") : "📥 保留枠維持費:"}</span>
                    <span class="row-val">${info.reserveCostText}</span>
                </div>

                <div class="ember-tooltip-divider"></div>

                <div class="ember-tooltip-row ember-tooltip-total">
                    <span class="row-label font-bold">${I18n ? I18n.t("UI_EMBER_ROW_ESTIMATED") : "🔥 ターン終了時 収支予測:"}</span>
                    <span class="row-val ${deltaClass} font-bold">${deltaSign} 🔥 / T</span>
                </div>

                <div class="ember-tooltip-milestone">
                    <div class="milestone-label">${info.nextMilestoneText}</div>
                    <div class="milestone-bar-bg">
                        <div class="milestone-bar-fill" style="width: ${Math.round(info.nextMilestoneProgress * 100)}%;"></div>
                    </div>
                </div>
            </div>
        `;
    }

    show() {
        if (!this.tooltipElement) return;
        this.tooltipElement.classList.remove('ember-tooltip-hidden');
        this.tooltipElement.setAttribute('aria-hidden', 'false');
        this.isOpen = true;
    }

    hide() {
        if (!this.tooltipElement) return;
        this.tooltipElement.classList.add('ember-tooltip-hidden');
        this.tooltipElement.setAttribute('aria-hidden', 'true');
        this.isOpen = false;
    }

    toggle() {
        if (this.isOpen) this.hide();
        else this.show();
    }
}
