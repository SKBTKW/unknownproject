/**
 * 🔄 CardCycleSystem: Offering 再提示 Cooldown (転生サイクル) システム
 * 
 * 【確定仕様】
 * - 状態は「絶対再提示可能ターン (availableTurn = currentTurn + cooldown + 1)」として保持。
 * - tick() による毎ターン減衰を全廃し、状態比較 (currentTurn < availableTurn) のみで判定。
 * - cyclePolicy: "LAND_STANDARD" (CD=1固定) | "RARITY" (C:1, UC:3±1, R:7±1, UR:15±1) | "UNIQUE" (選択時消費)
 * - Hold と Cooldown は完全分離 (Hold中も内部時間は進むが、手札には二重提示されない)。
 * - 候補不足時は 3 段階の制約緩和フォールバック (通常 ➔ CD最小解禁 ➔ 基本土地CD無視)。
 */

export const CYCLE_POLICIES = Object.freeze({
    LAND_STANDARD: "LAND_STANDARD",
    RARITY: "RARITY",
    UNIQUE: "UNIQUE"
});

export const BASE_COOLDOWNS = Object.freeze({
    C: 1,
    UC: 3,
    R: 7,
    UR: 15
});

export class CardCycleSystem {
    /**
     * @param {Object} state - GameState
     * @param {Object} [engine=null] - GameEngine
     */
    constructor(state, engine = null) {
        this.state = state;
        this.engine = engine;
        this.init();
    }

    init() {
        if (!this.state) return;
        if (!this.state.cardCooldowns || typeof this.state.cardCooldowns !== "object") {
            this.state.cardCooldowns = {};
        }
        if (!Array.isArray(this.state.consumedUniqueCards)) {
            this.state.consumedUniqueCards = [];
        }
    }

    /**
     * 🎲 ジッター乱数の取得 (Engine RNG 優先, フォールバック Math.random)
     * @returns {-1 | 0 | 1}
     */
    getRandomJitter() {
        if (this.engine && typeof this.engine.getRandom === "function") {
            const val = this.engine.getRandom();
            return Math.floor(val * 3) - 1;
        }
        return Math.floor(Math.random() * 3) - 1;
    }

    /**
     * 🧮 カードの Cooldown ターン数を算出
     * @param {Object} card 
     * @returns {number} Cooldown ターン数
     */
    calculateCooldown(card) {
        if (!card) return 1;

        const policy = card.cyclePolicy || (card.category === "LAND" ? CYCLE_POLICIES.LAND_STANDARD : CYCLE_POLICIES.RARITY);

        // 1. 基本土地ポリシー: 一律 1 ターン固定 (次ターン出ず、その次のターンから復帰)
        if (policy === CYCLE_POLICIES.LAND_STANDARD) {
            return 1;
        }

        // 2. UNIQUE ポリシー / RARITY ポリシー: レアリティ別ジッター計算
        const rarity = (card.rarity || "C").toUpperCase();
        switch (rarity) {
            case "C":
                return 1; // C は 1 固定 (ジッターなし)
            case "UC": {
                const j = this.getRandomJitter();
                return Math.max(1, BASE_COOLDOWNS.UC + j); // 2 〜 4 ターン
            }
            case "R": {
                const j = this.getRandomJitter();
                return BASE_COOLDOWNS.R + j; // 6 〜 8 ターン
            }
            case "UR": {
                const j = this.getRandomJitter();
                return BASE_COOLDOWNS.UR + j; // 14 〜 16 ターン
            }
            default:
                return 1;
        }
    }

    /**
     * 📥 確定した手札オファリング（3枚）の Cooldown を登録
     * @param {Array<Object>} cards - 最終確定した手札カード配列
     * @param {number} currentTurn - 現在のターン数
     */
    registerOffering(cards, currentTurn) {
        if (!this.state || !Array.isArray(cards)) return;
        this.init();

        for (const card of cards) {
            if (!card) continue;
            const cardId = card.cardMasterId || (card.terrain ? card.terrain.id : card.id);
            if (!cardId) continue;

            const tObj = card.terrain || card;
            const cd = this.calculateCooldown(tObj);
            // 確定数式: availableTurn = currentTurn + cooldown + 1
            const availableTurn = currentTurn + cd + 1;
            this.state.cardCooldowns[cardId] = availableTurn;
        }
    }

    /**
     * 🛡️ カードが Cooldown 中（再提示不可）か判定
     * @param {string} cardId 
     * @param {number} currentTurn 
     * @returns {boolean}
     */
    isInCooldown(cardId, currentTurn) {
        if (!this.state || !this.state.cardCooldowns) return false;
        const availableTurn = this.state.cardCooldowns[cardId];
        return availableTurn != null && currentTurn < availableTurn;
    }

    /**
     * 📍 カードの再提示可能ターンを取得
     * @param {string} cardId 
     * @returns {number|null}
     */
    getAvailableTurn(cardId) {
        if (!this.state || !this.state.cardCooldowns) return null;
        return this.state.cardCooldowns[cardId] ?? null;
    }

    /**
     * ⏳ カードの残り Cooldown ターン数を取得（UI表示用）
     * @param {string} cardId 
     * @param {number} currentTurn 
     * @returns {number}
     */
    getRemainingTurns(cardId, currentTurn) {
        if (!this.state || !this.state.cardCooldowns) return 0;
        const av = this.state.cardCooldowns[cardId];
        if (av == null) return 0;
        return Math.max(0, av - currentTurn);
    }

    /**
     * ⭐ UNIQUE カードの消費登録 (冪等性保証)
     * 選択（配置・発動・Hold 格納）された瞬間に呼び出され、以後二度と Offering されない
     * @param {string} cardId 
     */
    consumeUnique(cardId) {
        if (!this.state || !cardId) return;
        this.init();
        if (!this.state.consumedUniqueCards.includes(cardId)) {
            this.state.consumedUniqueCards.push(cardId);
        }
    }

    /**
     * 🔍 カードが UNIQUE 消費済みか判定
     * @param {string} cardId 
     * @returns {boolean}
     */
    isUniqueConsumed(cardId) {
        if (!this.state || !Array.isArray(this.state.consumedUniqueCards)) return false;
        return this.state.consumedUniqueCards.includes(cardId);
    }

    /**
     * 🚑 候補不足フォールバック用: 候補群の中から availableTurn が最小のカードを抽出
     * @param {Array<Object>} candidates 
     * @returns {Object|null}
     */
    findMinAvailableTurnCard(candidates) {
        if (!Array.isArray(candidates) || candidates.length === 0) return null;
        let minCard = null;
        let minTurn = Infinity;

        for (const c of candidates) {
            const cId = c.id || c.cardMasterId;
            const av = (this.state && this.state.cardCooldowns) ? (this.state.cardCooldowns[cId] ?? 0) : 0;
            if (av < minTurn) {
                minTurn = av;
                minCard = c;
            }
        }
        return minCard;
    }
}
