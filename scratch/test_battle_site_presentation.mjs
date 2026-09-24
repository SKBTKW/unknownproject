import assert from "node:assert/strict";
import { BoardPresentationState } from "../game/src/presentation/board_presentation_state.js";
import { BoardPresentationDataService } from "../game/src/presentation/board_presentation_data_service.js";
import { createBoardPresentationDto } from "../game/src/presentation/board_presentation_contract.js";
import { resolveBattleSiteMarker } from "../game/src/ui/board_presentation_grid_component.js";
import { Web25DCanvasRenderer } from "../game/src/presentation/web25d_canvas_renderer.js";
import { Web25DProjectionAdapter } from "../game/src/presentation/web25d_projection_adapter.js";

const state = {
    grid: [[{
        r: 0,
        c: 0,
        placed: true,
        isHQ: false,
        terrain: { terrainId: "GL1_PLAINS", category: "LAND", nameKey: "PLAINS" },
        entities: [
            {
                id: "BATTLE_SITE@1@TRIAL_1@0@0@0",
                type: "BATTLE_SITE",
                entityType: "BATTLE_SITE",
                trialIndex: 1,
                scenarioId: "TRIAL_1",
                battleIndex: 0,
                routeId: "ROUTE_A",
                outcome: "REPEL",
                trialOutcome: "SURVIVED",
                settledTurn: 15
            }
        ]
    }]]
};

const cellViewDataService = {
    getCellViewData(source, r, c) {
        const cell = source.grid[r][c];
        return {
            r, c,
            placed: Boolean(cell.placed),
            isHQ: Boolean(cell.isHQ),
            terrainId: cell.terrain?.terrainId || null,
            category: cell.terrain?.category || null,
            nameKey: cell.terrain?.nameKey || null,
            elevation: 1,
            greenery: 1,
            hasSocket: false,
            socketResource: null,
            yields: {},
            baseYields: {},
            productionStatus: null,
            productionScope: null,
            blockProduction: null,
            blockProductionPrimary: false,
            primaryYield: null,
            modifiers: [],
            placementGroupId: null,
            mergeGroupId: null
        };
    }
};

const service = new BoardPresentationDataService({ cellViewDataService });
const readModel = service.getBoard(state, {
    presentationState: new BoardPresentationState()
});

assert.equal(readModel.cells[0][0].history.battleSite, true);
assert.equal(readModel.cells[0][0].history.battleSites.length, 1);
assert.equal(readModel.cells[0][0].history.battleSites[0].routeId, "ROUTE_A");

const dto = createBoardPresentationDto(readModel);
assert.equal(dto.cells[0][0].history.battleSite, true);
assert.equal(dto.cells[0][0].history.battleSites[0].trialIndex, 1);

const marker = resolveBattleSiteMarker(dto.cells[0][0].history);
assert.deepEqual(marker, {
    count: 1,
    trialIndex: 1,
    outcome: "REPEL"
});
assert.equal(resolveBattleSiteMarker({ battleSite: false, battleSites: [] }), null);

class FakeContext2D {
    constructor() {
        this.strokes = 0;
        this.texts = [];
    }
    clearRect() {}
    beginPath() {}
    moveTo() {}
    lineTo() {}
    closePath() {}
    fill() {}
    stroke() { this.strokes += 1; }
    fillText(text) { this.texts.push(String(text)); }
}
class FakeCanvas {
    constructor() {
        this.width = 640;
        this.height = 360;
        this.context = new FakeContext2D();
    }
    getContext() { return this.context; }
    addEventListener() {}
    removeEventListener() {}
    getBoundingClientRect() { return { left: 0, top: 0, width: 640, height: 360 }; }
}
const canvas = new FakeCanvas();
const renderer = new Web25DCanvasRenderer({
    canvas,
    bridge: { dispatch: () => ({ success: true }) },
    projectionAdapter: new Web25DProjectionAdapter({ originX: 320, originY: 70 }),
    showCoordinates: false
});
renderer.setReadModel(dto);
assert.ok(canvas.context.strokes >= 3, "2.5D renderer must draw terrain and Battle Site history strokes");

const cleanState = {
    grid: [[{
        r: 0,
        c: 0,
        placed: true,
        isHQ: false,
        terrain: { terrainId: "GL1_PLAINS", category: "LAND", nameKey: "PLAINS" }
    }]]
};
const cleanReadModel = service.getBoard(cleanState, {
    presentationState: new BoardPresentationState()
});
assert.equal(cleanReadModel.cells[0][0].history.battleSite, false);
assert.deepEqual(cleanReadModel.cells[0][0].history.battleSites, []);

console.log("PASS battle site presentation");
