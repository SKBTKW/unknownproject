import {
    BOARD_PRESENTATION_CONTRACT_VERSION,
    createBoardPresentationDto
} from './board_presentation_contract.js';
import {
    BOARD_INPUT_CONTRACT_VERSION,
    parseBoardInputCommand
} from './board_input_contract.js';
import {
    GAME_RUNTIME_SNAPSHOT_CONTRACT_VERSION,
    createGameRuntimeSnapshotDto
} from './game_runtime_snapshot_contract.js';

export const UNITY_RUNTIME_HANDOFF_CONTRACT_VERSION = 'unity-runtime-handoff-v1';

function assertFrameVersion(parsed) {
    if (parsed?.contractVersion !== UNITY_RUNTIME_HANDOFF_CONTRACT_VERSION) {
        throw new Error(`UNSUPPORTED_UNITY_RUNTIME_HANDOFF_CONTRACT:${parsed?.contractVersion ?? 'null'}`);
    }
    if (parsed?.contracts?.boardPresentation !== BOARD_PRESENTATION_CONTRACT_VERSION) {
        throw new Error(`UNSUPPORTED_UNITY_BOARD_PRESENTATION_CONTRACT:${parsed?.contracts?.boardPresentation ?? 'null'}`);
    }
    if (parsed?.contracts?.boardInput !== BOARD_INPUT_CONTRACT_VERSION) {
        throw new Error(`UNSUPPORTED_UNITY_BOARD_INPUT_CONTRACT:${parsed?.contracts?.boardInput ?? 'null'}`);
    }
    if (parsed?.contracts?.gameRuntimeSnapshot !== GAME_RUNTIME_SNAPSHOT_CONTRACT_VERSION) {
        throw new Error(`UNSUPPORTED_UNITY_GAME_RUNTIME_CONTRACT:${parsed?.contracts?.gameRuntimeSnapshot ?? 'null'}`);
    }
    if (parsed?.board?.contractVersion !== BOARD_PRESENTATION_CONTRACT_VERSION) {
        throw new Error(`UNSUPPORTED_UNITY_BOARD_PAYLOAD:${parsed?.board?.contractVersion ?? 'null'}`);
    }
    if (parsed?.runtime?.contractVersion !== GAME_RUNTIME_SNAPSHOT_CONTRACT_VERSION) {
        throw new Error(`UNSUPPORTED_UNITY_RUNTIME_PAYLOAD:${parsed?.runtime?.contractVersion ?? 'null'}`);
    }
}

export function createUnityRuntimeHandoffFrame({
    boardReadModel,
    runtimeReadModel
} = {}) {
    if (!boardReadModel) throw new Error('UNITY_BOARD_READ_MODEL_REQUIRED');
    if (!runtimeReadModel) throw new Error('UNITY_RUNTIME_READ_MODEL_REQUIRED');

    const frame = {
        contractVersion: UNITY_RUNTIME_HANDOFF_CONTRACT_VERSION,
        contracts: {
            boardPresentation: BOARD_PRESENTATION_CONTRACT_VERSION,
            boardInput: BOARD_INPUT_CONTRACT_VERSION,
            gameRuntimeSnapshot: GAME_RUNTIME_SNAPSHOT_CONTRACT_VERSION
        },
        board: createBoardPresentationDto(boardReadModel),
        runtime: createGameRuntimeSnapshotDto(runtimeReadModel)
    };

    assertFrameVersion(frame);
    return Object.freeze(frame);
}

export function serializeUnityRuntimeHandoffFrame(input) {
    return JSON.stringify(createUnityRuntimeHandoffFrame(input));
}

export function parseUnityRuntimeHandoffFrame(serialized) {
    if (typeof serialized !== 'string') throw new Error('UNITY_RUNTIME_HANDOFF_SERIALIZED_STRING_REQUIRED');
    const parsed = JSON.parse(serialized);
    assertFrameVersion(parsed);
    return parsed;
}

export function parseUnityBoardInputCommand(input) {
    return parseBoardInputCommand(input);
}

export default createUnityRuntimeHandoffFrame;
