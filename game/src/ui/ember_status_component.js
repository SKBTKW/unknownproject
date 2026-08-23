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
     * @param {HTMLElement} [anchorElement=null] - ツールチップを吸着させるアンカー要素 (#emberCenterBoxMaster)
     */
    constructor(anchorElement = null) {
        this.anchorElement = anchorElement || (typeof document !== 'undefined' ? document.getElementById('emberCenterBoxMaster') : null);
        this.tooltipElement = null;
        this.isOpen = false;
        this.hoverTimer = null;

        if (typeof document !== 'undefined') {
            this.initDOM();
            this.bindEvents();
        }
    }

    /**
     * 🧮 残り火ステータスの純粋データ計算 (Unity / Headless テスト対応)
     * @param {Object} state - GameState オブジェクト
     * @returns {Object} 詳細なステータス構造体
     */
    static calculateStatus(state) {
        if (!state) {
            return {
                ember: 20,
                food: 50,
                statusLevel: 'STANDARD',
                statusTitle: '🔥 標準',
                statusBadgeClass: 'status-standard',
                statusEffectText: '通常状態 (安定燃焼)',
                foodCost: 20,
                emberDelta: -1,
                emberDeltaText: '標準燃焼 (-1 🔥/T)',
                reserveCost: 0,
                reserveCostText: '保留枠 空 (0 🔥)',
                totalTurnDelta: -1,
                nextMilestoneText: '食料 200 で減衰ストップ！',
                nextMilestoneProgress: 30 / 200
            };
        }

        const ember = state.ember !== undefined ? state.ember : 20;
        const food = state.food !== undefined ? state.food : 0;

        // 1. 🔥 状態ステッピング判定
        let statusLevel = 'STANDARD';
        let statusTitle = '🔥 標準';
        let statusBadgeClass = 'status-standard';
        let statusEffectText = '通常維持状態 (食料維持費 🌾20/T)';
        let foodCost = 20;

        if (ember >= 24) {
            statusLevel = 'PROSPEROUS';
            statusTitle = '🔥 旺盛';
            statusBadgeClass = 'status-prosperous';
            statusEffectText = '全産出 +10% ブースト ＆ 毎ターン ✨+2/T';
            foodCost = 25;
        } else if (ember <= 9) {
            statusLevel = 'CRISIS';
            statusTitle = '🔥 危機 (微火)';
            statusBadgeClass = 'status-crisis';
            statusEffectText = '省エネ復興中 (食料維持費 🌾15/T 減圧)';
            foodCost = 15;
        }

        // 2. 🗺️ 領土マス数 ＆ Stage連動による燃焼減衰・自家発熱判定
        const tileCount = (state && typeof state.getTerritoryTileCount === 'function') ? state.getTerritoryTileCount() : 0;
        const thresholds = (state && typeof state.getStageEmberThresholds === 'function') ? state.getStageEmberThresholds() : { decayStop: 8, autoHeat: 20 };

        let emberDelta = -1;
        let emberDeltaText = '標準燃焼 (-1 🔥/T)';
        let nextMilestoneText = 'あと ' + Math.max(0, thresholds.decayStop - tileCount) + ' マスで減衰ストップ！';
        let nextMilestoneProgress = Math.min(1.0, tileCount / thresholds.decayStop);

        if (tileCount >= thresholds.autoHeat) {
            emberDelta = 1;
            emberDeltaText = '自家発熱 (+1 🔥/T 自動回復！)';
            nextMilestoneText = '最高段階 (領土大繁栄中！)';
            nextMilestoneProgress = 1.0;
        } else if (tileCount >= thresholds.decayStop) {
            emberDelta = 0;
            emberDeltaText = '減衰ストップ (0 🔥/T 維持)';
            nextMilestoneText = 'あと ' + Math.max(0, thresholds.autoHeat - tileCount) + ' マスで自家発熱 (+1 🔥/T)！';
            nextMilestoneProgress = (tileCount - thresholds.decayStop) / (thresholds.autoHeat - thresholds.decayStop);
        }

        // 3. 📥 保留スロット維持費判定
        let reserveCost = 0;
        let reserveCostText = '保留枠 空 (0 🔥)';
        const hasReserved = state.reserveSlots && state.reserveSlots.some(s => s !== null && !s.isBlank);
        if (hasReserved) {
            if (state.reserveFeeWaivedTurns && state.reserveFeeWaivedTurns > 0) {
                reserveCost = 0;
                reserveCostText = '免除中 (残り ' + state.reserveFeeWaivedTurns + 'T)';
            } else {
                reserveCost = -1;
                reserveCostText = 'カード保留維持費 (-1 🔥/T)';
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

        this.anchorElement.addEventListener('mouseenter', () => {
            clearTimeout(this.hoverTimer);
            this.hoverTimer = setTimeout(() => this.show(), 150);
        });

        this.anchorElement.addEventListener('mouseleave', () => {
            clearTimeout(this.hoverTimer);
            this.hoverTimer = setTimeout(() => this.hide(), 200);
        });

        this.anchorElement.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        document.addEventListener('click', (e) => {
            if (this.isOpen && !this.anchorElement.contains(e.target)) {
                this.hide();
            }
        });
    }

    /**
     * 🔄 ステータス更新 ＆ HTML レンダリング
     * @param {Object} state - GameState オブジェクト
     */
    update(state) {
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

                <div class="ember-tooltip-section-title">📊 毎ターンの維持 ＆ 収支内訳</div>
                <div class="ember-tooltip-row">
                    <span class="row-label">🌾 食料維持費:</span>
                    <span class="row-val text-warning">-${info.foodCost} / T</span>
                </div>
                <div class="ember-tooltip-row">
                    <span class="row-label">🔥 食料蓄積効果:</span>
                    <span class="row-val">${info.emberDeltaText}</span>
                </div>
                <div class="ember-tooltip-row">
                    <span class="row-label">📥 保留枠維持費:</span>
                    <span class="row-val">${info.reserveCostText}</span>
                </div>

                <div class="ember-tooltip-divider"></div>

                <div class="ember-tooltip-row ember-tooltip-total">
                    <span class="row-label font-bold">🔥 ターン終了時 収支予測:</span>
                    <span class="row-val ${deltaClass} font-bold">${deltaSign} 🔥 / T</span>
                </div>

                <div class="ember-tooltip-milestone">
                    <div class="milestone-label">🌾 目標: ${info.nextMilestoneText}</div>
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
