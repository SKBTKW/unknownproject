import { LAND_CARDS_MASTER } from "../game/src/data/land_cards_data.js";
import {
    ECONOMY_CARDS_MASTER,
    MILITARY_CARDS_MASTER,
    MYSTIC_CARDS_MASTER
} from "../game/src/data/command_cards_data.js";
import { INVESTIGATION_CARDS_MASTER } from "../game/src/data/investigation_cards_data.js";
import {
    CARD_RUNTIME_ACTIVE_CATEGORIES,
    isCardRuntimeActive
} from "../game/src/systems/card_runtime_policy.js";
import { RETIRED_TRIAL_RESERVED_CARD_IDS } from "../game/src/systems/card_cycle_system.js";

const retired = new Set(RETIRED_TRIAL_RESERVED_CARD_IDS);

function stage1(cards) {
    return cards.filter(card => Number(card?.minStage ?? 1) <= 1);
}

function summarize(label, cards) {
    const entries = stage1(cards).map(card => ({
        id: card.id,
        runtimeCategory: card.category || "LAND",
        offeringCategory: card?.offering?.category ?? card?.offeringCategory ?? null,
        runtimeActive: isCardRuntimeActive(card),
        retired: retired.has(card.id),
        tags: Array.isArray(card.tags) ? [...card.tags] : []
    }));

    return {
        label,
        count: entries.length,
        active: entries.filter(entry => entry.runtimeActive && !entry.retired).length,
        dormant: entries.filter(entry => !entry.runtimeActive && !entry.retired).length,
        retired: entries.filter(entry => entry.retired).length,
        explicitOfferingCategory: entries.filter(entry => entry.offeringCategory).length,
        entries
    };
}

const groups = [
    summarize("LAND", LAND_CARDS_MASTER),
    summarize("ECONOMY", ECONOMY_CARDS_MASTER),
    summarize("MILITARY", MILITARY_CARDS_MASTER),
    summarize("MYSTIC", MYSTIC_CARDS_MASTER),
    summarize("INVESTIGATION", INVESTIGATION_CARDS_MASTER)
];

const nonLand = groups.filter(group => group.label !== "LAND");
const authoredNonLand = nonLand.reduce((sum, group) => sum + group.count, 0);
const activeNonLand = nonLand.reduce((sum, group) => sum + group.active, 0);
const dormantNonLand = nonLand.reduce((sum, group) => sum + group.dormant, 0);

console.log("STAGE1_OFFERING_CATEGORY_INVENTORY");
console.log(JSON.stringify({
    runtimeActiveCategories: CARD_RUNTIME_ACTIVE_CATEGORIES,
    authoredNonLand,
    activeNonLand,
    dormantNonLand,
    groups
}, null, 2));
