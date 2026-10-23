import { TacticRequirementEvaluator } from "../systems/tactic_requirement_evaluator.js";

export const copy = value => JSON.parse(JSON.stringify(value));

// Development-only state projection. Requirements are caller-declared contracts,
// not new production tactic rules. Unknown evidence never grants a state token.
export function tacticalTokens(context, state, actor) {
    const tokens = [];
    if (actor === "ENEMY") {
        if (context.enemy?.bodySize === "LARGE") tokens.push("LARGE_BODY");
        if (context.battlefieldCapabilities?.intercept?.capabilities?.frontage === "OPEN") {
            tokens.push("DEPLOYMENT_SPACE");
        }
        if (state.enemy.formation === "ORDERED") tokens.push("ORDERED_FORMATION");
        if (state.enemy.pursuit === "PURSUING") tokens.push("PURSUING");
    } else {
        if (state.human.freedom === "FREE") tokens.push("FREE_MOVEMENT");
        if (state.human.escapeRoute === "AVAILABLE") tokens.push("ESCAPE_ROUTE");
    }
    return [...tokens, ...(state[actor.toLowerCase()].externalTokens || [])];
}

export function evaluateTactics(context, state, tactics) {
    const evaluator = new TacticRequirementEvaluator();
    return tactics.map(tactic => ({
        tacticId: tactic.tacticId,
        actor: tactic.actor,
        ...evaluator.evaluate({
            requirement: tactic.requirement,
            states: tacticalTokens(context, state, tactic.actor)
        })
    }));
}

export function applyTacticalConsequences(state, consequences) {
    const next = copy(state);
    for (const row of consequences) {
        for (const [key, value] of Object.entries(row.resultingState)) {
            next[row.target][key] = value;
        }
    }
    return next;
}
