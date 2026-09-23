import { InvestigationResolver } from "./investigation_resolver.js";
import { KnownEnemyStateService } from "./known_enemy_state_service.js";
import { DicePool } from "../../core/check_system/dice_pool.js";

export const INVESTIGATION_RESULT_TYPES = Object.freeze({
    PERFORMED: "INVESTIGATION_PERFORMED"
});

export const INVESTIGATION_ALL_FACETS = Object.freeze([
    "scaleBand",
    "directionHints",
    "physiqueTraits",
    "equipmentTraits",
    "movementTraits",
    "terrainTraits"
]);

function resolveEnhancedOutcome(total) {
    if (total >= 12) return Object.freeze({ bonusObservations: 3, critical: true, preferDistinctFacets: true });
    if (total >= 9) return Object.freeze({ bonusObservations: 2, critical: false, preferDistinctFacets: false });
    if (total >= 5) return Object.freeze({ bonusObservations: 1, critical: false, preferDistinctFacets: false });
    return Object.freeze({ bonusObservations: 0, critical: false, preferDistinctFacets: false });
}

/**
 * Card-ID-independent Investigation application service.
 *
 * The caller supplies an already-redacted ObservableEnemyProfile. This service
 * never reads or mutates Trial truth, routes, ingress, force, or schedule.
 * Optional enhanced investigation assumes the caller has already authorized
 * and paid any external resource cost; this service only resolves its outcome.
 */
export class InvestigationRequestService {
    constructor({
        randomSource,
        resolver = null,
        knownEnemyStateService = new KnownEnemyStateService()
    } = {}) {
        if (!randomSource || typeof randomSource.nextFloat !== "function") {
            throw new TypeError("INVESTIGATION_GAMEPLAY_RANDOM_REQUIRED");
        }
        this.randomSource = randomSource;
        this.diceRandomSource = typeof randomSource.nextInt === "function"
            ? randomSource
            : {
                nextInt: (min, max) => {
                    const low = Math.ceil(Number(min));
                    const high = Math.floor(Number(max));
                    const raw = Number(randomSource.nextFloat());
                    const normalized = Number.isFinite(raw)
                        ? Math.min(Math.max(raw, 0), 0.999999999999)
                        : 0;
                    return low + Math.floor(normalized * (high - low + 1));
                }
            };
        this.resolver = resolver || new InvestigationResolver({
            rng: () => this.randomSource.nextFloat()
        });
        this.knownEnemyStateService = knownEnemyStateService;
    }

    perform({
        profile,
        knownEnemyState,
        observedAtVerse,
        reportId,
        sourceType = "INVESTIGATION",
        allowedFacets = INVESTIGATION_ALL_FACETS,
        baseObservations = 1,
        enhanced = false,
        costPaid = null,
        observationModifiers = null
    } = {}) {
        if (!profile || typeof profile !== "object") {
            return { success: false, reason: "OBSERVABLE_PROFILE_REQUIRED" };
        }
        if (!knownEnemyState || typeof knownEnemyState !== "object") {
            return { success: false, reason: "KNOWN_ENEMY_STATE_REQUIRED" };
        }
        if (typeof reportId !== "string" || reportId.length === 0) {
            return { success: false, reason: "INVESTIGATION_REPORT_ID_REQUIRED" };
        }

        let roll = null;
        let critical = false;
        let bonusObservations = 0;
        let preferDistinctFacets = false;

        if (enhanced === true) {
            const diceResult = DicePool.roll({ count: 2, sides: 6, keep: "all" }, this.diceRandomSource);
            const dice = [...diceResult.kept];
            const total = dice.reduce((sum, value) => sum + value, 0);
            const outcome = resolveEnhancedOutcome(total);
            roll = Object.freeze({ dice: Object.freeze(dice), total });
            critical = outcome.critical;
            bonusObservations = outcome.bonusObservations;
            preferDistinctFacets = outcome.preferDistinctFacets;
        }

        const modifierBonus = Math.max(0, Math.floor(Number(observationModifiers?.bonusObservations) || 0));
        const maxObservations = Math.max(
            1,
            Math.floor(Number(baseObservations) || 1) + bonusObservations + modifierBonus
        );

        const report = this.resolver.resolve({
            profile,
            knownEnemyState,
            observedAtVerse,
            reportId,
            sourcePolicy: {
                sourceType,
                allowedFacets,
                maxObservations,
                preferUnknown: true,
                preferDistinctFacets: preferDistinctFacets
                    || observationModifiers?.preferDistinctFacets === true,
                textKey: null
            }
        });

        if (!Array.isArray(report?.observations) || report.observations.length < 1) {
            return {
                success: false,
                reason: "NO_OBSERVABLE_FRAGMENTS",
                roll,
                critical
            };
        }

        const recorded = this.knownEnemyStateService.record(knownEnemyState, report);

        return {
            success: true,
            type: INVESTIGATION_RESULT_TYPES.PERFORMED,
            report,
            reportId: report.id,
            fragmentsDiscovered: report.observations.map(observation => ({ ...observation })),
            roll,
            critical,
            enhanced: enhanced === true,
            costPaid: costPaid == null ? null : JSON.parse(JSON.stringify(costPaid)),
            comparison: recorded.comparison,
            previousReport: recorded.previousReport,
            state: recorded.state
        };
    }
}

export default InvestigationRequestService;
