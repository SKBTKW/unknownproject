import assert from "node:assert/strict";
import test from "node:test";

import {
    BOARD_CONTEXT_MODES,
    BOARD_VIEW_MODES,
    BOARD_VIEW_PRESETS,
    BoardPresentationState
} from "./board_presentation_state.js";
import { createBoardPresentationDto } from "./board_presentation_contract.js";

test("viewMode and viewPreset are independent presentation axes", () => {
    for (const viewMode of [BOARD_VIEW_MODES.TWO_D, BOARD_VIEW_MODES.TWO_POINT_FIVE_D]) {
        for (const viewPreset of Object.values(BOARD_VIEW_PRESETS)) {
            const state = new BoardPresentationState({ viewMode, viewPreset });
            assert.equal(state.viewMode, viewMode);
            assert.equal(state.viewPreset, viewPreset);
        }
    }
});

test("changing renderer preserves logical board session state", () => {
    const state = new BoardPresentationState({
        selectedCell: { r: 1, c: 2 },
        hoveredCell: { r: 2, c: 3 },
        focusCell: { r: 3, c: 4 },
        contextMode: BOARD_CONTEXT_MODES.TRIAL,
        viewPreset: BOARD_VIEW_PRESETS.TACTICAL
    });

    state.setViewMode(BOARD_VIEW_MODES.TWO_POINT_FIVE_D);
    assert.deepEqual(state.snapshot(), {
        viewMode: BOARD_VIEW_MODES.TWO_POINT_FIVE_D,
        contextMode: BOARD_CONTEXT_MODES.TRIAL,
        viewPreset: BOARD_VIEW_PRESETS.TACTICAL,
        selectedCell: { r: 1, c: 2 },
        hoveredCell: { r: 2, c: 3 },
        focusCell: { r: 3, c: 4 }
    });
});

test("changing preset preserves renderer context and logical cells", () => {
    const state = new BoardPresentationState({
        viewMode: BOARD_VIEW_MODES.TWO_POINT_FIVE_D,
        contextMode: BOARD_CONTEXT_MODES.TRIAL,
        selectedCell: { r: 4, c: 1 },
        hoveredCell: { r: 4, c: 2 },
        focusCell: { r: 4, c: 3 }
    });

    state.setViewPreset(BOARD_VIEW_PRESETS.DEVELOPMENT);
    assert.equal(state.viewMode, BOARD_VIEW_MODES.TWO_POINT_FIVE_D);
    assert.equal(state.contextMode, BOARD_CONTEXT_MODES.TRIAL);
    assert.deepEqual(state.selectedCell, { r: 4, c: 1 });
    assert.deepEqual(state.hoveredCell, { r: 4, c: 2 });
    assert.deepEqual(state.focusCell, { r: 4, c: 3 });
});

test("legacy renderer aliases remain compatible", () => {
    assert.equal(BOARD_VIEW_MODES.STRATEGIC_2D, BOARD_VIEW_MODES.TWO_D);
    assert.equal(BOARD_VIEW_MODES.WORLD_2_5D, BOARD_VIEW_MODES.TWO_POINT_FIVE_D);

    const state = new BoardPresentationState({
        viewMode: BOARD_VIEW_MODES.STRATEGIC_2D
    });
    state.setViewMode(BOARD_VIEW_MODES.WORLD_2_5D);
    assert.equal(state.viewMode, BOARD_VIEW_MODES.TWO_POINT_FIVE_D);
});

test("BoardPresentation DTO transports viewPreset without renderer coordinates", () => {
    const state = new BoardPresentationState({
        viewMode: BOARD_VIEW_MODES.TWO_D,
        contextMode: BOARD_CONTEXT_MODES.NORMAL,
        viewPreset: BOARD_VIEW_PRESETS.DATA,
        selectedCell: { r: 0, c: 0 }
    });
    const dto = createBoardPresentationDto({
        presentation: state.snapshot(),
        profile: {},
        board: { rows: 0, columns: 0 },
        trial: {},
        cells: []
    });

    assert.equal(dto.presentation.viewMode, "2D");
    assert.equal(dto.presentation.viewPreset, "DATA");
    assert.deepEqual(dto.presentation.selectedCell, { r: 0, c: 0 });
    assert.equal("screenCoordinate" in dto.presentation, false);
    assert.equal("worldCoordinate" in dto.presentation, false);
});

test("invalid viewPreset is rejected", () => {
    assert.throws(
        () => new BoardPresentationState({ viewPreset: "2D_ONLY" }),
        /INVALID_BOARD_VIEW_PRESET:2D_ONLY/
    );

    const state = new BoardPresentationState();
    assert.throws(
        () => state.setViewPreset("WORLD_2_5D"),
        /INVALID_BOARD_VIEW_PRESET:WORLD_2_5D/
    );
});
