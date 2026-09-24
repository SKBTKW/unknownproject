import { I18n } from '../i18n.js';
import { LAND_SYSTEM_DATA } from '../data/land_system.js';
import { DIRECTIVES } from './directive_system.js';
import { LAND_CARDS_MASTER } from '../data/land_cards_data.js';
import { COMMAND_CARDS_MASTER } from '../data/command_cards_data.js';
import { ConditionEvaluator } from '../core/condition_evaluator.js';
import { CardCycleSystem, CYCLE_POLICIES } from './card_cycle_system.js';
import {
    getPlacementAttributeTerrainId,
    hasMultiplePlacementTerrainAttributes,
    normalizePlacementAnchor,
    resolvePlacementAttributeCells,
    resolvePlacementShape,
    validatePlacementAttributeMap
} from '../core/placement_geometry.js';
import { isMultiAttributeProductionResolved } from '../core/land_production_contract.js';
import { getWaterSourceSpawnChance } from '../core/lake_rules.js';
import { normalizeCardDefinitionV1, unwrapCardDefinition } from '../cards/card_definition_v1.js';
import { LandPlacementAvailabilityQuery } from '../cards/land_placement_availability_query.js';
import { CardOfferingEligibilityService } from '../cards/card_offering_eligibility_service.js';
import { pickWeightedCard } from '../cards/offering_weight_policy.js';
import {
    canAppendOfferingCategory,
    listOfferingCategoryOverflow,
    resolveOfferingCategoryMultiplicityPolicy
} from '../cards/offering_category_multiplicity_policy.js';
import { OfferingCandidatePoolService } from '../cards/offering_candidate_pool_service.js';
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
            executionTargetRequired: (definition) =>
                this.cardEffectHandlerRouter?.requiresTarget(definition) === true,
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
        this.offeringCandidatePool = new OfferingCandidatePoolService({
            cardMasterProvider: () => this.getLandCardMaster(),
            eligibilityEvaluator: (card, stageNum, h2Count, options) =>
                this.isCardEligible(card, stageNum, h2Count, options)
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

    _resolveOfferingWeightContext() {
        const offeringWeights = { tagMultipliers: {} };
        const manager = this.engine?.globalEventManager || this.state?.globalEventManager || null;
        manager?.applyOfferingWeightEffects?.(offeringWeights);
        return Object.freeze({
            tagMultipliers: Object.freeze({ ...(offeringWeights.tagMultipliers || {}) })
        });
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

        const explicitAttributeCells = resolvePlacementAttributeCells(c);
        if (explicitAttributeCells) {
            const attributeValidation = validatePlacementAttributeMap(
                resolvePlacementShape(c),
                explicitAttributeCells
            );
            if (!attributeValidation.valid) return false;

            const hasUnknownTerrain = explicitAttributeCells.some(cell => {
                const terrainId = getPlacementAttributeTerrainId(cell);
                return !terrainId || !LAND_SYSTEM_DATA?.terrains?.[terrainId];
            });
            if (hasUnknownTerrain) return false;
        }

        // Multi-Attribute cards must not enter live Offering until their
        // Production contract is explicitly finalized.
        if (hasMultiplePlacementTerrainAttributes(c) && !isMultiAttributeProductionResolved(c)) {
            return false;
        }

        // Offering-only v1 boundary. LAND legality is queried from the existing
        // Placement Domain, and authored offering.requirements are evaluated
        // independently from execution requirements.
        const offeringGate = this.offeringEligibility?.evaluate(c, {
            stageNum,
            h2Count,
            options,
            placeabilityCache: options.placeabilityCache || null
        });
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
        const stageNum = (this.state && this.state.stage) ? (typeof this.state.stage === 'object' ? (this.state.stage.id || 1) : this.state.stage) : 1;
        const h2Count = this._countE2HillsOnBoard();

        const picked = this.offeringCandidatePool?.pick({
            stageNum,
            h2Count,
            excludedCardIds,
            eligibilityOptions: options,
            candidateFilter: options.candidateFilter,
            state: this.state,
            random: () => this._nextGameplayFloat(),
            weightContext: this._resolveOfferingWeightContext()
        }) || null;

        if (!picked) {
            return null; // 制約緩和フォールバックへ委ねる
        }
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

    _countE2HillsOnBoard() {
        if (!this.state) return 0;
        if (typeof this.state.countE2HillsOnBoard === "function") {
            return this.state.countE2HillsOnBoard();
        }
        if (this.state.gridEngine && typeof this.state.gridEngine.countE2HillsOnBoard === "function") {
            return this.state.gridEngine.countE2HillsOnBoard();
        }

        let count = 0;
        for (const row of this.state.grid || []) {
            for (const cell of row || []) {
                const terrainId = cell?.terrain?.terrainId || cell?.terrain?.id || null;
                if (cell?.placed && terrainId === "E2_HILL") count += 1;
            }
        }
        return count;
    }

    _isCardPlaceableNow(card, placeabilityCache = null) {
        const definition = this._cardDefinition(card);
        return this.landPlacementAvailability?.hasAnyLegalPlacement(definition, {
            cache: placeabilityCache
        }) === true;
    }

    _matchesMinimumRequirement(card, requirement, placeabilityCache = null) {
        const definition = this._cardDefinition(card);
        if (!definition || !requirement || typeof requirement !== "object") return false;
        if (requirement.category && definition.category !== requirement.category) return false;
        if (
            requirement.requirePlaceable === true
            && !this._isCardPlaceableNow(definition, placeabilityCache)
        ) return false;
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

    _enforceMinimumRequirements(cards, excludedCardIds, requirements, { placeabilityCache = null } = {}) {
        if (!Array.isArray(cards) || cards.length === 0 || !Array.isArray(requirements) || requirements.length === 0) return [];

        const applied = [];
        for (const requirement of requirements) {
            const minCount = Math.max(1, Math.trunc(requirement.minCount ?? 1));
            let matchingCount = cards.filter(card =>
                this._matchesMinimumRequirement(card, requirement, placeabilityCache)
            ).length;

            while (matchingCount < minCount) {
                const candidate = this.drawSingleCard(excludedCardIds, {
                    candidateFilter: card =>
                        this._matchesMinimumRequirement(card, requirement, placeabilityCache),
                    placeabilityCache
                });
                if (!candidate) break;

                const sameCategoryInvalidIndex = requirement.category
                    ? cards.findIndex(card => {
                        const definition = this._cardDefinition(card);
                        return definition?.category === requirement.category
                            && !this._matchesMinimumRequirement(card, requirement, placeabilityCache);
                    })
                    : -1;
                const replaceIndex = sameCategoryInvalidIndex >= 0
                    ? sameCategoryInvalidIndex
                    : cards.findIndex(card =>
                        !this._matchesMinimumRequirement(card, requirement, placeabilityCache)
                    );
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
        const stageNum = (this.state && this.state.stage) ? (typeof this.state.stage === 'object' ? (this.state.stage.id || 1) : this.state.stage) : 1;
        const h2Count = this._countE2HillsOnBoard();

        const newCards = [];
        const excludedCardIds = [];
        const placeabilityCache = new WeakMap();
        const categoryMultiplicityPolicy = resolveOfferingCategoryMultiplicityPolicy({
            engine: this.engine,
            state: this.state,
            reason
        });
        let categoryCapRelaxedForFallback = false;
        const respectsCategoryCap = card =>
            canAppendOfferingCategory(newCards, card, categoryMultiplicityPolicy);

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
            const drawn = this.drawSingleCard(excludedCardIds, {
                placeabilityCache,
                candidateFilter: respectsCategoryCap
            });
            if (drawn) {
                newCards.push(drawn);
                const cId = drawn.cardMasterId || (drawn.terrain ? drawn.terrain.id : null);
                if (cId) excludedCardIds.push(cId);
            }
        }

        // 段階 2 フォールバック: 不足時、Cooldown 中の適格カードから availableTurn 最小のものを一時解禁
        // Category cap is re-evaluated after every append so the third slot cannot
        // accidentally reuse a category that reached its cap during this loop.
        if (newCards.length < offeringSize && this.cycleSystem) {
            while (newCards.length < offeringSize) {
                const cdCandidates = this.offeringCandidatePool.build({
                    stageNum,
                    h2Count,
                    excludedCardIds,
                    eligibilityOptions: { ignoreCooldown: true, placeabilityCache },
                    candidateFilter: respectsCategoryCap
                });
                if (cdCandidates.length === 0) break;

                const minCard = this.cycleSystem.findMinAvailableTurnCard(cdCandidates);
                if (!minCard) break;
                const drawn = this._wrapCardInstance(minCard);
                newCards.push(drawn);
                excludedCardIds.push(minCard.id);
            }
        }

        // 段階 3 フォールバック: それでも不足時、Stage適格な既存基本土地プールから CD無視で補充
        // First preserve the category cap. Only if the Offering still cannot reach
        // its requested size do we relax the cap as the final availability rescue.
        const isBaseLandFallbackCandidate = c => {
            const policy = c.cyclePolicy || (c.category === "LAND"
                ? CYCLE_POLICIES.LAND_STANDARD
                : CYCLE_POLICIES.RARITY);
            return policy === CYCLE_POLICIES.LAND_STANDARD || c.category === "LAND";
        };

        while (newCards.length < offeringSize) {
            const baseLandPool = this.offeringCandidatePool.build({
                stageNum,
                h2Count,
                excludedCardIds,
                eligibilityOptions: { ignoreCooldown: true, placeabilityCache },
                candidateFilter: c =>
                    isBaseLandFallbackCandidate(c)
                    && respectsCategoryCap(c)
            });
            if (baseLandPool.length === 0) break;

            const picked = pickWeightedCard(
                baseLandPool,
                this.state,
                () => this._nextGameplayFloat(),
                this._resolveOfferingWeightContext()
            ) || baseLandPool[0];
            newCards.push(this._wrapCardInstance(picked));
            excludedCardIds.push(picked.id);
        }

        while (newCards.length < offeringSize) {
            const baseLandPool = this.offeringCandidatePool.build({
                stageNum,
                h2Count,
                excludedCardIds,
                eligibilityOptions: { ignoreCooldown: true, placeabilityCache },
                candidateFilter: isBaseLandFallbackCandidate
            });
            if (baseLandPool.length === 0) break;

            const picked = pickWeightedCard(
                baseLandPool,
                this.state,
                () => this._nextGameplayFloat(),
                this._resolveOfferingWeightContext()
            ) || baseLandPool[0];
            if (!respectsCategoryCap(picked)) categoryCapRelaxedForFallback = true;
            newCards.push(this._wrapCardInstance(picked));
            excludedCardIds.push(picked.id);
        }

        if (newCards.length < offeringSize) {
            console.warn(`[DeckManager] Critical: Offering cards insufficient (${newCards.length}/${offeringSize})`);
        }

        const minimumRequirements = this._resolveMinimumRequirements(reason);
        const appliedMinimumRequirements = this._enforceMinimumRequirements(
            newCards,
            excludedCardIds,
            minimumRequirements,
            { placeabilityCache }
        );
        const categoryOverflow = listOfferingCategoryOverflow(
            newCards,
            categoryMultiplicityPolicy
        );
        this.lastOfferingGeneration = Object.freeze({
            reason,
            requestedMinimums: minimumRequirements.length,
            appliedMinimums: appliedMinimumRequirements,
            categoryMultiplicity: Object.freeze({
                maxPerCategory: categoryMultiplicityPolicy.maxPerCategory,
                source: categoryMultiplicityPolicy.source,
                relaxedForFallback: categoryCapRelaxedForFallback,
                minimumRequirementOverride:
                    appliedMinimumRequirements.length > 0 && categoryOverflow.length > 0,
                overflow: Object.freeze(categoryOverflow)
            })
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

    quoteCardExecutionCost(cardObj) {
        if (!cardObj || cardObj.category === "LAND") {
            return { success: false, reason: "NOT_A_COMMAND_CARD", resources: {} };
        }
        const definitionV1 = normalizeCardDefinitionV1(cardObj);
        const quote = this.cardEffectHandlerRouter?.quoteCost(definitionV1, {
            state: this.state,
            engine: this.engine,
            deckManager: this
        }) || null;

        if (quote?.success === false) return quote;
        if (quote?.success === true && quote.resources) {
            return {
                success: true,
                resources: { ...quote.resources },
                source: quote.source || "DOMAIN_QUOTE",
                quote: quote.quote || null
            };
        }

        return {
            success: true,
            resources: { ...(cardObj.cost || {}) },
            source: "CARD_COST",
            quote: null
        };
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

        const paymentPlan = this.quoteCardExecutionCost(cardObj);
        if (paymentPlan?.success === false) {
            return {
                success: false,
                reason: paymentPlan.reason || "COMMAND_COST_QUOTE_FAILED"
            };
        }

        const resolvedPaymentCost = paymentPlan?.resources || cardObj.cost || {};
        const effectPreflight = this.cardEffectHandlerRouter?.preflight(cardObj, {
            state: this.state,
            engine: this.engine,
            deckManager: this,
            targetTile,
            handIdx,
            reserveIdx,
            resolvedPaymentCost
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

        const cost = resolvedPaymentCost;
        const matCost = cost.material !== undefined ? cost.material : (cost.wood || 0);
        const curMat = Math.max(this.state.material !== undefined ? this.state.material : 0, this.state.wood !== undefined ? this.state.wood : 0);
        const routedPaymentSnapshot = {
            food: this.state.food,
            wood: this.state.wood,
            material: this.state.material,
            mystic: this.state.mystic,
            ember: this.state.ember
        };

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

        const consumePlayedCardSlot = () => {
            if (handIdx >= 0 && this.state.handOffering && this.state.handOffering[handIdx]) {
                this.state.handOffering[handIdx] = {
                    isBlank: true,
                    originalCard: cardObj,
                    id: this._nextGameplayId("blank", `${this.state.turn || 1}_${handIdx}`)
                };
                this.state.hasPickedThisTurn = true;
            } else if (reserveIdx >= 0 && this.state.reserveSlots) {
                this.state.reserveSlots[reserveIdx] = null;
                this.state.hasPickedThisTurn = true;
            }
            this.consumeCardIfUnique(cardObj);
        };

        // Declarative/domain effects commit before the card slot is consumed.
        // Legacy branches retain their historical consume-before-effect order.
        const routedEffect = this.cardEffectHandlerRouter?.execute(cardObj, {
            state: this.state,
            engine: this.engine,
            deckManager: this,
            targetTile,
            handIdx,
            reserveIdx,
            resolvedPaymentCost,
            preflightAlreadyPassed: effectPreflight?.handled === true && effectPreflight.success === true,
            i18n: I18n,
            cardName: cName,
            cardDescription: cDesc
        });
        if (routedEffect?.handled) {
            if (routedEffect.success === false) {
                this.state.food = routedPaymentSnapshot.food;
                this.state.wood = routedPaymentSnapshot.wood;
                if (routedPaymentSnapshot.material !== undefined) {
                    this.state.material = routedPaymentSnapshot.material;
                } else {
                    this.state.material = this.state.wood;
                }
                this.state.mystic = routedPaymentSnapshot.mystic;
                this.state.ember = routedPaymentSnapshot.ember;
                return routedEffect;
            }

            consumePlayedCardSlot();
            if (cardObj.isUnique) {
                if (!this.state.usedUniqueCards) this.state.usedUniqueCards = [];
                if (!this.state.usedUniqueCards.includes(cId)) this.state.usedUniqueCards.push(cId);
            }
            this.state.hasPickedThisTurn = true;
            return { ...routedEffect, success: true };
        }

        consumePlayedCardSlot();

           if (cId === "CMD_TRANSMUTE_GOLDEN") {
            // 💎 黄金秘境への変容: コスト ✨-20
            if (targetTile && targetTile.r !== undefined && targetTile.c !== undefined && this.state.grid) {
                const cell = this.state.grid[targetTile.r][targetTile.c];
                cell.socketResource = { nameKey: "SOCKET_SACRED_VEIN", bonusMystic: 5, bonusEmber: 1 };
                this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `💎【${cName}】`);
            } else {
                this.state.mystic += 10;
                this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `💎【${cName}】`);
            }
        } else       if (cId === "CMD_RESETTLEMENT") {
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
        } else     

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
