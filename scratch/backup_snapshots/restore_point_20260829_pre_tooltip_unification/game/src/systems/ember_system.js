import { I18n } from '../i18n.js';

/**
 * ====================================================================
 * EmberSystem (Mobile & Unity Ready)
 * ====================================================================
 */
export class EmberSystem {
    constructor(state, engine = null) {
        this.state = state;
        this.engine = engine;
        this.passiveRegens = new Map();

        if (this.state) {
            if (this.state.ember === undefined) this.state.ember = 20;
            if (this.state.maxEmber === undefined) this.state.maxEmber = 20;
            this.state.emberSystem = this;
        }
    }

    get current() {
        return (this.state && this.state.ember !== undefined) ? this.state.ember : 20;
    }

    set current(val) {
        if (this.state) {
            this.state.ember = Math.max(0, val);
        }
    }

    get max() {
        return (this.state && this.state.maxEmber !== undefined) ? this.state.maxEmber : 20;
    }

    set max(val) {
        if (this.state) {
            this.state.maxEmber = Math.max(1, val);
        }
    }

    recoverInstant(amount, allowOvercap = false) {
        if (!amount || amount <= 0) return 0;
        const before = this.current;
        const target = allowOvercap ? (before + amount) : Math.min(this.max, before + amount);
        this.current = target;
        return target - before;
    }

    addBonus(amount) {
        return this.recoverInstant(amount, true);
    }

    registerPassiveRegen(sourceKey, amount) {
        if (!sourceKey || typeof amount !== 'number') return;
        this.passiveRegens.set(sourceKey, amount);
    }

    unregisterPassiveRegen(sourceKey) {
        if (!sourceKey) return;
        this.passiveRegens.delete(sourceKey);
    }

    getPassiveRegenTotal() {
        let total = 0;
        for (const val of this.passiveRegens.values()) {
            total += val;
        }
        return total;
    }

    expandMaxCapacity(amount) {
        if (!amount || amount <= 0) return this.max;
        this.max += amount;
        return this.max;
    }

    consume(amount) {
        if (!amount || amount <= 0) return true;
        if (this.current < amount) return false;
        this.current -= amount;
        return true;
    }

    applyDamage(amount) {
        if (!amount || amount <= 0) return this.current;
        this.current = Math.max(0, this.current - amount);
        return this.current;
    }

    getStatus() {
        const val = this.current;
        if (val >= 24) return 'PROSPEROUS';
        if (val <= 9) return 'CRISIS';
        return 'STANDARD';
    }

    getFoodMaintenanceCost() {
        const status = this.getStatus();
        if (status === 'PROSPEROUS') return 25;
        if (status === 'CRISIS') return 15;
        return 20;
    }

    getBlessingBonuses() {
        if (this.getStatus() === 'PROSPEROUS') {
            return { multiplier: 1.10, flatMysticBonus: 2 };
        }
        return { multiplier: 1.0, flatMysticBonus: 0 };
    }

    calculateTurnBalance() {
        const i18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : I18n;
        const status = this.getStatus();
        const foodCost = this.getFoodMaintenanceCost();

        const tileCount = (this.state && typeof this.state.getTerritoryTileCount === 'function')
            ? this.state.getTerritoryTileCount()
            : 0;
        const thresholds = (this.state && typeof this.state.getStageEmberThresholds === 'function')
            ? this.state.getStageEmberThresholds()
            : { decayStop: 8, autoHeat: 20 };

        let decayDelta = -1;
        let nextMilestoneProgress = Math.min(1.0, tileCount / thresholds.decayStop);

        if (tileCount >= thresholds.autoHeat) {
            decayDelta = 1;
            nextMilestoneProgress = 1.0;
        } else if (tileCount >= thresholds.decayStop) {
            decayDelta = 0;
            nextMilestoneProgress = (tileCount - thresholds.decayStop) / (thresholds.autoHeat - thresholds.decayStop);
        }

        if (this.state && this.state.emberConsumptionReducedTurns > 0 && decayDelta < 0) {
            decayDelta += 1;
        }

        let reserveCost = 0;
        const hasReserved = this.state && this.state.reserveSlots && this.state.reserveSlots.some(s => s !== null && !s.isBlank);
        if (hasReserved) {
            if (this.state.reserveFeeWaivedTurns && this.state.reserveFeeWaivedTurns > 0) {
                reserveCost = 0;
            } else {
                reserveCost = -1;
            }
        }

        const passiveRegen = this.getPassiveRegenTotal();
        const totalDelta = decayDelta + reserveCost + passiveRegen;

        let statusTitle = i18n.t('UI_STATUS_TITLE_STANDARD');
        let statusBadgeClass = 'status-standard';
        let statusEffectText = i18n.t('UI_STATUS_EFFECT_STANDARD');

        if (status === 'PROSPEROUS') {
            statusTitle = i18n.t('UI_STATUS_TITLE_PROSPEROUS');
            statusBadgeClass = 'status-prosperous';
            statusEffectText = i18n.t('UI_STATUS_EFFECT_PROSPEROUS');
        } else if (status === 'CRISIS') {
            statusTitle = i18n.t('UI_STATUS_TITLE_CRISIS');
            statusBadgeClass = 'status-crisis';
            statusEffectText = i18n.t('UI_STATUS_EFFECT_CRISIS');
        }

        return {
            ember: this.current,
            maxEmber: this.max,
            food: (this.state && this.state.food !== undefined) ? this.state.food : 0,
            statusLevel: status,
            statusTitle,
            statusBadgeClass,
            statusEffectText,
            foodCost,
            decayDelta,
            reserveCost,
            passiveRegen,
            totalTurnDelta: totalDelta,
            emberDeltaText: (decayDelta > 0 ? ('+' + decayDelta) : ('' + decayDelta)) + ' ' + i18n.t('UI_EMBER_PER_TURN_LABEL'),
            reserveCostText: reserveCost + ' ' + i18n.t('UI_EMBER_UNIT'),
            nextMilestoneProgress
        };
    }
}
