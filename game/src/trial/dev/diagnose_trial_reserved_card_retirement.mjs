import { CardCycleSystem } from "../../systems/card_cycle_system.js";
import { serializeGameState } from "../../core/state_serializer.js";

const RETIRED = [
    "CMD_MUD_OBSTACLE",
    "CMD_HIGH_GROUND_FORMATION",
    "CMD_CAVALRY_SCOUTS",
    "CMD_OUTPOST_SIGNAL",
    "CMD_BALLISTA_SET",
    "CMD_GUIDED_DEFENSE",
    "CMD_SCOUT_ENEMY",
    "CMD_SCORCHED_RETREAT",
    "CMD_CAVALRY_HOST",
    "CMD_LOCAL_IRON_ARMAMENT",
    "CMD_OMEN_DREAM",
    "CMD_STONE_STRONGPOINT",
    "CMD_GREAT_RAMPART_PROJECT",
    "CMD_OUTPOST"
];

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

const state = { cardCooldowns: {}, consumedUniqueCards: [] };
const cycle = new CardCycleSystem(state, { gameplayRandom: { nextInt: () => 0 } });

for (const id of RETIRED) {
    assert(cycle.isRetiredCard(id), `${id} must be retired`);
    assert(cycle.isInCooldown(id, 9999), `${id} must never become normally eligible`);
}

assert(
    cycle.findMinAvailableTurnCard(RETIRED.map(id => ({ id }))) === null,
    "cooldown fallback must not resurrect retired Trial-reservation cards"
);

const snapshot = serializeGameState({
    grid: [],
    handOffering: [],
    reserveSlots: [null],
    mergeLinks: new Set(),
    grantedConnectionPairs: new Set(),
    nextTrialDamageMitigation: 0.5,
    nextTrialMultiplier: 1.5
});

assert(
    !Object.prototype.hasOwnProperty.call(snapshot, "nextTrialDamageMitigation"),
    "nextTrialDamageMitigation must not be serialized"
);
assert(
    !Object.prototype.hasOwnProperty.call(snapshot, "nextTrialMultiplier"),
    "nextTrialMultiplier must not be serialized"
);

console.log("PASS: retired Trial-reservation cards cannot re-enter Offering or persist Trial modifiers");
