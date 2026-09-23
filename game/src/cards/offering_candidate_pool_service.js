/* =============================================================
   game/src/cards/offering_candidate_pool_service.js

   Canonical Offering candidate population boundary.
   Every caller receives only definitions that have already passed the full
   DeckManager eligibility contract. Callers may narrow this population, but
   may never re-introduce an ineligible card.
   ============================================================= */

import { pickWeightedCard } from "./offering_weight_policy.js";

export class OfferingCandidatePoolService {
    constructor({
        cardMasterProvider,
        eligibilityEvaluator
    } = {}) {
        this.cardMasterProvider = cardMasterProvider;
        this.eligibilityEvaluator = eligibilityEvaluator;
    }

    build({
        stageNum = 1,
        h2Count = 0,
        excludedCardIds = [],
        eligibilityOptions = {},
        candidateFilter = null
    } = {}) {
        const master = typeof this.cardMasterProvider === "function"
            ? this.cardMasterProvider()
            : [];
        if (!Array.isArray(master) || typeof this.eligibilityEvaluator !== "function") {
            return [];
        }

        const excluded = new Set(Array.isArray(excludedCardIds) ? excludedCardIds : []);
        const narrowed = [];

        for (const card of master) {
            if (!card?.id || excluded.has(card.id)) continue;
            if (!this.eligibilityEvaluator(card, stageNum, h2Count, eligibilityOptions)) continue;
            if (typeof candidateFilter === "function" && !candidateFilter(card)) continue;
            narrowed.push(card);
        }

        return narrowed;
    }

    pick({
        stageNum = 1,
        h2Count = 0,
        excludedCardIds = [],
        eligibilityOptions = {},
        candidateFilter = null,
        state = null,
        random = Math.random,
        weightContext = null
    } = {}) {
        const candidates = this.build({
            stageNum,
            h2Count,
            excludedCardIds,
            eligibilityOptions,
            candidateFilter
        });
        if (candidates.length === 0) return null;
        return pickWeightedCard(candidates, state, random, weightContext)
            || candidates[0]
            || null;
    }
}

export default OfferingCandidatePoolService;
