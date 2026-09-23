import { I18n } from '../i18n.js';
import { LAND_SYSTEM_DATA } from '../data/land_system.js';
import { DIRECTIVES } from './directive_system.js';
import { LAND_CARDS_MASTER } from '../data/land_cards_data.js';
import { COMMAND_CARDS_MASTER } from '../data/command_cards_data.js';
import { ConditionEvaluator } from '../core/condition_evaluator.js';
import { CardCycleSystem, CYCLE_POLICIES } from './card_cycle_system.js';
import {
    hasMultiplePlacementTerrainAttributes,
    normalizePlacementAnchor
} from '../core/placement_geometry.js';
import { isMultiAttributeProductionResolved } from '../core/land_production_contract.js';
import { isTrueMergedCell } from '../core/merge_rules.js';
import { getWaterSourceSpawnChance } from '../core/lake_rules.js';
import { normalizeCardDefinitionV1, unwrapCardDefinition } from '../cards/card_definition_v1.js';
import { LandPlacementAvailabilityQuery } from '../cards/land_placement_availability_query.js';
import { CardOfferingEligibilityService } from '../cards/card_offering_eligibility_service.js';
import { pickWeightedCard } from '../cards/offering_weight_policy.js';
import { evaluateLegacyOfferingRequirements } from '../cards/legacy_offering_requirement_adapter.js';
import { resolveCardOfferingBoardQuery } from '../cards/card_offering_board_query.js';
import { resolveCardEffectHandlerRouter } from '../cards/card_effect_handler_router.js';
import { CardExecutionRequirementService } from '../cards/card_execution_requirement_service.js';

export const OFFERING_GENERATION_REASONS = Object.freeze({
    INITIAL: "INITIAL",
    VERSE_START: "VERSE_START",
    MULLIGAN: "MULLIGAN",
    UNSPECIFIED: "UNSPECIFIED"
});

const LAND_EXPLORATION_CHECK = {
    id: "land_exploration",
    dice: { count: 2, sides: 6, keep: "all" },
    resolution: { type: "sum" },
    outcomes: [
        { max: 4, id: "low" },
        { min: 5, max: 7, id: "medium" },
        { min: 8, id: "discovery" }
    ]
};

class DeckManager {
    constructor(gameState, engine = null) {
        this.state = gameState;
        this.engine = engine;
        this._landCardMasterCache = null;
        this.cycleSystem = new CardCycleSystem(this.state, this.engine);
        this.landPlacementAvailability = new LandPlacementAvailabilityQuery(this.state);
        this.cardOfferingBoardQuery = resolveCardOfferingBoardQuery(this.state, this.engine);
        this.cardEffectHandlerRouter = resolveCardEffectHandlerRouter(this.engine);
        this.executionRequirementService = new CardExecutionRequirementService({
            evaluator: (requirement, context) => {
                const evaluator = this.engine?.cardExecutionRequirementEvaluator;
                if (typeof evaluator === "function") return Boolean(evaluator(requirement, context));
                return Boolean(ConditionEvaluator.evaluate(requirement, { state: this.state, ...context }));
            }
        });
        this.offeringEligibility = new CardOfferingEligibilityService({
            state: this.state,
            placementQuery: this.landPlacementAvailability,
            executionTargetQuery: (definition, context) =>
                this.cardEffectHandlerRouter?.enumerateTargets(definition, {
                    ...context,
                    state: this.state,
                    engine: this.engine,
                    deckManager: this
                }) || [],
            requirementEvaluator: (requirement, context) => {
                const evaluator = this.engine?.cardOfferingRequirementEvaluator;
                if (typeof evaluator === "function") return Boolean(evaluator(requirement, context));
                const worldEvaluator = this.engine?.evaluateWorldEligibilityRequirement;
                if (typeof worldEvaluator === "function") return Boolean(worldEvaluator(requirement));
                return Boolean(ConditionEvaluator.evaluate(requirement, { state: this.state, ...context }));
            }
        });
    }

    _nextGameplayFloat() {
        return this.engine?.gameplayRandom?.nextFloat?.() ?? Math.random();
    }

    _nextGameplayInt(min, max) {
        return this.engine?.gameplayRandom?.nextInt?.(min, max)
            ?? min + Math.floor(Math.random() * (max - min + 1));
    }

    _nextGameplayId(prefix, scope) {
        return this.engine?.gameplayRandom?.nextId?.(prefix, scope)
            ?? `${prefix}_${scope}_${Date.now()}_${Math.random()}`;
    }

    /**
     * 🎴 マスターデータベース（静的キャッシュ ＆ 即時解決）の取得
     */
    getLandCardMaster() {
        if (this._landCardMasterCache && this._landCardMasterCache.length > 0) {
            return this._landCardMasterCache;
        }

        let baseList = [];
        if (Array.isArray(LAND_CARDS_MASTER) && LAND_CARDS_MASTER.length > 0) {
            baseList = LAND_CARDS_MASTER;
        } else {
            const globalData = (typeof globalThis !== 'undefined' && globalThis.LAND_CARDS_DATA) ? globalThis.LAND_CARDS_DATA : (typeof window !== 'undefined' ? window.LAND_CARDS_DATA : null);
            if (Array.isArray(globalData) && globalData.length > 0) {
                baseList = globalData;
            }
        }

        // 土地カードマスターに全コマンドカードをマージ（重複排除）
        const map = new Map();
        for (const c of baseList) {
            if (c && c.id) {
                const multiAttribute = hasMultiplePlacementTerrainAttributes(c);
                map.set(c.id, {
                    ...c,
                    ...(multiAttribute ? { rarity: "R" } : {}),
                    cyclePolicy: c.cyclePolicy || CYCLE_POLICIES.LAND_STANDARD
                });
            }
        }
        for (const c of COMMAND_CARDS_MASTER) {
            if (c && c.id) map.set(c.id, c);
        }
        this._landCardMasterCache = Array.from(map.values());
        return this._landCardMasterCache;
    }

    /**
     * 📥 指定カードが現在保留スロット（HOLD）に存在するか判定
     * @param {string} cardId 
     * @returns {boolean}
     */
    isInHold(cardId) {
        if (!this.state || !Array.isArray(this.state.reserveSlots)) return false;
        return this.state.reserveSlots.some(rc => {
            if (!rc || rc.isBlank) return false;
            const tObj = rc.terrain || rc;
            const mId = rc.cardMasterId || tObj.id || rc.id;
            return mId === cardId;
        });
    }

