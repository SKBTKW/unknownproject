import { ENEMY_TACTICS } from "./enemy_tactic_resolver.js";

export const DEFAULT_ENEMY_TACTIC_SELECTION_POLICY = Object.freeze({
    priority: Object.freeze({
        [ENEMY_TACTICS.MAIN_FEINT]: 500,
        [ENEMY_TACTICS.AMBUSH_CAUTION]: 400,
        [ENEMY_TACTICS.FLANKING]: 300,
        [ENEMY_TACTICS.DISPERSED_INFILTRATION]: 200,
        [ENEMY_TACTICS.FRONTAL_BREAKTHROUGH]: 200
    })
});

function score(policy, tactic) {
    const value = Number(policy?.priority?.[tactic?.id]);
    return Number.isFinite(value) ? value : 0;
}

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

/**
 * Selects one tactic from an eligibility result.
 *
 * Commander quality affects selection upstream by unlocking progressively more
 * sophisticated eligible tactics. This selector intentionally does not apply
 * combat effects: it only chooses the highest-priority tactic that the force is
 * actually allowed to use, keeping tactic execution and trade-offs separate.
 */
export class EnemyTacticSelectionResolver {
    constructor({ policy = {} } = {}) {
        this.policy = {
            ...DEFAULT_ENEMY_TACTIC_SELECTION_POLICY,
            ...policy,
            priority: {
                ...DEFAULT_ENEMY_TACTIC_SELECTION_POLICY.priority,
                ...(policy.priority || {})
            }
        };
    }

    resolve(tacticResolution = null) {
        const tactics = Array.isArray(tacticResolution?.tactics)
            ? tacticResolution.tactics
            : [];

        const ranked = tactics
            .map((tactic, index) => ({
                tactic,
                index,
                score: score(this.policy, tactic)
            }))
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return a.index - b.index;
            });

        const selected = ranked[0]?.tactic || null;
        const alternatives = ranked.slice(1).map(entry => clone(entry.tactic));

        return Object.freeze({
            forceId: tacticResolution?.forceId || null,
            commanderLevel: tacticResolution?.commanderLevel || 1,
            terrainId: tacticResolution?.terrainId || null,
            terrainFamily: tacticResolution?.terrainFamily || "UNKNOWN",
            selectedTactic: selected ? Object.freeze(clone(selected)) : null,
            alternatives: Object.freeze(alternatives.map(item => Object.freeze(item))),
            selectionReason: selected ? "HIGHEST_PRIORITY_ELIGIBLE" : "NO_ELIGIBLE_TACTIC"
        });
    }
}

export default EnemyTacticSelectionResolver;
