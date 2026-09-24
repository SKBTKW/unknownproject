import assert from "node:assert/strict";
import fs from "node:fs";
import {
    createUnityRuntimeHandoffFrame,
    parseUnityRuntimeHandoffFrame,
    parseUnityBoardInputCommand
} from "../game/src/presentation/unity_runtime_handoff_contract.js";
import { serializeBoardInputCommand } from "../game/src/presentation/board_input_contract.js";

const readJson = relativePath => JSON.parse(
    fs.readFileSync(new URL(relativePath, import.meta.url), "utf8")
);

const outboundFixture = readJson("./fixtures/unity_trial_runtime_handoff_v1.json");
const inboundMatrix = readJson("./fixtures/unity_trial_board_input_matrix_v1.json");

const candidate = {
    routeId: "route-1",
    cell: { r: 0, c: 1 },
    eligible: true
};
const tacticalEffect = {
    id: "FOREST_AMBUSH",
    cell: { r: 0, c: 1 }
};

const boardReadModel = {
    presentation: {
        viewMode: "2_5D",
        contextMode: "TRIAL",
        viewPreset: "TACTICAL",
        selectedCell: { r: 0, c: 1 },
        hoveredCell: { r: 0, c: 0 },
        focusCell: { r: 0, c: 1 }
    },
    profile: {},
    board: { rows: 1, columns: 2 },
    trial: {
        available: true,
        activeRouteId: "route-1",
        selectedInterceptCell: { r: 0, c: 1 },
        hoveredInterceptCell: { r: 0, c: 0 },
        routes: [{
            routeId: "route-1",
            cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }],
            entryCell: { r: 0, c: 0 },
            entrySide: "W",
            isActive: true
        }],
        interceptionCandidates: [candidate],
        plannedIntercepts: [],
        battleMarkers: [],
        tacticalEffects: [tacticalEffect],
        enemyState: { phase: "PLANNING" }
    },
    cells: [[
        {
            r: 0,
            c: 0,
            placed: true,
            terrainId: "PLAINS",
            interaction: { hovered: true },
            trial: {
                available: true,
                onRoute: true,
                route: {
                    routeId: "route-1",
                    routeIndex: 0,
                    isRouteEntry: true,
                    isRouteEnd: false,
                    routeDirection: "E",
                    isActiveRoute: true
                }
            }
        },
        {
            r: 0,
            c: 1,
            placed: true,
            terrainId: "FOREST",
            interaction: { selected: true, focused: true },
            trial: {
                available: true,
                onRoute: true,
                route: {
                    routeId: "route-1",
                    routeIndex: 1,
                    isRouteEntry: false,
                    isRouteEnd: true,
                    routeDirection: null,
                    isActiveRoute: true
                },
                interceptionCandidate: candidate,
                tacticalEffects: [tacticalEffect]
            }
        }
    ]]
};

const runtimeReadModel = {
    progression: {
        verse: 15,
        stage: { id: 1, name: "Stage 1", size: 5, maxTiles: 25 }
    },
    board: { rows: 5, columns: 5 },
    resources: {
        ember: { current: 7, max: 12 },
        food: { current: 8 },
        material: { current: 5 },
        defense: { current: 4, max: 5 },
        mystic: { current: 1 }
    }
};

const generated = createUnityRuntimeHandoffFrame({ boardReadModel, runtimeReadModel });
assert.deepEqual(generated, outboundFixture);

const parsed = parseUnityRuntimeHandoffFrame(JSON.stringify(outboundFixture));
assert.equal(parsed.board.presentation.viewMode, "2_5D");
assert.equal(parsed.board.presentation.contextMode, "TRIAL");
assert.equal(parsed.board.presentation.viewPreset, "TACTICAL");
assert.equal(parsed.board.trial.activeRouteId, "route-1");
assert.deepEqual(parsed.board.trial.selectedInterceptCell, { r: 0, c: 1 });
assert.deepEqual(parsed.board.trial.hoveredInterceptCell, { r: 0, c: 0 });
assert.equal(parsed.board.trial.routes[0].entrySide, "W");
assert.equal(parsed.board.cells[0][0].trial.route.isRouteEntry, true);
assert.equal(parsed.board.cells[0][1].trial.route.isRouteEnd, true);
assert.deepEqual(parsed.board.cells[0][1].trial.interceptionCandidate, candidate);
assert.deepEqual(parsed.board.cells[0][1].trial.tacticalEffects, [tacticalEffect]);

assert.equal(inboundMatrix.contractVersion, "unity-trial-board-input-fixtures-v1");
assert.deepEqual(
    inboundMatrix.commands.map(command => command.type),
    [
        "SELECT_TRIAL_ROUTE",
        "SELECT_TRIAL_INTERCEPTION",
        "HOVER_TRIAL_INTERCEPTION",
        "CLEAR_TRIAL_HOVER"
    ]
);

for (const fixture of inboundMatrix.commands) {
    const command = parseUnityBoardInputCommand(fixture);
    assert.deepEqual(JSON.parse(serializeBoardInputCommand(command)), fixture);
}

const selectIntercept = parseUnityBoardInputCommand(inboundMatrix.commands[1]);
assert.equal(selectIntercept.payload.routeId, "route-1");
assert.deepEqual(selectIntercept.payload.cell, { r: 0, c: 1 });

const serialized = JSON.stringify(outboundFixture);
for (const forbidden of [
    "HTMLElement",
    "DOMRect",
    "screenX",
    "screenY",
    "clientX",
    "clientY",
    "worldPosition",
    "GameObject",
    "Transform",
    "Sprite"
]) {
    assert.equal(serialized.includes(forbidden), false, `platform leak in Unity Trial fixture: ${forbidden}`);
}

console.log("✅ Unity Trial runtime golden fixtures PASS");
