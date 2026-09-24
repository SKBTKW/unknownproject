import assert from "node:assert/strict";
import fs from "node:fs";
import {
    UNITY_RUNTIME_HANDOFF_CONTRACT_VERSION,
    createUnityRuntimeHandoffFrame,
    parseUnityRuntimeHandoffFrame,
    parseUnityBoardInputCommand
} from "../game/src/presentation/unity_runtime_handoff_contract.js";
import {
    BOARD_PRESENTATION_CONTRACT_VERSION,
    parseBoardPresentationDto
} from "../game/src/presentation/board_presentation_contract.js";
import {
    BOARD_INPUT_CONTRACT_VERSION,
    serializeBoardInputCommand
} from "../game/src/presentation/board_input_contract.js";
import {
    GAME_RUNTIME_SNAPSHOT_CONTRACT_VERSION,
    parseGameRuntimeSnapshotDto
} from "../game/src/presentation/game_runtime_snapshot_contract.js";

const readJson = relativePath => JSON.parse(
    fs.readFileSync(new URL(relativePath, import.meta.url), "utf8")
);

const outboundFixture = readJson("./fixtures/unity_runtime_handoff_v1.json");
const inboundFixture = readJson("./fixtures/unity_board_input_select_cell_v1.json");
const manifest = readJson("./fixtures/unity_runtime_contract_manifest_v1.json");

const boardReadModel = {
    presentation: {
        viewMode: "2D",
        contextMode: "NORMAL",
        viewPreset: "DEFAULT",
        selectedCell: { r: 0, c: 0 },
        hoveredCell: null,
        focusCell: null
    },
    profile: {},
    board: { rows: 1, columns: 1 },
    trial: null,
    cells: [[{
        r: 0,
        c: 0,
        placed: true,
        isHQ: true,
        terrainId: "HQ",
        interaction: { selected: true }
    }]]
};

const runtimeReadModel = {
    progression: {
        verse: 7,
        stage: { id: 1, name: "Stage 1", size: 5, maxTiles: 25 }
    },
    board: { rows: 5, columns: 5 },
    resources: {
        ember: { current: 8, max: 12 },
        food: { current: 9 },
        material: { current: 6 },
        defense: { current: 5, max: 5 },
        mystic: { current: 1 }
    }
};

const generated = createUnityRuntimeHandoffFrame({ boardReadModel, runtimeReadModel });
assert.deepEqual(generated, outboundFixture);

const parsedFrame = parseUnityRuntimeHandoffFrame(JSON.stringify(outboundFixture));
assert.equal(parsedFrame.contractVersion, UNITY_RUNTIME_HANDOFF_CONTRACT_VERSION);

const parsedBoard = parseBoardPresentationDto(JSON.stringify(outboundFixture.board));
assert.equal(parsedBoard.contractVersion, BOARD_PRESENTATION_CONTRACT_VERSION);
assert.equal(parsedBoard.cells.length, 1);
assert.equal(parsedBoard.cells[0].length, 1);
assert.deepEqual(parsedBoard.presentation.selectedCell, { r: 0, c: 0 });

const parsedRuntime = parseGameRuntimeSnapshotDto(JSON.stringify(outboundFixture.runtime));
assert.equal(parsedRuntime.contractVersion, GAME_RUNTIME_SNAPSHOT_CONTRACT_VERSION);
assert.equal(parsedRuntime.progression.verse, 7);

const parsedCommand = parseUnityBoardInputCommand(inboundFixture);
assert.equal(parsedCommand.contractVersion, BOARD_INPUT_CONTRACT_VERSION);
assert.equal(parsedCommand.type, "SELECT_CELL");
assert.deepEqual(parsedCommand.payload.cell, { r: 0, c: 0 });
assert.deepEqual(JSON.parse(serializeBoardInputCommand(parsedCommand)), inboundFixture);

assert.equal(manifest.contractVersion, "unity-runtime-fixtures-v1");
assert.equal(manifest.contracts.handoff, UNITY_RUNTIME_HANDOFF_CONTRACT_VERSION);
assert.equal(manifest.contracts.boardPresentation, BOARD_PRESENTATION_CONTRACT_VERSION);
assert.equal(manifest.contracts.boardInput, BOARD_INPUT_CONTRACT_VERSION);
assert.equal(manifest.contracts.gameRuntimeSnapshot, GAME_RUNTIME_SNAPSHOT_CONTRACT_VERSION);
assert.equal(manifest.fixtures.outbound, "unity_runtime_handoff_v1.json");
assert.equal(manifest.fixtures.inbound, "unity_board_input_select_cell_v1.json");

const serializedFixture = JSON.stringify(outboundFixture);
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
    assert.equal(serializedFixture.includes(forbidden), false, `platform leak in Unity fixture: ${forbidden}`);
}

console.log("✅ Unity runtime golden fixtures PASS");
