/* =============================================================
   game/src/systems/buff_system.js
   ゲーム内の全バフ（環境バフ・カード効果バフ・建設・持続バフ）を一元集中管理する独立ドメインモジュール
   ============================================================= */

export class BuffSystem {
    constructor(gameState, engine = null) {
        this.state = gameState;
        this.engine = engine;
        this.buffs = [];
        this.initDefaultBuffs();
    }

    /**
     * 🌟 初期環境バフの登録
     */
    initDefaultBuffs() {
        this.updateEnvironmentBuffs();
    }

    /**
     * 🔥 残り火レベルに基づく環境バフの自動同期・更新
     */
    updateEnvironmentBuffs() {
        if (!this.state) return;
        const ember = this.state.ember !== undefined ? this.state.ember : 20;

        // 既存の環境バフを一度除去
        this.buffs = this.buffs.filter(b => b.category !== "ENVIRONMENT");

        if (ember >= 20) {
            this.buffs.unshift({
                id: "ENV_EMBER_PROSPERITY",
                name: "🔥 残り火旺盛バフ",
                shortName: "旺盛 (+20%)",
                icon: "🔥",
                description: "残り火の加護により全リソース産出 +20% ＆ 自動✨+2/T",
                badgeText: "環境バフ",
                category: "ENVIRONMENT",
                multiplier: 1.20,
                mysticBonus: 2
            });
        } else if (ember >= 12) {
            this.buffs.unshift({
                id: "ENV_EMBER_STANDARD",
                name: "🔥 残り火標準バフ",
                shortName: "標準 (+10%)",
                icon: "🔥",
                description: "残り火の加護により全リソース産出 +10% ＆ 自動✨+1/T",
                badgeText: "環境バフ",
                category: "ENVIRONMENT",
                multiplier: 1.10,
                mysticBonus: 1
            });
        }
    }

    /**
     * ➕ バフの追加
     */
    addBuff(buffDef) {
        if (!buffDef || !buffDef.id) return false;
        // 同一IDの重複登録を防止（既存がある場合は上書き更新）
        const existingIdx = this.buffs.findIndex(b => b.id === buffDef.id);
        if (existingIdx !== -1) {
            this.buffs[existingIdx] = Object.assign({}, this.buffs[existingIdx], buffDef);
        } else {
            this.buffs.push(Object.assign({}, buffDef));
        }
        return true;
    }

    /**
     * ➖ バフの削除
     */
    removeBuff(buffId) {
        const initialLen = this.buffs.length;
        this.buffs = this.buffs.filter(b => b.id !== buffId);
        return this.buffs.length < initialLen;
    }

    /**
     * 🔍 バフの存在チェック
     */
    hasBuff(buffId) {
        return this.buffs.some(b => b.id === buffId);
    }

    /**
     * 📋 UI表示用バフリストの取得（国家方針は除外）
     */
    getDisplayBuffs() {
        this.updateEnvironmentBuffs();
        return [...this.buffs];
    }

    /**
     * 📊 産出倍率補正の合算取得
     */
    getProductionMultipliers() {
        this.updateEnvironmentBuffs();
        let foodMult = 1.0;
        let woodMult = 1.0;
        let mysticMult = 1.0;

        for (const buff of this.buffs) {
            if (buff.multiplier) {
                foodMult *= buff.multiplier;
                woodMult *= buff.multiplier;
                mysticMult *= buff.multiplier;
            }
            if (buff.foodMultiplier) foodMult *= buff.foodMultiplier;
            if (buff.woodMultiplier) woodMult *= buff.woodMultiplier;
            if (buff.mysticMultiplier) mysticMult *= buff.mysticMultiplier;
        }

        return { foodMult, woodMult, mysticMult };
    }

    /**
     * ✨ 自動神秘・固定ボーナスの合算取得
     */
    getFlatMysticBonus() {
        this.updateEnvironmentBuffs();
        let bonus = 0;
        for (const buff of this.buffs) {
            if (buff.mysticBonus) bonus += buff.mysticBonus;
        }
        return bonus;
    }

    /**
     * 🛡️ 防衛力バフボーナスの合算取得
     */
    getDefenseBonus() {
        let bonus = 0;
        for (const buff of this.buffs) {
            if (buff.defenseBonus) bonus += buff.defenseBonus;
        }
        return bonus;
    }

    /**
     * ⏳ ターン経過処理（持続バフのターン数減少と失効）
     */
    tickTurn() {
        const expiredBuffs = [];
        for (let i = this.buffs.length - 1; i >= 0; i--) {
            const buff = this.buffs[i];
            if (buff.remainingTurns !== undefined) {
                buff.remainingTurns -= 1;
                buff.badgeText = `残り ${buff.remainingTurns}T`;
                if (buff.remainingTurns <= 0) {
                    expiredBuffs.push(buff);
                    this.buffs.splice(i, 1);
                }
            }
        }
        this.updateEnvironmentBuffs();
        return expiredBuffs;
    }
}

if (typeof window !== "undefined") {
    window.BuffSystem = BuffSystem;
}
if (typeof globalThis !== "undefined") {
    globalThis.BuffSystem = BuffSystem;
}

export default BuffSystem;