    /**
     * 🔍 カード抽選適格性判定 (Universal ＆ Card-specific 2層分離)
     * @param {Object} c - カード定義
     * @param {number} stageNum - 現在のステージ番号
     * @param {number} h2Count - 盤面の丘陵数
     * @param {Object} [options={}] - フォールバック等の一時制御フラグ
     * @param {boolean} [options.ignoreCooldown=false] - Cooldown除外を無視するか
     * @param {boolean} [options.ignoreHold=false] - Hold除外を無視するか
     */
    isCardEligible(c, stageNum, h2Count, options = {}) {
        if (!c) return false;
        const cardStage = c.minStage || 1;
        if (cardStage > stageNum) return false;

        // Multi-Attribute cards must not enter live Offering until their
        // Production contract is explicitly finalized.
        if (hasMultiplePlacementTerrainAttributes(c) && !isMultiAttributeProductionResolved(c)) {
            return false;
        }

        // Offering-only v1 boundary. LAND legality is queried from the existing
        // Placement Domain, and authored offering.requirements are evaluated
        // independently from execution requirements.
        const offeringGate = this.offeringEligibility?.evaluate(c, { stageNum, h2Count, options });
        if (offeringGate && !offeringGate.eligible) return false;

        const currentTurn = (this.state && this.state.turn) ? this.state.turn : 1;

        // 🌐 1. Universal Eligibility (共通ゲート)
        // 🔄 転生 Cooldown 判定 (availableTurn 未満なら除外)
        if (!options.ignoreCooldown && this.cycleSystem && this.cycleSystem.isInCooldown(c.id, currentTurn)) {
            return false;
        }

        // ⭐ UNIQUE カードの選択済み判定 (consumedUniqueCards に存在すれば永久除外)
        if (c.cyclePolicy === CYCLE_POLICIES.UNIQUE || c.cyclePolicy === "UNIQUE") {
            if (this.state && Array.isArray(this.state.consumedUniqueCards) && this.state.consumedUniqueCards.includes(c.id)) {
                return false;
            }
            if (this.state && Array.isArray(this.state.usedUniqueCards) && this.state.usedUniqueCards.includes(c.id)) {
                return false;
            }
        }

        // 📥 保留スロットにあるカードの重複除外
        if (!options.ignoreHold && this.isInHold(c.id)) {
            return false;
        }

        // 🌐 2. Card-specific Eligibility (カード固有ゲート)
        // 🚫 確定ルール: 発動しているバフと同じカードはオファリングされない
        if (this.state) {
            const allBuffs = (typeof this.state.getAllBuffs === "function")
                ? this.state.getAllBuffs()
                : (this.state.activeBuffs || []);
            const isBuffActive = allBuffs.some(b => b && (b.id === c.id || b.sourceCardId === c.id));
            if (isBuffActive) return false;

            // 建設中プロジェクト（大風車など）の重複提示も遮断
            if (this.state.activeConstructionProjects && this.state.activeConstructionProjects.some(p => p.name === c.id)) {
                return false;
            }

            // バイアスカードの重複提示も遮断
            if (c.biasTarget || c.id === "CMD_LAND_FOCUS" || c.id === "CMD_MILITARY_FOCUS" || c.id === "CMD_MYSTIC_FOCUS") {
                if (this.state.activeDrawBias || this.state.drawBias) {
                    return false;
                }
            }
        }

        const legacyRequirementGate = evaluateLegacyOfferingRequirements(
            c,
            { state: this.state, h2Count, boardQuery: this.cardOfferingBoardQuery },
            ConditionEvaluator
        );
        if (!legacyRequirementGate.eligible) return false;

        return true;
    }

    /**
     * 🃏 カードインスタンス構造体の生成ヘルパー
     * @private
     */
    _wrapCardInstance(picked) {
        if (!picked) return null;
        return {
            id: this._nextGameplayId("card", this.state?.turn || 1),
            cardMasterId: picked.id,
            nameKey: picked.nameKey,
            terrain: picked,
            currentShape: picked.shape || [[1]],
            currentAnchor: normalizePlacementAnchor(picked.anchor, picked.shape || [[1]])
        };
    }

    /**
     * 🎲 単一カードの重み付け抽選
     * @param {Array<string>} [excludedCardIds=[]] - 同一オファリング内・保留枠で重複排除するカードIDリスト
     * @param {Object} [options={}] - フォールバック等の一時制御フラグ
     */
    drawSingleCard(excludedCardIds = [], options = {}) {
        const master = this.getLandCardMaster();
        const stageNum = (this.state && this.state.stage) ? (typeof this.state.stage === 'object' ? (this.state.stage.id || 1) : this.state.stage) : 1;
        const h2Count = (this.state && typeof this.state.countE2HillsOnBoard === 'function') ? this.state.countE2HillsOnBoard() : 0;

        let eligible = master.filter(c => this.isCardEligible(c, stageNum, h2Count, options));
        if (typeof options.candidateFilter === "function") {
            eligible = eligible.filter(c => options.candidateFilter(c));
        }

        // 🛡️ 同一オファリング内における完全同一カードの重複排除
        if (Array.isArray(excludedCardIds) && excludedCardIds.length > 0) {
            eligible = eligible.filter(c => !excludedCardIds.includes(c.id));
        }

        if (eligible.length === 0) {
            return null; // 制約緩和フォールバックへ委ねる
        }

        const chosen = pickWeightedCard(eligible, this.state, () => this._nextGameplayFloat());
        const picked = chosen || eligible[0] || master[0];
        return this._wrapCardInstance(picked);
    }

    _cardDefinition(card) {
        return unwrapCardDefinition(card);
    }

    getCardDefinitionV1(card) {
        return normalizeCardDefinitionV1(this._cardDefinition(card));
    }

    _cardId(card) {
        const definition = this._cardDefinition(card);
        return card?.cardMasterId || definition?.id || card?.id || null;
    }

    _isCardPlaceableNow(card) {
        const definition = this._cardDefinition(card);
        return this.landPlacementAvailability?.hasAnyLegalPlacement(definition) === true;
    }

    _matchesMinimumRequirement(card, requirement) {
        const definition = this._cardDefinition(card);
        if (!definition || !requirement || typeof requirement !== "object") return false;
        if (requirement.category && definition.category !== requirement.category) return false;
        if (requirement.requirePlaceable === true && !this._isCardPlaceableNow(definition)) return false;
        return true;
    }

    _resolveMinimumRequirements(reason) {
        const provider = this.engine?.offeringMinimumRequirementProvider;
        if (!provider) return [];

        const context = Object.freeze({ reason, state: this.state, deckManager: this });
        const requirements = typeof provider === "function"
            ? provider(context)
            : provider.getMinimumRequirements?.(context);
        return Array.isArray(requirements)
            ? requirements.filter(requirement => requirement && (requirement.minCount ?? 1) > 0)
            : [];
    }

    _enforceMinimumRequirements(cards, excludedCardIds, requirements) {
        if (!Array.isArray(cards) || cards.length === 0 || !Array.isArray(requirements) || requirements.length === 0) return [];

        const applied = [];
        for (const requirement of requirements) {
            const minCount = Math.max(1, Math.trunc(requirement.minCount ?? 1));
            let matchingCount = cards.filter(card => this._matchesMinimumRequirement(card, requirement)).length;

            while (matchingCount < minCount) {
                const candidate = this.drawSingleCard(excludedCardIds, {
                    candidateFilter: card => this._matchesMinimumRequirement(card, requirement)
                });
                if (!candidate) break;

                const replaceIndex = cards.findIndex(card => !this._matchesMinimumRequirement(card, requirement));
                if (replaceIndex < 0) break;

                const replacedId = this._cardId(cards[replaceIndex]);
                const candidateId = this._cardId(candidate);
                cards[replaceIndex] = candidate;

                if (replacedId) {
                    const excludedIndex = excludedCardIds.indexOf(replacedId);
                    if (excludedIndex >= 0) excludedCardIds.splice(excludedIndex, 1);
                }
                if (candidateId && !excludedCardIds.includes(candidateId)) excludedCardIds.push(candidateId);

                matchingCount += 1;
                applied.push(Object.freeze({
                    id: requirement.id || null,
                    category: requirement.category || null,
                    candidateId,
                    replacedId
                }));
            }
        }
        return applied;
    }

