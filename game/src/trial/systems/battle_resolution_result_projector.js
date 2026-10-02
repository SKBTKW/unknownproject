import { freezeBattleResolutionData } from "../domain/battle_resolution_snapshot.js";

function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

const BASELINE_RESULT_KEYS = Object.freeze([
    "outcome",
    "margin",
    "humanFinalPower",
    "enemyFinalPower",
    "damageToSuppression",
    "remainingSuppression",
    "remainingForceSuppression"
]);

function mergeResult(normalOutcome, finalCombatResult) {
    if (!normalOutcome && !finalCombatResult) return null;

    const normal = cloneData(normalOutcome) || {};
    const final = cloneData(finalCombatResult) || {};
    const merged = {
        ...normal,
        ...final
    };

    // Final-result policies may intentionally return only the changed fields.
    // Preserve canonical normal-result values when the final projection omits
    // them; never recalculate them from CombatResult or BattleContext here.
    for (const key of BASELINE_RESULT_KEYS) {
        if (final[key] === undefined && normal[key] !== undefined) {
            merged[key] = cloneData(normal[key]);
        }
    }

    if (final.appliedModifiers === undefined && normal.appliedModifiers !== undefined) {
        merged.appliedModifiers = cloneData(normal.appliedModifiers);
    }
    if (final.terrainEvents === undefined && normal.terrainEvents !== undefined) {
        merged.terrainEvents = cloneData(normal.terrainEvents);
    }

    return merged;
}

/**
 * Canonical read projection for downstream Battle consumers.
 *
 * It does not mutate/evolve the snapshot and does not infer gameplay meaning.
 * It only exposes facts already persisted by A-owned normal resolution and
 * later Opportunity/Fortune snapshot evolution.
 */
export function projectBattleResolutionResult(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
        throw new TypeError("BATTLE_RESOLUTION_SNAPSHOT_REQUIRED");
    }

    const normalOutcome = cloneData(snapshot.normalOutcome ?? null);
    const finalCombatResult = snapshot.finalCombatResult
        ? mergeResult(normalOutcome, snapshot.finalCombatResult)
        : null;
    const effectiveCombatResult = finalCombatResult
        ?? mergeResult(normalOutcome, null);

    return freezeBattleResolutionData({
        battleId: snapshot.battleId ?? null,
        routeId: snapshot.routeId ?? null,
        interceptionLocation: cloneData(
            snapshot.battlefieldContext?.interceptionLocation
                ?? snapshot.battlefieldContext?.interceptTerrain
                ?? null
        ),
        resolutionPhase: snapshot.resolutionPhase ?? null,
        finalized: snapshot.finalized === true,
        resultStage: snapshot.finalized === true
            ? "FINAL"
            : (snapshot.finalCombatResult ? "FINAL_PENDING" : "NORMAL_OUTCOME"),
        normalOutcome,
        intervention: {
            opportunity: cloneData(snapshot.opportunity ?? null),
            emberCommit: cloneData(snapshot.emberCommit ?? null),
            fortuneRoll: cloneData(snapshot.fortuneRoll ?? null),
            decisiveEvent: cloneData(snapshot.decisiveEvent ?? null)
        },
        finalCombatResult,
        effectiveCombatResult,
        outcome: effectiveCombatResult?.outcome ?? null,
        remainingForceSuppression: effectiveCombatResult?.remainingForceSuppression ?? null,
        damageToSuppression: effectiveCombatResult?.damageToSuppression ?? null,
        provenance: {
            causeIds: (snapshot.causes || []).map(row => row?.causeId).filter(Boolean),
            consequenceIds: (snapshot.consequences || []).map(row => row?.consequenceId).filter(Boolean),
            decisiveSourceCauses: Array.isArray(snapshot.decisiveEvent?.sourceCauses)
                ? [...snapshot.decisiveEvent.sourceCauses]
                : []
        }
    });
}

export default projectBattleResolutionResult;
