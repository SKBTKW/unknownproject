import assert from "node:assert/strict";
import { ENEMY_TACTICS, EnemyTacticResolver } from "../systems/enemy_tactic_resolver.js";

const resolver = new EnemyTacticResolver();

function ids(result) {
    return result.tactics.map(item => item.id);
}

const frontal = resolver.resolve({
    terrainId: "GL1_PLAINS",
    force: {
        id: "FORCE_1",
        commander: { level: 2 },
        profile: { bodySize: "LARGE", equipment: ["HEAVY"] }
    },
    armyStructure: { forceCount: 1, commander: { level: 2 } }
});
assert.equal(ids(frontal).includes(ENEMY_TACTICS.FRONTAL_BREAKTHROUGH), true);
assert.equal(ids(frontal).includes(ENEMY_TACTICS.DISPERSED_INFILTRATION), false);

const infiltrators = resolver.resolve({
    terrainId: "GL2_FOREST",
    force: {
        id: "FORCE_1",
        commander: { level: 2 },
        profile: { bodySize: "SMALL", equipment: ["LIGHT"] }
    },
    armyStructure: { forceCount: 1, commander: { level: 2 } }
});
assert.equal(ids(infiltrators).includes(ENEMY_TACTICS.DISPERSED_INFILTRATION), true);
assert.equal(ids(infiltrators).includes(ENEMY_TACTICS.FLANKING), true);
assert.equal(ids(infiltrators).includes(ENEMY_TACTICS.AMBUSH_CAUTION), false);

const veteranForestForce = resolver.resolve({
    terrainId: "GL2_FOREST",
    force: {
        id: "FORCE_1",
        commander: { level: 3 },
        profile: { bodySize: "MEDIUM", equipment: ["STANDARD"] }
    },
    armyStructure: { forceCount: 1, commander: { level: 3 } }
});
assert.equal(ids(veteranForestForce).includes(ENEMY_TACTICS.AMBUSH_CAUTION), true);

const coordinatedArmy = resolver.resolve({
    terrainId: "GL1_PLAINS",
    force: {
        id: "FORCE_1",
        commander: { level: 4 },
        profile: { bodySize: "MEDIUM", equipment: ["STANDARD"] }
    },
    armyStructure: {
        forceCount: 3,
        commander: { level: 4 },
        forces: [{ id: "FORCE_1" }, { id: "FORCE_2" }, { id: "FORCE_3" }]
    }
});
assert.equal(ids(coordinatedArmy).includes(ENEMY_TACTICS.MAIN_FEINT), true);

const lowCommandArmy = resolver.resolve({
    terrainId: "GL1_PLAINS",
    force: {
        id: "FORCE_1",
        commander: { level: 2 },
        profile: { bodySize: "MEDIUM", equipment: ["STANDARD"] }
    },
    armyStructure: {
        forceCount: 3,
        commander: { level: 2 },
        forces: [{ id: "FORCE_1" }, { id: "FORCE_2" }, { id: "FORCE_3" }]
    }
});
assert.equal(ids(lowCommandArmy).includes(ENEMY_TACTICS.MAIN_FEINT), false);

for (const result of [frontal, infiltrators, veteranForestForce, coordinatedArmy, lowCommandArmy]) {
    for (const tactic of result.tactics) {
        assert.equal(Object.prototype.hasOwnProperty.call(tactic, "multiplier"), false);
        assert.equal(Object.prototype.hasOwnProperty.call(tactic, "damage"), false);
    }
}

console.log("diagnose_enemy_tactic_resolver: PASS");