    /**
     * 🃏 手札オファリングの生成 (3段階制約緩和フォールバック ＆ 確定3枚の転生CD登録)
     *
     * A minimum-requirement provider declares intent only. DeckManager still
     * owns eligibility, weighted candidate selection, cooldown/hold gates and
     * any replacement needed to satisfy the minimum.
     */
    generateOfferingCards({ reason = OFFERING_GENERATION_REASONS.UNSPECIFIED } = {}) {
        if (this.state) {
            this.state.hasReservedThisTurn = false;
            if (this.state.reserveSlots) {
                this.state.reserveSlots.forEach(rc => {
                    if (rc) delete rc.reservedThisTurn;
                });
            }
        }
        const offeringSize = (this.state && this.state.handOfferingSize) ? this.state.handOfferingSize : 3;
        const currentTurn = (this.state && this.state.turn) ? this.state.turn : 1;
        const master = this.getLandCardMaster();
        const stageNum = (this.state && this.state.stage) ? (typeof this.state.stage === 'object' ? (this.state.stage.id || 1) : this.state.stage) : 1;
        const h2Count = (this.state && typeof this.state.countE2HillsOnBoard === 'function') ? this.state.countE2HillsOnBoard() : 0;

        const newCards = [];
        const excludedCardIds = [];

        // 📥 保留スロットにあるカードを手札重複から除外
        if (this.state && this.state.reserveSlots) {
            this.state.reserveSlots.forEach(rc => {
                if (rc && !rc.isBlank) {
                    const tObj = rc.terrain || rc;
                    const mId = rc.cardMasterId || tObj.id || rc.id;
                    if (mId) excludedCardIds.push(mId);
                }
            });
        }

        // 段階 1: 通常抽選 (Universal ＆ Card-specific 適合 ＆ 非CD ＆ 非Hold)
        for (let i = 0; i < offeringSize; i++) {
            const drawn = this.drawSingleCard(excludedCardIds);
            if (drawn) {
                newCards.push(drawn);
                const cId = drawn.cardMasterId || (drawn.terrain ? drawn.terrain.id : null);
                if (cId) excludedCardIds.push(cId);
            }
        }

        // 段階 2 フォールバック: 不足時、Cooldown 中の適格カードから availableTurn 最小のものを一時解禁
        if (newCards.length < offeringSize && this.cycleSystem) {
            const cdCandidates = master.filter(c => {
                if (excludedCardIds.includes(c.id)) return false;
                return this.isCardEligible(c, stageNum, h2Count, { ignoreCooldown: true });
            });

            while (newCards.length < offeringSize && cdCandidates.length > 0) {
                const minCard = this.cycleSystem.findMinAvailableTurnCard(cdCandidates);
                if (!minCard) break;
                const drawn = this._wrapCardInstance(minCard);
                newCards.push(drawn);
                excludedCardIds.push(minCard.id);
                const idx = cdCandidates.indexOf(minCard);
                if (idx !== -1) cdCandidates.splice(idx, 1);
            }
        }

        // 段階 3 フォールバック: それでも不足時、Stage適格な既存基本土地プールから CD無視で補充
        if (newCards.length < offeringSize) {
            const baseLandPool = master.filter(c => {
                if (excludedCardIds.includes(c.id)) return false;
                const policy = c.cyclePolicy || (c.category === "LAND" ? CYCLE_POLICIES.LAND_STANDARD : CYCLE_POLICIES.RARITY);
                if (policy !== CYCLE_POLICIES.LAND_STANDARD && c.category !== "LAND") return false;

                // Fallback may relax cooldown only. It must never bypass
                // Offering legality, authored requirements, Hold/Unique gates,
                // or the "LAND has at least one legal placement" invariant.
                return this.isCardEligible(c, stageNum, h2Count, { ignoreCooldown: true });
            });

            while (newCards.length < offeringSize && baseLandPool.length > 0) {
                const picked = pickWeightedCard(baseLandPool, this.state, () => this._nextGameplayFloat())
                    || baseLandPool[0];

                const drawn = this._wrapCardInstance(picked);
                newCards.push(drawn);
                excludedCardIds.push(picked.id);
                const pickedIndex = baseLandPool.indexOf(picked);
                if (pickedIndex >= 0) baseLandPool.splice(pickedIndex, 1);
            }
        }

        if (newCards.length < offeringSize) {
            console.warn(`[DeckManager] Critical: Offering cards insufficient (${newCards.length}/${offeringSize})`);
        }

        const minimumRequirements = this._resolveMinimumRequirements(reason);
        const appliedMinimumRequirements = this._enforceMinimumRequirements(newCards, excludedCardIds, minimumRequirements);
        this.lastOfferingGeneration = Object.freeze({
            reason,
            requestedMinimums: minimumRequirements.length,
            appliedMinimums: appliedMinimumRequirements
        });

        // ⭐ 確定した手札 3 枚に対して転生 Cooldown を登録 (フォールバックで救済されたカードもここで新CD再登録)
        if (this.cycleSystem) {
            this.cycleSystem.registerOffering(newCards, currentTurn);
        }

        if (this.state) {
            this.state.handOffering = newCards;
            this.state.offeringCards = newCards;
        }
        return newCards;
    }

    /**
     * 🎲 1ターン1回マリガン実行 (🔥-1, 連続使用遮断)
     */
    mulligan() {
        if (!this.state) return { success: false, reason: "NO_STATE" };
        if (this.state.hasPickedThisTurn) return { success: false, reason: "ALREADY_PICKED_THIS_TURN" };
        if (this.state.hasMulliganedThisTurn) return { success: false, reason: "ALREADY_MULLIGANED_THIS_TURN" };
        if (this.state.ember < 1) return { success: false, reason: "INSUFFICIENT_EMBER" };

        if (this.state.emberSystem && typeof this.state.emberSystem.consume === 'function') {
            this.state.emberSystem.consume(1);
        } else {
            this.state.ember -= 1;
        }
        this.state.hasMulliganedThisTurn = true;
        this.generateOfferingCards({ reason: OFFERING_GENERATION_REASONS.MULLIGAN });

        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' && window.I18n ? window.I18n : { t: k => k });
        if (typeof this.state.addLog === 'function') {
            this.state.addLog(I18n.t("LOG_MULLIGAN_EXECUTED") || "🎲 マリガン実行: 🔥 -1 を消費して手札を再抽選しました。");
        }

        return { success: true };
    }

    /**
     * ⭐ カード選択・採用時の共通フック (UNIQUE 消費の一元管理・冪等性保証)
     * @param {Object} card 
     */
    consumeCardIfUnique(card) {
        if (!card) return;
        const tObj = card.terrain || card;
        const policy = tObj.cyclePolicy || (tObj.isUnique ? "UNIQUE" : null);
        if (policy === "UNIQUE" || policy === CYCLE_POLICIES.UNIQUE) {
            const cardId = card.cardMasterId || tObj.id || card.id;
            if (this.cycleSystem && cardId) {
                this.cycleSystem.consumeUnique(cardId);
            }
            if (this.state && Array.isArray(this.state.consumedUniqueCards) && cardId) {
                if (!this.state.consumedUniqueCards.includes(cardId)) {
                    this.state.consumedUniqueCards.push(cardId);
                }
            }
            // 後方互換用
            if (this.state && Array.isArray(this.state.usedUniqueCards) && cardId) {
                if (!this.state.usedUniqueCards.includes(cardId)) {
                    this.state.usedUniqueCards.push(cardId);
                }
            }
        }
    }

