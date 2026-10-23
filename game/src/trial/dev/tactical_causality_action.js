import { TrialTerrainEffectResolver } from "../systems/trial_terrain_effect_resolver.js";

const validReason = value => typeof value === "string" && value.trim().length > 0;

// Validate externally resolved facts against known state, without inventing
// pathfinding, capture probability, commander AI, or physical movement rules.
export function resolveTacticalAction(action, state, executed) {
    const reasons = [];
    const unverified = [];
    const updates = [];
    const evidence = action.evidence || {};
    const known = (condition, code) => { if (condition) reasons.push(code); };
    const external = (name, value) => {
        if (typeof value !== "boolean" || !validReason(evidence[name])) {
            reasons.push(`EXTERNAL_EVIDENCE_REQUIRED:${name}`);
        } else {
            unverified.push({ fact: name, value, reason: evidence[name], status: "UNVERIFIED_EXTERNAL_FACT" });
        }
    };
    if (!validReason(action.reason)) reasons.push("DECISION_REASON_REQUIRED");
    if (action.movement) {
        const { canEnter, reason } = action.movement;
        known(canEnter === false, "DESTINATION_INACCESSIBLE");
        const destination = action.movement.destinationCell;
        if (action.actor === "ENEMY" && destination?.terrainId) {
            known(!new TrialTerrainEffectResolver().canEnterNormalRoute(destination), "NORMAL_ROUTE_ENTRY_FORBIDDEN");
        }
        if (canEnter !== false) {
            known(canEnter !== true || !validReason(reason), "MOVEMENT_EVIDENCE_REQUIRED");
            unverified.push({ fact: "DESTINATION_ACCESS", value: canEnter, reason, status: "UNVERIFIED_EXTERNAL_FACT" });
        }
    }
    switch (action.type) {
        case "SKIRMISH":
            known(action.actor !== "HUMAN", "ACTOR_MISMATCH");
            known(state.human.freedom === "CAPTURED", "HUMAN_CAPTURED");
            known(state.human.escapeRoute === "BLOCKED", "NO_ESCAPE_ROUTE");
            known(state.human.freedom !== "FREE", "FREE_MOVEMENT_NOT_ESTABLISHED");
            known(state.human.escapeRoute !== "AVAILABLE", "ESCAPE_ROUTE_NOT_ESTABLISHED");
            break;
        case "PURSUE":
        case "IGNORE": {
            known(action.actor !== "ENEMY", "ACTOR_MISMATCH");
            const source = executed.find(row => row.actionId === action.sourceActionId
                && row.type === "SKIRMISH" && row.status === "EXECUTED");
            known(!source, "EXECUTED_SKIRMISH_SOURCE_REQUIRED");
            known(state.human.freedom === "CAPTURED", "TARGET_ALREADY_CAPTURED");
            if (action.type === "PURSUE") {
                known(state.human.escapeRoute === "BLOCKED", "NO_ESCAPE_ROUTE");
                external("overextended", action.overextended);
                updates.push({ type: "PURSUIT_ESTABLISHED", target: "enemy", resultingState: { pursuit: "PURSUING" } });
                if (action.overextended === true) {
                    updates.push({ type: "FORMATION_DISRUPTED", target: "enemy", resultingState: { formation: "DISRUPTED" } });
                }
            }
            break;
        }
        case "CAPTURE":
        case "BLOCK_ESCAPE":
            known(action.actor !== "ENEMY", "ACTOR_MISMATCH");
            external("success", action.success);
            if (action.success === true) updates.push(action.type === "CAPTURE"
                ? { type: "HUMAN_CAPTURED", target: "human", resultingState: { freedom: "CAPTURED" } }
                : { type: "ESCAPE_BLOCKED", target: "human", resultingState: { escapeRoute: "BLOCKED" } });
            break;
        case "INTERCEPT":
        case "HOLD":
        case "COLLECTIVE_CHARGE":
            known(action.actor !== (action.type === "COLLECTIVE_CHARGE" ? "ENEMY" : "HUMAN"), "ACTOR_MISMATCH");
            // Eligibility is observed; no numerical or victory effects are claimed.
            break;
        default:
            reasons.push("UNSUPPORTED_ACTION");
    }
    return { reasons, unverified, updates: reasons.length ? [] : updates };
}
