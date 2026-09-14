/* =============================================================
   game/src/systems/global_event_choice_system.js
   選択型Global Eventの公開Context契約とChoice解決通知。
   hidden truth・Advisor人格・Trial結果計算は扱わない。
   ============================================================= */

import { GAME_FACT_TYPES } from "../core/game_fact.js";
import { findGlobalEventChoiceDefinition } from "../data/global_event_choices.js";

const FORBIDDEN_PUBLIC_KEYS = Object.freeze(new Set([
    "enemyTruth",
    "actualEntryPoint",
    "actualEnemyComposition",
    "hiddenRetaliationValue",
    "hiddenEnemyAIState",
    "nextTrialTurn",
    "trialRemaining"
]));

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function assertPublicValue(value, path = "context") {
    if (Array.isArray(value)) {
        value.forEach((item, index) => assertPublicValue(item, `${path}[${index}]`));
        return;
    }
    if (!value || typeof value !== "object") return;

    for (const [key, nested] of Object.entries(value)) {
        if (FORBIDDEN_PUBLIC_KEYS.has(key) || /^(hidden|actual)/i.test(key) || /enemyTruth/i.test(key)) {
            throw new Error(`GLOBAL_EVENT_PUBLIC_CONTEXT_FORBIDDEN_KEY:${path}.${key}`);
        }
        assertPublicValue(nested, `${path}.${key}`);
    }
}

function validateStringArray(value, optional = false) {
    if (value == null && optional) return true;
    return Array.isArray(value) && value.every(item => typeof item === "string" && item.length > 0);
}

function validateContext(def, publicContext) {
    if (!publicContext || typeof publicContext !== "object" || Array.isArray(publicContext)) {
        throw new TypeError("GLOBAL_EVENT_PUBLIC_CONTEXT_REQUIRED");
    }
    assertPublicValue(publicContext);

    const schema = def?.contextSchema || {};
    for (const [key, rule] of Object.entries(schema)) {
        const value = publicContext[key];
        if (Array.isArray(rule)) {
            if (!rule.includes(value)) throw new Error(`GLOBAL_EVENT_PUBLIC_CONTEXT_INVALID:${key}`);
            continue;
        }
        if (rule === "STRING_ARRAY" && !validateStringArray(value, false)) {
            throw new Error(`GLOBAL_EVENT_PUBLIC_CONTEXT_INVALID:${key}`);
        }
        if (rule === "STRING_ARRAY_OPTIONAL" && !validateStringArray(value, true)) {
            throw new Error(`GLOBAL_EVENT_PUBLIC_CONTEXT_INVALID:${key}`);
        }
        if (rule === "STRING_OPTIONAL" && value != null && typeof value !== "string") {
            throw new Error(`GLOBAL_EVENT_PUBLIC_CONTEXT_INVALID:${key}`);
        }
    }
}

function freezePayload(payload) {
    return Object.freeze(clone(payload));
}

export class GlobalEventChoiceSystem {
    constructor({ factHub = null } = {}) {
        this.factHub = factHub;
    }

    createPresentation(eventId, publicContext) {
        const def = findGlobalEventChoiceDefinition(eventId);
        if (!def) throw new Error(`GLOBAL_EVENT_CHOICE_UNKNOWN_EVENT:${eventId}`);
        validateContext(def, publicContext);

        const presentation = freezePayload({
            eventId: def.id,
            category: def.category,
            importance: def.importance,
            nameKey: def.nameKey,
            descKey: def.descKey,
            publicContext,
            choices: def.choices.map(choice => ({
                id: choice.id,
                labelKey: choice.labelKey
            }))
        });

        this.factHub?.emit?.(GAME_FACT_TYPES.GLOBAL_EVENT_CHOICE_PRESENTED, presentation);
        return presentation;
    }

    resolveChoice(eventId, choiceId, publicContext) {
        const def = findGlobalEventChoiceDefinition(eventId);
        if (!def) throw new Error(`GLOBAL_EVENT_CHOICE_UNKNOWN_EVENT:${eventId}`);
        validateContext(def, publicContext);

        const choice = def.choices.find(candidate => candidate.id === choiceId);
        if (!choice) throw new Error(`GLOBAL_EVENT_CHOICE_UNKNOWN_CHOICE:${eventId}:${choiceId}`);

        const result = freezePayload({
            eventId: def.id,
            category: def.category,
            choiceId: choice.id,
            publicContext,
            publicOutcomeTags: choice.publicOutcomeTags || []
        });

        // Trial/Advisor/警戒などはこの公開Factを購読する。
        // 実際の敵反応やhidden state変更は本システムでは決定しない。
        this.factHub?.emit?.(GAME_FACT_TYPES.GLOBAL_EVENT_CHOICE_RESOLVED, result);
        return result;
    }
}

export { FORBIDDEN_PUBLIC_KEYS };

export default GlobalEventChoiceSystem;