    /**
     * 📥 手札 ➔ 保留スロットへの移動 (最大3枠)
     */
    moveToReserve(cardIdx) {
        if (!this.state || !this.state.handOffering || !this.state.reserveSlots) return false;
        if (this.state.hasReservedThisTurn) return false; // 1ターン1回制限
        const card = this.state.handOffering[cardIdx];
        if (!card || card.isBlank) return false;

        const emptyIdx = this.state.reserveSlots.findIndex(slot => slot === null);
        if (emptyIdx === -1) return false;

        // ⭐ 選択時消費: UNIQUE カードなら consumedUniqueCards へ登録
        this.consumeCardIfUnique(card);

        card.originalHandIdx = cardIdx;
        card.reservedThisTurn = true; // 今ターン預け入れフラグ
        this.state.reserveSlots[emptyIdx] = card;
        this.state.hasReservedThisTurn = true; // 1ターン1回消費フラグ

        // 手札の抜け部分はカード裏表示 (isBlank: true)
        this.state.handOffering[cardIdx] = {
            isBlank: true,
            originalCard: card,
            id: `blank_${cardIdx}`
        };

        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' && window.I18n ? window.I18n : { t: k => k });
        const cName = card.terrain ? I18n.t(card.terrain.nameKey) : "土地カード";
        if (typeof this.state.addLog === 'function') {
            this.state.addLog(I18n.t("LOG_RESERVE_ADDED", { name: cName, slot: emptyIdx + 1 }) || `📥 保留登録: ${cName} を保留スロット ${emptyIdx + 1} へ移動。`);
        }
        return true;
    }

    /**
     * 📤 保留スロット ➔ 手札への復元
     */
    returnFromReserve(reserveIdx, specificTargetIdx = -1) {
        if (!this.state || !this.state.handOffering || !this.state.reserveSlots) return false;
        const card = this.state.reserveSlots[reserveIdx];
        if (!card) return false;

        // 手札に空きスロット (isBlank: true) が存在するか走査
        let targetIdx = -1;
        if (typeof specificTargetIdx === "number" && specificTargetIdx >= 0 && specificTargetIdx < this.state.handOffering.length && this.state.handOffering[specificTargetIdx] && this.state.handOffering[specificTargetIdx].isBlank) {
            targetIdx = specificTargetIdx;
        } else {
            const origIdx = card.originalHandIdx;
            if (origIdx !== undefined && this.state.handOffering[origIdx] && this.state.handOffering[origIdx].isBlank) {
                targetIdx = origIdx;
            } else {
                targetIdx = this.state.handOffering.findIndex(c => c && c.isBlank);
            }
        }

        if (targetIdx !== -1) {
            this.state.handOffering[targetIdx] = card;
            delete card.originalHandIdx;
            this.state.reserveSlots[reserveIdx] = null;

            const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' && window.I18n ? window.I18n : { t: k => k });
            const cName = card.terrain ? I18n.t(card.terrain.nameKey) : "土地カード";
            if (typeof this.state.addLog === 'function') {
                this.state.addLog(I18n.t("LOG_RESERVE_RETURNED", { name: cName }) || `↩ [保留復元] ${cName} を手札に戻しました。`);
            }
            return true;
        }

        // 手札が満杯の場合は何もしない（カード消失防止）
        return false;
    }

    /**
     * 🗑️ 保留スロットのカードを破棄 (ディスカード)
     */
    discardFromReserve(reserveIdx = 0) {
        if (!this.state || !this.state.reserveSlots) return false;
        const card = this.state.reserveSlots[reserveIdx];
        if (!card) return false;
        if (card.reservedThisTurn) return false; // 今ターン預け入れたカードは即破棄不可 (手札へ戻すこと)

        this.state.reserveSlots[reserveIdx] = null;

        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' && window.I18n ? window.I18n : { t: k => k });
        const tObj = card.terrain || card;
        const cName = tObj.nameKey ? I18n.t(tObj.nameKey) : (tObj.name || tObj.id || "Card");
        if (typeof this.state.addLog === 'function') {
            this.state.addLog(I18n.t("LOG_RESERVE_DISCARDED", { name: cName }) || `🗑️ [保留破棄] ${cName} を破棄しました。`);
        }
        return true;
    }

    cardRequiresExecutionTarget(cardObj) {
        if (!cardObj || cardObj.category === "LAND") return false;
        const definitionV1 = normalizeCardDefinitionV1(cardObj);
        return this.cardEffectHandlerRouter?.requiresTarget(definitionV1) === true;
    }

    enumerateCardExecutionTargets(cardObj) {
        if (!cardObj || cardObj.category === "LAND") return [];
        const definitionV1 = normalizeCardDefinitionV1(cardObj);
        return this.cardEffectHandlerRouter?.enumerateTargets(definitionV1, {
            state: this.state,
            engine: this.engine,
            deckManager: this
        }) || [];
    }

