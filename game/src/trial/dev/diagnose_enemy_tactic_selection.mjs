import assert from "node:assert/strict";
import { ENEMY_TACTICS, EnemyTacticResolver } from "../systems/enemy_tactic_resolver.js";
import { EnemyTacticSelectionResolver } from "../systems/enemy_tactic_selection_resolver.js";

const resolver = new EnemyTacticResolver();
const selector = new EnemyTacticSelectionResolver();

const levelTwoForest = resolver.resolve({
    terrainId: "GL2_FOREST",
    force: {
        id: "FORCE_1",
        commander: { level: 2 },
        profile: { bodySize: "SMALL", equipment: ["LIGHT"] }
    },
    armyStructure: { forceCount: 1, commander: { level: 2 } }
});
const selectedLevelTwo = selector.resolve(levelTwoForest);
assert.equal(selectedLevelTwo.selectedTactic.id, ENEMY_TACTICS.FLANKING);
assert.equal(
    selectedLevelTwo.alternatives.some(item => item.id === ENEMY_TACTICS.DISPERSED_INFILTRATION),
    true
);

const levelThreeForest = resolver.resolve({
    terrainId: "GL2_FOREST",
    force: {
        id: "FORCE_1",
        commander: { level: 3 },
        profile: { bodySize: "SMALL", equipment: ["LIGHT"] }
    },
    armyStructure: { forceCount: 1, commander: { level: 3 } }
});
const selectedLevelThree = selector.resolve(levelThreeForest);
assert.equal(selectedLevelThree.selectedTactic.id, ENEMY_TACTICS.AMBUSH_CAUTION);

const levelFourArmy = resolver.resolve({
    terrainId: "GL2_FOREST",
    force: {
        id: "FORCE_1",
        commander: { level: 4 },
        profile: { bodySize: "SMALL", equipment: ["LIGHT"] }
    },
    armyStructure: {
        forceCount: 3,
        commander: { level: 4 },
        forces: [{ id: "FORCE_1" }, { id: "FORCE_2" }, { id: "FORCE_3" }]
    }
});
const selectedLevelFour = selector.resolve(levelFourArmy);
assert.equal(selectedLevelFour.selectedTactic.id, ENEMY_TACTICS.MAIN_FEINT);
assert.equal(selectedLevelFour.selectionReason, "HIGHEST_PRIORITY_ELIGIBLE");

const none = selector.resolve({ forceId: "FORCE_X", commanderLevel: 1, tactics: [] });
assert.equal(none.selectedTactic, null);
assert.deepEqual(none.alternatives, []);
assert.equal(none.selectionReason, "NO_ELIGIBLE_TACTIC");

for (const selection of [selectedLevelTwo, selectedLevelThree, selectedLevelFour]) {
    assert.equal(Object.prototype.hasOwnProperty.call(selection.selectedTactic, "multiplier"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(selection.selectedTactic, "damage"), false);
}

console.log("diagnose_enemy_tactic_selection: PASS");
