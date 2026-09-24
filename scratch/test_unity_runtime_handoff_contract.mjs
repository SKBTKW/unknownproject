import assert from "node:assert/strict";
import {
    UNITY_RUNTIME_HANDOFF_CONTRACT_VERSION,
    createUnityRuntimeHandoffFrame,
    serializeUnityRuntimeHandoffFrame,
    parseUnityRuntimeHandoffFrame,
    parseUnityBoardInputCommand
} from "../game/src/presentation/unity_runtime_handoff_contract.js";
import { BOARD_PRESENTATION_CONTRACT_VERSION } from "../game/src/presentation/board_presentation_contract.js";
import {
    BOARD_INPUT_CONTRACT_VERSION,
    BOARD_INPUT_COMMANDS,
    createBoardInputCommand,
    serializeBoardInputCommand
} from "../game/src/presentation/board_input_contract.js";
import { GAME_RUNTIME_SNAPSHOT_CONTRACT_VERSION } from "../game/src/presentation/game_runtime_snapshot_contract.js";

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

const frame = createUnityRuntimeHandoffFrame({ boardReadModel, runtimeReadModel });
assert.equal(frame.contractVersion, UNITY_RUNTIME_HANDOFF_CONTRACT_VERSION);
assert.equal(frame.contracts.boardPresentation, BOARD_PRESENTATION_CONTRACT_VERSION);
assert.equal(frame.contracts.boardInput, BOARD_INPUT_CONTRACT_VERSION);
assert.equal(frame.contracts.gameRuntimeSnapshot, GAME_RUNTIME_SNAPSHOT_CONTRACT_VERSION);
assert.equal(frame.board.contractVersion, BOARD_PRESENTATION_CONTRACT_VERSION);
assert.equal(frame.runtime.contractVersion, GAME_RUNTIME_SNAPSHOT_CONTRACT_VERSION);

const serialized = serializeUnityRuntimeHandoffFrame({ boardReadModel, runtimeReadModel });
const parsed = parseUnityRuntimeHandoffFrame(serialized);
assert.deepEqual(parsed.board.presentation.selectedCell, { r: 0, c: 0 });
assert.equal(parsed.runtime.progression.verse, 7);

for (const forbidden of [
    "HTMLElement",
    "DOMRect",
    "screenX",
    "screenY",
    "worldPosition",
    "GameObject",
    "Transform",
    "Sprite"
]) {
    assert.equal(serialized.includes(forbidden), false, `renderer/platform field leaked: ${forbidden}`);
}

const command = createBoardInputCommand(
    BOARD_INPUT_COMMANDS.SELECT_CELL,
    { cell: { r: 0, c: 0 } }
);
const parsedCommand = parseUnityBoardInputCommand(serializeBoardInputCommand(command));
assert.equal(parsedCommand.contractVersion, BOARD_INPUT_CONTRACT_VERSION);
assert.equal(parsedCommand.type, BOARD_INPUT_COMMANDS.SELECT_CELL);
assert.deepEqual(parsedCommand.payload.cell, { r: 0, c: 0 });

const tampered = JSON.parse(serialized);
tampered.contracts.boardPresentation = "board-presentation-v999";
assert.throws(
    () => parseUnityRuntimeHandoffFrame(JSON.stringify(tampered)),
    /UNSUPPORTED_UNITY_BOARD_PRESENTATION_CONTRACT/
);

const tamperedPayload = JSON.parse(serialized);
tamperedPayload.runtime.contractVersion = "game-runtime-snapshot-v999";
assert.throws(
    () => parseUnityRuntimeHandoffFrame(JSON.stringify(tamperedPayload)),
    /UNSUPPORTED_UNITY_RUNTIME_PAYLOAD/
);

console.log("✅ Unity runtime handoff contract PASS");
