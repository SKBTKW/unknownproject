import assert from "node:assert/strict";
import { TrialIngressResolver } from "../scenario/trial_ingress_resolver.js";

function cell(r, c, terrainId = "GL1_PLAINS", placed = false) {
    return {
        r,
        c,
        placed,
        isHQ: false,
        terrain: terrainId ? { id: terrainId } : null
    };
}

function buildGrid(size = 5) {
    return Array.from({ length: size }, (_, r) =>
        Array.from({ length: size }, (_, c) => cell(r, c))
    );
}

const grid = buildGrid();
grid[0][2] = cell(0, 2, "E3_MOUNTAIN", true);
grid[2][2] = { ...cell(2, 2, "HQ", true), isHQ: true };
grid[4][1] = cell(4, 1, "GL2_FOREST", true);

const gameState = {
    grid,
    // Coexisting Warning/Intel data must not affect truth ingress resolution.
    warningState: "IMMINENT",
    intel: {
        knownDirections: ["NORTH"],
        confidence: 999
    }
};

const candidateResolver = new TrialIngressResolver();
const candidates = candidateResolver.listCandidates({ gameState, trialIndex: 1 });

assert.equal(candidates.some(entry => entry.r === 0 && entry.c === 2), false, "mountain perimeter cell must not be a normal-route ingress candidate");
assert.equal(candidates.some(entry => entry.r === 4 && entry.c === 1), true, "legal placed perimeter cell must remain eligible");
assert.equal(candidates.some(entry => entry.r === 0 && entry.c === 1), true, "legal unplaced perimeter cell must remain eligible until route rules say otherwise");

const corner = candidates.find(entry => entry.r === 0 && entry.c === 0);
assert.deepEqual(corner.edges, ["NORTH", "WEST"], "corner ingress candidate must preserve both edge identities");

// No default selection policy: unresolved design must not silently become a one-route rule.
assert.deepEqual(candidateResolver.resolve({ gameState, trialIndex: 1 }), []);

const resolver = new TrialIngressResolver({
    selector: ({ candidates: available }) => [
        available.find(entry => entry.r === 4 && entry.c === 1),
        available.find(entry => entry.r === 0 && entry.c === 0),
        available.find(entry => entry.r === 4 && entry.c === 1), // duplicate must collapse
        { id: "INGRESS_0_2" } // mountain / illegal candidate must be ignored
    ]
});

const resolved = resolver.resolve({ gameState, trialIndex: 2 });
assert.deepEqual(
    resolved.map(entry => entry.id),
    ["INGRESS_4_1", "INGRESS_0_0"]
);
assert.equal(resolved[0].terrainId, "GL2_FOREST");
assert.equal(resolved[0].placed, true);

// Intel must not steer truth data: changing it does not change selector output/candidate legality.
gameState.intel = { knownDirections: ["SOUTH"], confidence: 0 };
assert.deepEqual(
    resolver.resolve({ gameState, trialIndex: 2 }).map(entry => entry.id),
    ["INGRESS_4_1", "INGRESS_0_0"]
);

console.log("diagnose_trial_ingress_resolver: PASS");