    /**
     * 📜 コマンドカードの発動処理
     */
    playCommandCard(cardObj, targetTile = null, handIdx = -1, reserveIdx = -1) {
        if (!this.state || !cardObj || cardObj.category === "LAND") return { success: false, reason: "NOT_A_COMMAND_CARD" };

        const definitionV1 = normalizeCardDefinitionV1(cardObj);
        const executionGate = this.executionRequirementService.evaluate(definitionV1, {
            state: this.state,
            engine: this.engine,
            deckManager: this,
            targetTile,
            handIdx,
            reserveIdx
        });
        if (!executionGate.canExecute) {
            return {
                success: false,
                reason: executionGate.failures[0] || "EXECUTION_REQUIREMENT_FAILED",
                failures: executionGate.failures
            };
        }

        const effectPreflight = this.cardEffectHandlerRouter?.preflight(cardObj, {
            state: this.state,
            engine: this.engine,
            deckManager: this,
            targetTile,
            handIdx,
            reserveIdx
        });
        if (effectPreflight?.handled && effectPreflight.success === false) {
            return {
                success: false,
                reason: effectPreflight.reason || "CARD_EFFECT_PREFLIGHT_FAILED"
            };
        }

        const cId = cardObj.id;
        const checkSystem = cId === "CMD_ABANDONED_SETTLEMENT"
            ? (this.engine?.checkSystem || this.state?.checkSystem)
            : null;
        if (cId === "CMD_ABANDONED_SETTLEMENT" && (!checkSystem || typeof checkSystem.resolve !== "function")) {
            return { success: false, reason: "CHECK_SYSTEM_UNAVAILABLE" };
        }

        const cost = cardObj.cost || {};
        const matCost = cost.material !== undefined ? cost.material : (cost.wood || 0);
        const curMat = Math.max(this.state.material !== undefined ? this.state.material : 0, this.state.wood !== undefined ? this.state.wood : 0);

        if (cost.food && this.state.food < cost.food) return { success: false, reason: "NOT_ENOUGH_FOOD" };
        if (matCost > 0 && curMat < matCost) return { success: false, reason: "NOT_ENOUGH_MATERIAL" };
        if (cost.mystic && this.state.mystic < cost.mystic) return { success: false, reason: "NOT_ENOUGH_MYSTIC" };
        if (cost.ember && this.state.ember < cost.ember) return { success: false, reason: "NOT_ENOUGH_EMBER" };

        if (cost.food) this.state.food -= cost.food;
        if (matCost > 0) {
            this.state.wood = Math.max(0, (this.state.wood || 0) - matCost);
            this.state.material = this.state.wood;
        }
        if (cost.mystic) this.state.mystic -= cost.mystic;
        if (cost.ember) this.state.ember -= cost.ember;

        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
        const cName = I18n.t(cardObj.nameKey) || I18n.t(`${cardObj.id}_NAME`) || I18n.t(cardObj.id) || cardObj.id;
        const cDesc = I18n.t(`${cardObj.id}_DESC`) || "";

        // 🎴 発動スロットの消費（手札の場合は空きスロット化、保留の場合は空スロット化）
        if (handIdx >= 0 && this.state.handOffering && this.state.handOffering[handIdx]) {
            this.state.handOffering[handIdx] = { isBlank: true, originalCard: cardObj, id: this._nextGameplayId("blank", `${this.state.turn || 1}_${handIdx}`) };
            this.state.hasPickedThisTurn = true;
        } else if (reserveIdx >= 0 && this.state.reserveSlots) {
            this.state.reserveSlots[reserveIdx] = null;
            this.state.hasPickedThisTurn = true;
        }

        // ⭐ 選択時消費: UNIQUE カードなら consumedUniqueCards へ登録
        this.consumeCardIfUnique(cardObj);

        // Card Effect Handler v1 boundary.
        // No legacy effect is registered by default. Registered effects may
        // migrate one-by-one; every unregistered card falls through to the
        // existing if/else implementation unchanged.
        const routedEffect = this.cardEffectHandlerRouter?.execute(cardObj, {
            state: this.state,
            engine: this.engine,
            deckManager: this,
            targetTile,
            handIdx,
            reserveIdx,
            i18n: I18n,
            cardName: cName,
            cardDescription: cDesc
        });
        if (routedEffect?.handled) {
            if (routedEffect.success === false) return routedEffect;

            if (cardObj.isUnique) {
                if (!this.state.usedUniqueCards) this.state.usedUniqueCards = [];
                this.state.usedUniqueCards.push(cId);
            }
            this.state.hasPickedThisTurn = true;
            return { ...routedEffect, success: true };
        }

        if (cId === "CMD_AGRICULTURAL_POLICY") {
            // 🌾 農地改革: コスト 🧱-20
            this.state.permanentPlainsFoodBonus = (this.state.permanentPlainsFoodBonus || 0) + 1;
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `📜【${cName}】`);
        } else if (cId === "CMD_BLACK_MARKET") {
            // 💰 闇市場の一括売却: コスト 🌾-25
            this.state.wood += 35;
            this.state.mystic += 10;
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `📜【${cName}】`);
        } else if (cId === "CMD_IRON_RAMPART") {
            // 🛡️ 鉄壁の防壁構築: コスト 🧱-20
            if (this.state.defenseSystem) {
                this.state.defenseSystem.increaseMaxCapacity(25);
            } else {
                this.state.defense += 25;
            }
            this.state.permanentVicinityDefenseBonus = (this.state.permanentVicinityDefenseBonus || 0) + 2;
            if (this.state.defenseSystem) this.state.defenseSystem.reconcileWithMax();
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🛡️【${cName}】`);
        } else if (cId === "CMD_BALLISTA_SET") {
            // 🏹 迎撃用弩砲陣地: コスト 🧱-30
            if (this.state.defenseSystem) {
                this.state.defenseSystem.increaseMaxCapacity(40);
            } else {
                this.state.defense += 40;
            }
            this.state.nextTrialDamageMitigation = 0.5;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "🏹",
                description: cDesc,
                badgeText: I18n ? I18n.t("UI_DEFENSE_TRIAL_TAG") : "試練対策",
                category: "CARD_EFFECT"
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🏹【${cName}】`);
        } else if (cId === "CMD_TRANSMUTE_GOLDEN") {
            // 💎 黄金秘境への変容: コスト ✨-20
            if (targetTile && targetTile.r !== undefined && targetTile.c !== undefined && this.state.grid) {
                const cell = this.state.grid[targetTile.r][targetTile.c];
                cell.socketResource = { nameKey: "SOCKET_SACRED_VEIN", bonusMystic: 5, bonusEmber: 1 };
                this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `💎【${cName}】`);
            } else {
                this.state.mystic += 10;
                this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `💎【${cName}】`);
            }
        } else if (cId === "FAC_GREAT_WINDMILL") {
            // 🏛️ 大風車工房の建設: コスト 🧱-15
            if (!this.state.activeConstructionProjects) this.state.activeConstructionProjects = [];
            this.state.activeConstructionProjects.push({ name: "FAC_GREAT_WINDMILL", remainingTurns: 3, woodCostPerTurn: 4 });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🏛️【${cName}】`);
        } else if (cId === "LGD_DESPERATE_PACT") {
            // 📜 背水の盟約: コスト なし
            this.state.ember = this.state.ember + 5;
            this.state.handOfferingSize = 4;
            this.state.nextTrialMultiplier = 1.5;
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🔥【${cName}】`);
        } else if (cId === "CMD_LAND_FOCUS") {
            // 📜 土地探索重視: コスト 🌾-10 🧱-10
            this.state.activeDrawBias = { targetCategory: "LAND", type: "UNTIL_BLOCKS", untilValue: 6 };
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "📜",
                description: cDesc,
                category: "CARD_EFFECT"
            });
            if (typeof this.state.checkConditionalBuffs === "function") this.state.checkConditionalBuffs();
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `📜【${cName}】`);
        } else if (cId === "CMD_CONSERVE_EMBER") {
            // 🔥 節約: コスト 無料 (次ターンの🔥消費-1軽減)
            this.state.emberConsumptionReducedTurns = 1;
            this.state.emberConsumptionStartsNextTurn = true;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "🔥",
                description: cDesc,
                badgeText: I18n ? I18n.t("BUFF_REMAINING_TURNS", { count: 1 }) : "1T",
                category: "CARD_EFFECT",
                remainingTurns: 1,
                startsNextTurn: true
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🔥【${cName}】`);
        } else if (cId === "CMD_GRAND_CULTIVATION") {
            // 🌾 耕作計画: コスト 🧱-35 (次のターンから4ターンの間、平地の産出 🌾+1/T)
            this.state.grandCultivationTurns = 4;
            this.state.grandCultivationStartsNextTurn = true;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "🌾",
                description: cDesc,
                badgeText: I18n ? I18n.t("BUFF_REMAINING_TURNS", { count: 4 }) : "4T",
                category: "CARD_EFFECT",
                remainingTurns: 4,
                startsNextTurn: true
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🌾【${cName}】`);
        } else if (cId === "CMD_SCORCHED_RETREAT") {
            // 🔥 焦土退却: コスト 🌾-20 (試練後3ターン土地産出 -1/T)
            this.state.scorchedRetreatTurns = 3;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "🔥",
                description: cDesc,
                badgeText: I18n ? I18n.t("BUFF_REMAINING_TURNS", { count: 3 }) : "3T",
                category: "DEBUFF",
                remainingTurns: 3
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🔥【${cName}】`);
        } else if (cId === "CMD_RESETTLEMENT") {
            // 👥 人口移住令: コスト 🌾-15 🧱-10 (平地2x2マージ指定 🔥+2 ＆ 🌾+2/T永続)
            this.state.ember = Math.min(30, (this.state.ember || 20) + 2);
            this.state.resettlementFoodBonus = (this.state.resettlementFoodBonus || 0) + 2;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "👥",
                description: cDesc,
                category: "PERMANENT"
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `👥【${cName}】`);
        } else if (cId === "CMD_GREAT_RAMPART_PROJECT") {
            // 🏯 特別プロジェクト：大防塁 (4T継続投資 🧱-45/T ＆ 試練進軍効率大幅低下)
            this.state.greatRampartTurns = 4;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "🏯",
                description: cDesc,
                badgeText: I18n ? I18n.t("BUFF_REMAINING_TURNS", { count: 4 }) : "4T",
                category: "PROJECT",
                remainingTurns: 4
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🏯【${cName}】`);
        } else if (cId === "CMD_OUTPOST") {
            // 🗼 前哨塔: コスト 🧱-25 (試練侵攻情報を3T早く取得)
            this.state.hasOutpost = true;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "🗼",
                description: cDesc,
                category: "PERMANENT"
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🗼【${cName}】`);
        } else if (cId === "CMD_GUIDED_DEFENSE") {
            // 🚧 誘導防衛: コスト 🧱-20 (試練時敵移動コスト+1)
            this.state.guidedDefenseActive = true;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "🚧",
                description: cDesc,
                category: "TACTICAL"
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🚧【${cName}】`);
        } else if (cId === "CMD_HIGH_GROUND_FORMATION") {
            // ⛰️ 高地布陣: コスト 🧱-10 (試練時高地戦術補正強化)
            this.state.highGroundFormationActive = true;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "⛰️",
                description: cDesc,
                category: "TACTICAL"
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `⛰️【${cName}】`);
        } else if (cId === "CMD_CAVALRY_HOST") {
            // 🐎 騎馬軍編成: コスト 🌾-30 🧱-20 (試練時平地機動補正)
            this.state.cavalryHostActive = true;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "🐎",
                description: cDesc,
                category: "TACTICAL"
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🐎【${cName}】`);
        } else if (cId === "CMD_PASTORAL_EXPANSION") {
            // 🐑 放牧地の拡大: コスト 🧱-10 (次回同属性接続ボーナス強化)
            this.state.pastoralExpansionActive = true;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "🐑",
                description: cDesc,
                category: "CARD_EFFECT"
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🐑【${cName}】`);
        } else if (cId === "CMD_LIME_CONSTRUCTION") {
            // 🧱 石灰焼成: コスト 🌾-10 (次回高コスト建築軽減)
            this.state.limeConstructionActive = true;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "🧱",
                description: cDesc,
                category: "CARD_EFFECT"
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🧱【${cName}】`);
        } else if (cId === "CMD_CAVALRY_SCOUTS") {
            // 🐎 騎馬斥候隊: コスト 🌾-10 (試練時平地迎撃/増援コスト軽減)
            this.state.cavalryScoutsActive = true;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "🐎",
                description: cDesc,
                category: "TACTICAL"
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🐎【${cName}】`);
        } else if (cId === "CMD_LOCAL_IRON_ARMAMENT") {
            // ⚔️ 在地鉄器武装: コスト 🧱-15 (赤鉄鉱丘陵の迎撃高地補正強化)
            this.state.localIronArmamentActive = true;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "⚔️",
                description: cDesc,
                category: "TACTICAL"
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `⚔️【${cName}】`);
        } else if (cId === "CMD_STONE_STRONGPOINT") {
            // 🏰 石造陣地: コスト 🧱-20 (石材地形の初期地形減衰強化)
            this.state.stoneStrongpointActive = true;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "🏰",
                description: cDesc,
                category: "TACTICAL"
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🏰【${cName}】`);
        } else if (cId === "CMD_SINGLE_CLEARING") {
            // 🪓 伐採: コスト 🔥-1 (森1マス伐採・平地化、🧱+20, 🌾+3)
            let cleared = false;
            if (this.state.grid) {
                for (let r = 0; r < this.state.grid.length && !cleared; r++) {
                    for (let c = 0; c < this.state.grid[r].length && !cleared; c++) {
                        const cell = this.state.grid[r][c];
                        if (cell && cell.placed && !cell.isHQ && cell.terrain) {
                            const tid = cell.terrain.terrainId || cell.terrain.id || "";
                            if (tid.includes("FOREST") && !isTrueMergedCell(this.state, cell)) {
                                cell.terrain = { id: "GL1_PLAINS", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", gl: 1, e: 1, food: 4, wood: 0, defense: 0, mystic: 0, category: "BASE" };
                                cleared = true;
                            }
                        }
                    }
                }
            }
            this.state.wood = (this.state.wood || 0) + 20;
            this.state.food = (this.state.food || 0) + 3;
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "🪓", description: cDesc, category: "CARD_EFFECT" });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🪓【${cName}】`);
        } else if (cId === "CMD_WETLAND_RECLAMATION") {
            // 🌾 干拓: コスト 🧱-15, 🔥-1 (湖以外の湿原1マスを干拓地へ永久転換)
            let reclaimed = false;
            let reclaimedCoord = null;
            if (this.state.grid) {
                for (let r = 0; r < this.state.grid.length && !reclaimed; r++) {
                    for (let c = 0; c < this.state.grid[r].length && !reclaimed; c++) {
                        const cell = this.state.grid[r][c];
                        if (cell && cell.placed && !cell.isHQ && cell.terrain) {
                            const tid = cell.terrain.terrainId || cell.terrain.id || "";
                            const isLakeCell = cell.socketResource && (cell.socketResource.id === "SOCKET_LAKE" || cell.socketResource.isLake);
                            if (tid.includes("WETLAND") && !isTrueMergedCell(this.state, cell) && !isLakeCell) {
                                cell.terrain = {
                                    id: "E1_RECLAIMED_LAND",
                                    terrainId: "E1_RECLAIMED_LAND",
                                    nameKey: "TERRAIN_RECLAIMED_LAND",
                                    gl: 1,
                                    e: 1,
                                    food: 4,
                                    wood: 1,
                                    material: 1,
                                    defense: 0,
                                    mystic: 0,
                                    category: "BASE",
                                    zoneCategory: "PLAINS",
                                    trialTerrainCategory: "STANDARD_E1",
                                    isSpecialBlock: true,
                                    isArtificialTerrain: true
                                };
                                reclaimed = true;
                                reclaimedCoord = { r, c };
                            }
                        }
                    }
                }
            }
            const gridEngine = this.engine?.gridEngine || this.state?.gridEngine;
            if (reclaimedCoord && gridEngine && typeof gridEngine.checkMergePatterns === "function") {
                const mergeResult = gridEngine.checkMergePatterns([reclaimedCoord]);
                if (mergeResult?.merge2x2 && typeof gridEngine.checkNewMergeLinks === "function") {
                    gridEngine.checkNewMergeLinks();
                }
            }
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "🌾", description: cDesc, category: "CARD_EFFECT" });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🌾【${cName}】`);
        } else if (cId === "CMD_SYSTEMATIC_LOGGING") {
            // 🌲 計画伐採: コスト 🌾-10 (森林マス数×🧱+6、3T森産出🧱-1/T)
            let forestCount = 0;
            if (this.state.grid) {
                for (let r = 0; r < this.state.grid.length; r++) {
                    for (let c = 0; c < this.state.grid[r].length; c++) {
                        const cell = this.state.grid[r][c];
                        if (cell && cell.placed && cell.terrain) {
                            const tid = cell.terrain.terrainId || cell.terrain.id || "";
                            if (tid.includes("FOREST")) forestCount++;
                        }
                    }
                }
            }
            this.state.wood = (this.state.wood || 0) + (forestCount * 6);
            this.state.systematicLoggingTurns = 3;
            this.state.systematicLoggingStartsNextTurn = true;
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "🌲", description: cDesc, badgeText: I18n ? I18n.t("BUFF_REMAINING_TURNS", { count: 3 }) : "3T", category: "DEBUFF", remainingTurns: 3, startsNextTurn: true });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🌲【${cName}】`);
        } else if (cId === "CMD_PASTORAL_FARM") {
            // 🐄 牧畜場: コスト 🧱-15 (平地を牧畜場化、🌾産出追加)
            this.state.food = (this.state.food || 0) + 2;
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "🐄", description: cDesc, category: "CARD_EFFECT" });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🐄【${cName}】`);
        } else if (cId === "CMD_SAWMILL") {
            // 🪚 製材所: コスト 🧱-25 (伐採拠点を改良、🧱産出x1.5)
            this.state.sawmillCount = (this.state.sawmillCount || 0) + 1;
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "🪚", description: cDesc, category: "CARD_EFFECT" });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🪚【${cName}】`);
        } else if (cId === "CMD_QUARRY") {
            // 🪨 採石場: コスト 🧱-20 (即時 🧱+10、周囲丘陵/山岳から🧱産出)
            this.state.wood = (this.state.wood || 0) + 10;
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "🪨", description: cDesc, category: "CARD_EFFECT" });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🪨【${cName}】`);
        } else if (cId === "CMD_MINE") {
            // ⛏️ 鉱山: コスト 🧱-25 (鉱物ソケット産出 x1.5)
            this.state.mineCount = (this.state.mineCount || 0) + 1;
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "⛏️", description: cDesc, category: "CARD_EFFECT" });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `⛏️【${cName}】`);
        } else if (cId === "CMD_STABLE") {
            // 🐎 厩舎: コスト 🧱-20 (騎馬カード提示率上昇、🧱コスト-5)
            this.state.stableCount = (this.state.stableCount || 0) + 1;
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "🐎", description: cDesc, category: "CARD_EFFECT" });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🐎【${cName}】`);
        } else if (cId === "CMD_LIME_KILN") {
            // 🧱 石灰窯: コスト 🌾-10 🧱-15 (建設カード🧱コスト-20%)
            this.state.limeKilnCount = (this.state.limeKilnCount || 0) + 1;
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "🧱", description: cDesc, category: "CARD_EFFECT" });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🧱【${cName}】`);
        } else if (cId === "CMD_MARKET") {
            // 🏪 市場: コスト 🧱-25 (LINK資源カテゴリごとに🌾/🧱産出)
            this.state.marketCount = (this.state.marketCount || 0) + 1;
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "🏪", description: cDesc, category: "CARD_EFFECT" });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🏪【${cName}】`);
        } else if (cId === "CMD_DEPOT") {
            // 🏭 集積倉庫: コスト 🧱-30 (PROJECTカード🧱コスト-15%)
            this.state.depotCount = (this.state.depotCount || 0) + 1;
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "🏭", description: cDesc, category: "CARD_EFFECT" });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🏭【${cName}】`);
        } else if (cId === "CMD_IRRIGATION") {
            // 💧 灌漑: コスト 🧱-20 (水源接続農地 🌾+1/T)
            this.state.irrigationCount = (this.state.irrigationCount || 0) + 1;
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "💧", description: cDesc, category: "CARD_EFFECT" });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `💧【${cName}】`);
        } else if (cId === "CMD_RESETTLEMENT") {
            // 🏕️ 移住: コスト 🌾-15 🧱-10 (平地MERGEに 🔥+2、🌾+2/T)
            if (this.state.emberSystem && typeof this.state.emberSystem.addBonus === 'function') {
                this.state.emberSystem.addBonus(2);
            } else {
                this.state.ember = (this.state.ember || 0) + 2;
            }
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "🏕️", description: cDesc, category: "CARD_EFFECT" });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🏕️【${cName}】`);
        } else if (cId === "CMD_WORKSHOP") {
            // 🔨 工房: コスト 🧱-30 (SPECIAL_BLOCKカード🧱コスト-10%)
            this.state.workshopCount = (this.state.workshopCount || 0) + 1;
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "🔨", description: cDesc, category: "CARD_EFFECT" });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🔨【${cName}】`);
        } else if (cId === "CMD_GRANARY_NETWORK") {
            // 🏛️ 大穀倉網: コスト 🧱-50 (維持費倍率 0.90→0.87相当)
            this.state.granaryNetworkActive = true;
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "🏛️", description: cDesc, category: "PERMANENT" });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🏛️【${cName}】`);
        } else if (cId === "CMD_INDUSTRIAL_ROAD") {
            // 🛣️ 産業街道: コスト 🧱-45 (産業拠点持続産出+20%)
            this.state.industrialRoadActive = true;
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "🛣️", description: cDesc, category: "PERMANENT" });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🛣️【${cName}】`);
        } else if (cId === "CMD_IRRIGATION_NETWORK") {
            // 🌊 大規模灌漑網: コスト 🧱-50 (最大8農地 🌾+1/T)
            this.state.irrigationNetworkActive = true;
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "🌊", description: cDesc, category: "PERMANENT" });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🌊【${cName}】`);
        } else if (cId === "CMD_INDUSTRIAL_CLUSTER") {
            // 🏭 産業集積: コスト 🧱-60 (PROJECTカード🧱コスト-20%)
            this.state.industrialClusterActive = true;
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "🏭", description: cDesc, category: "PERMANENT" });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🏭【${cName}】`);
        } else if (cId === "CMD_GREAT_RAMPART_PROJECT") {
            // 🏯 大防塁: コスト 🧱-70 (連続防塁付与、Trial迎撃強化)
            this.state.greatRampartActive = true;
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "🏯", description: cDesc, category: "PERMANENT" });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🏯【${cName}】`);
        } else if (cId === "CMD_ABANDONED_SETTLEMENT") {
            // 🎲 領土探索: コスト 🔥-1 (2D6判定)
            const checkResult = checkSystem.resolve({
                checkId: "standard_2d6",
                actionId: `abandoned_settlement_${this.state.turn || 1}_${handIdx >= 0 ? `hand_${handIdx}` : reserveIdx >= 0 ? `reserve_${reserveIdx}` : "direct"}`,
                checkSequence: 1
            });
            const roll = checkResult.finalTotal;
            if (roll <= 5) {
                this.state.food = (this.state.food || 0) + 15;
            } else if (roll <= 8) {
                this.state.wood = (this.state.wood || 0) + 15;
            } else if (roll <= 11) {
                this.state.mystic = (this.state.mystic || 0) + 10;
            } else {
                this.state.food = (this.state.food || 0) + 20;
                this.state.wood = (this.state.wood || 0) + 20;
                this.state.mystic = (this.state.mystic || 0) + 15;
            }
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "🎲", description: cDesc, category: "CARD_EFFECT" });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🎲【${cName}】`);
            return {
                success: true,
                diceCheck: {
                    result: checkResult,
                    context: {
                        sourceType: "CARD_CHECK",
                        sourceId: "abandoned_settlement",
                        tacticNameKey: "CMD_ABANDONED_SETTLEMENT_NAME"
                    },
                    feedback: {
                        importance: roll >= 11 ? "CRITICAL" : "TACTICAL"
                    }
                }
            };
        } else if (cId === "CMD_MUD_OBSTACLE") {
            // 🛡️ 泥濘陣地: コスト 🧱-15 (試練時湿原/湖敵制圧力-15%)
            this.state.mudObstacleActive = true;
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "🛡️", description: cDesc, category: "TACTICAL" });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🛡️【${cName}】`);
        } else if (cId === "CMD_OUTPOST_SIGNAL") {
            // 🗼 狼煙: コスト 🧱-15 (侵攻情報2T早く取得 & 迎撃戦術補正+15%)
            this.state.outpostSignalActive = true;
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "🗼", description: cDesc, category: "TACTICAL" });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🗼【${cName}】`);
        } else if (cId === "CMD_SCOUT_ENEMY") {
            // 🔍 敵情偵察: コスト 🌾-5 (試練敵情先行公開)
            this.state.scoutEnemyActive = true;
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "🔍", description: cDesc, category: "TACTICAL" });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🔍【${cName}】`);
        } else if (cId === "CMD_OMEN_DREAM") {
            // 🔮 予兆: コスト ✨-5 (試練先行情報公開)
            this.state.omenDreamActive = true;
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "🔮", description: cDesc, category: "CARD_EFFECT" });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🔮【${cName}】`);
        } else if (cId === "CMD_LAND_EXPLORATION") {
            const candidates = [];
            if (this.state.grid) {
                for (let r = 0; r < 5; r++) {
                    for (let c = 0; c < 5; c++) {
                        const cell = this.state.grid[r][c];
                        if (cell && cell.placed && !cell.isHQ && !cell.searched && !cell.merged) {
                            candidates.push({ r, c });
                        }
                    }
                }
            }

            if (candidates.length === 0) {
                return { success: false, reason: "NO_EXPLORABLE_TILES" };
            }

            const chosen = candidates[this._nextGameplayInt(0, candidates.length - 1)];
            const posStr = `${String.fromCharCode(65+chosen.c)}${chosen.r+1}`;
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: `(${posStr}) 2D6` }) : `📜 ${cName}`);
            const expRes = this.executeExploration(chosen.r, chosen.c);
            return { success: expRes.success };
        }

        if (cardObj.isUnique) {
            if (!this.state.usedUniqueCards) this.state.usedUniqueCards = [];
            this.state.usedUniqueCards.push(cId);
        }

        this.state.hasPickedThisTurn = true;
        return { success: true };
    }

    /**
     * 🔍 2D6 土地探索判定
     */
    executeExploration(r, c) {
        if (!this.state || !this.state.grid) return { success: false, reason: "NO_GRID" };
        const cell = this.state.grid[r]?.[c];
        if (!cell || !cell.placed || cell.isHQ) return { success: false, reason: "INVALID_CELL" };
        if (cell.searched) return { success: false, reason: "ALREADY_SEARCHED" };

        const checkSystem = this.engine?.checkSystem || this.state?.checkSystem;
        if (!checkSystem || typeof checkSystem.resolveDefinition !== "function") {
            return { success: false, reason: "CHECK_SYSTEM_UNAVAILABLE" };
        }
        const checkResult = checkSystem.resolveDefinition({
            definition: LAND_EXPLORATION_CHECK,
            actionId: `land_exploration_${this.state.turn || 1}_${r}_${c}`
        });
        const totalRoll = checkResult.finalTotal;
        cell.searched = true;
        const posStr = `(${String.fromCharCode(65+c)}${r+1})`;
        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' && window.I18n ? window.I18n : { t: k => k });

        let resultMsg = "";
        if (totalRoll >= 8) {
            if (!cell.socketResource) {
                const baseTerrainId = cell.terrain ? (cell.terrain.terrainId || cell.terrain.id) : "GL1_PLAINS";
                const sysMaster = (typeof globalThis !== 'undefined' && globalThis.LAND_SYSTEM_DATA && globalThis.LAND_SYSTEM_DATA.sockets) ? globalThis.LAND_SYSTEM_DATA.sockets : null;
                let socketDef = null;

                if (sysMaster && sysMaster[baseTerrainId]) {
                    const pool = sysMaster[baseTerrainId];
                    // 🌊 探索時も配置時と同じ水源逓減・距離制約を適用する。
                    let waterSourceId = null;
                    let waterSourceBaseRate = 0;
                    if (baseTerrainId === "E0_WETLAND" || baseTerrainId.includes("WETLAND")) {
                        waterSourceId = "SOCKET_LAKE";
                        waterSourceBaseRate = cell.hasSocket ? 0.60 : 0.20;
                    } else if (baseTerrainId.includes("DESERT")) {
                        waterSourceId = "SOCKET_OASIS";
                        waterSourceBaseRate = 0.25;
                    } else if (baseTerrainId.includes("PLAINS")) {
                        waterSourceId = "SOCKET_LAKE";
                        waterSourceBaseRate = 0.25;
                    }
                    const waterSourceChance = getWaterSourceSpawnChance(this.state, r, c, waterSourceBaseRate);
                    if (waterSourceId && waterSourceChance > 0 && this._nextGameplayFloat() < waterSourceChance) {
                        const waterSource = pool.find(s => s.id === waterSourceId);
                        if (waterSource) {
                            socketDef = {
                                id: waterSource.id, nameKey: waterSource.nameKey, category: waterSource.category, icon: waterSource.icon,
                                bonusFood: waterSource.bonusYields.food || 0, bonusWood: waterSource.bonusYields.wood || 0,
                                bonusDefense: waterSource.bonusYields.defense || 0, bonusMystic: waterSource.bonusYields.mystic || 0
                            };
                        }
                    }
                    if (!socketDef) {
                        const candidates = pool.filter(s => !s.isSpecialWater && (s.weight || 0) > 0);
                        const validPool = candidates.length > 0 ? candidates : pool;
                        const totalWeight = validPool.reduce((sum, s) => sum + (s.weight || 1), 0);
                        let rand = this._nextGameplayFloat() * totalWeight;
                        let chosen = validPool[0];
                        for (const s of validPool) {
                            const w = s.weight || 1;
                            if (rand < w) {
                                chosen = s;
                                break;
                            }
                            rand -= w;
                        }
                        socketDef = {
                            id: chosen.id,
                            nameKey: chosen.nameKey,
                            category: chosen.category,
                            icon: chosen.icon,
                            bonusFood: (chosen.bonusYields && chosen.bonusYields.food) || 0,
                            bonusWood: (chosen.bonusYields && (chosen.bonusYields.material !== undefined ? chosen.bonusYields.material : chosen.bonusYields.wood)) || 0,
                            bonusDefense: (chosen.bonusYields && chosen.bonusYields.defense) || 0,
                            bonusMystic: (chosen.bonusYields && chosen.bonusYields.mystic) || 0
                        };
                    }
                } else {
                    socketDef = { id: "SOCKET_WILD_WHEAT", nameKey: "SOCKET_WILD_WHEAT", category: "CAT_GRAIN", icon: "🌾", bonusFood: 3, bonusWood: 0, bonusDefense: 0, bonusMystic: 0 };
                }

                cell.socketResource = socketDef;
                const sName = I18n.t(socketDef.nameKey);
                const sIcon = socketDef.icon || "💎";
                resultMsg = `🎲 Roll ${totalRoll}: ${sIcon} : ${sName}`;
                if (this.state.toastQueue) {
                    this.state.toastQueue.push({ r, c, text: I18n.t("TOAST_SOCKET_SPAWNED", { name: sName, icon: sIcon }) });
                }
            } else {
                this.state.food += 3;
                this.state.wood += 3;
                resultMsg = `🎲 Roll ${totalRoll}: Success 🌾+3 🧱+3`;
                if (this.state.toastQueue) {
                    this.state.toastQueue.push({ r, c, text: I18n.t("TOAST_EXPLORATION_SUCCESS") });
                }
            }
        } else if (totalRoll >= 5) {
            this.state.food += 2;
            resultMsg = `🎲 Roll ${totalRoll}: Result 🌾+2`;
            if (this.state.toastQueue) {
                this.state.toastQueue.push({ r, c, text: I18n.t("TOAST_EXPLORATION_MED") });
            }
        } else {
            this.state.food += 1;
            resultMsg = `🎲 Roll ${totalRoll}: Result 🌾+1`;
            if (this.state.toastQueue) {
                this.state.toastQueue.push({ r, c, text: I18n.t("TOAST_EXPLORATION_LOW") });
            }
        }

        if (typeof this.state.addLog === 'function') {
            this.state.addLog(I18n.t("LOG_EXPLORATION_RESULT", { pos: posStr, result: resultMsg }));
        }
        return { success: true };
    }

    /**
     * 🔄 ターン進行時のリフレッシュ（マリガン権回復）
     */
    onNextTurn() {
        if (!this.state) return;
        this.state.turn++;
        this.state.hasPickedThisTurn = false;
        this.state.hasReservedThisTurn = false;
        this.state.hasMulliganedThisTurn = false;
        this.generateOfferingCards();
    }
}

if (typeof window !== "undefined") {
    window.DeckManager = DeckManager;
    window.Step1DrawSystem = DeckManager;
}
if (typeof globalThis !== "undefined") {
    globalThis.DeckManager = DeckManager;
    globalThis.Step1DrawSystem = DeckManager;
}

const Step1DrawSystem = DeckManager;
export { DeckManager, Step1DrawSystem, COMMAND_CARDS_MASTER };
export default DeckManager;
