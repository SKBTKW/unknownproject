import {
    GLOBAL_EVENT_CAPTURE_ZONES,
    GLOBAL_EVENT_CIVILIAN_MOODS,
    GLOBAL_EVENT_VISIBLE_FACTS,
    GLOBAL_EVENT_CHOICE_IDS
} from "../data/global_event_choices.js";

function nextFloat(randomSource) {
    return randomSource?.nextFloat?.() ?? Math.random();
}

function pick(items, randomSource) {
    const index = Math.min(items.length - 1, Math.floor(nextFloat(randomSource) * items.length));
    return items[Math.max(0, index)];
}

export function createGlobalEventChoicePublicContext(eventId, { state = null, randomSource = null } = {}) {
    if (eventId !== GLOBAL_EVENT_CHOICE_IDS.CAPTURED_SCOUT) {
        throw new Error(`GLOBAL_EVENT_CHOICE_CONTEXT_UNSUPPORTED:${eventId}`);
    }

    const stage = Math.max(1, Number(state?.stage?.id) || 1);
    const zones = stage >= 3
        ? [GLOBAL_EVENT_CAPTURE_ZONES.MID, GLOBAL_EVENT_CAPTURE_ZONES.INNER, GLOBAL_EVENT_CAPTURE_ZONES.OUTER]
        : [GLOBAL_EVENT_CAPTURE_ZONES.OUTER, GLOBAL_EVENT_CAPTURE_ZONES.MID, GLOBAL_EVENT_CAPTURE_ZONES.OUTER];
    const facts = [
        GLOBAL_EVENT_VISIBLE_FACTS.LIGHTLY_EQUIPPED,
        GLOBAL_EVENT_VISIBLE_FACTS.WOUNDED,
        GLOBAL_EVENT_VISIBLE_FACTS.EXPERIENCED_SCOUT,
        GLOBAL_EVENT_VISIBLE_FACTS.MAP_FRAGMENT_FOUND,
        GLOBAL_EVENT_VISIBLE_FACTS.NEAR_MAIN_ROAD,
        GLOBAL_EVENT_VISIBLE_FACTS.WATCHTOWER_SEEN
    ];
    const primary = pick(facts, randomSource);
    const visibleFacts = [primary];
    if (nextFloat(randomSource) < 0.35) {
        visibleFacts.push(pick(facts.filter(fact => fact !== primary), randomSource));
    }

    const ember = Number(state?.ember);
    const maxEmber = Math.max(1, Number(state?.maxEmber) || 20);
    const civilianMood = Number.isFinite(ember) && ember / maxEmber <= 0.45
        ? GLOBAL_EVENT_CIVILIAN_MOODS.UNEASY
        : pick([
            GLOBAL_EVENT_CIVILIAN_MOODS.CALM,
            GLOBAL_EVENT_CIVILIAN_MOODS.CALM,
            GLOBAL_EVENT_CIVILIAN_MOODS.ANGRY
        ], randomSource);

    return Object.freeze({
        captureZone: pick(zones, randomSource),
        visibleFacts: Object.freeze(visibleFacts),
        civilianMood
    });
}

export default createGlobalEventChoicePublicContext;
