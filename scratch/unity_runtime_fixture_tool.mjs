import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    createUnityRuntimeHandoffFrame
} from "../game/src/presentation/unity_runtime_handoff_contract.js";
import {
    BOARD_INPUT_COMMANDS,
    createBoardInputCommand
} from "../game/src/presentation/board_input_contract.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.join(HERE, "fixtures");

const jsonText = value => JSON.stringify(value, null, 2) + "\n";

function normalReadModels() {
    return {
        boardReadModel: {
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
        },
        runtimeReadModel: {
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
        }
    };
}

function trialReadModels() {
    const candidate = {
        routeId: "route-1",
        cell: { r: 0, c: 1 },
        eligible: true
    };
    const tacticalEffect = {
        id: "FOREST_AMBUSH",
        cell: { r: 0, c: 1 }
    };

    return {
        boardReadModel: {
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
        },
        runtimeReadModel: {
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
        }
    };
}

export function buildUnityRuntimeFixtureSet() {
    const normal = normalReadModels();
    const trial = trialReadModels();

    const normalInput = createBoardInputCommand(
        BOARD_INPUT_COMMANDS.SELECT_CELL,
        { cell: { r: 0, c: 0 } }
    );

    const trialCommands = [
        createBoardInputCommand(
            BOARD_INPUT_COMMANDS.SELECT_TRIAL_ROUTE,
            { routeId: "route-1" }
        ),
        createBoardInputCommand(
            BOARD_INPUT_COMMANDS.SELECT_TRIAL_INTERCEPTION,
            { routeId: "route-1", cell: { r: 0, c: 1 } }
        ),
        createBoardInputCommand(
            BOARD_INPUT_COMMANDS.HOVER_TRIAL_INTERCEPTION,
            { routeId: "route-1", cell: { r: 0, c: 0 } }
        ),
        createBoardInputCommand(
            BOARD_INPUT_COMMANDS.CLEAR_TRIAL_HOVER,
            {}
        )
    ];

    const manifest = {
        contractVersion: "unity-runtime-fixtures-v1",
        encoding: "utf-8-json",
        direction: {
            outbound: "JavaScript runtime -> Unity",
            inbound: "Unity -> JavaScript/runtime command boundary"
        },
        contracts: {
            handoff: "unity-runtime-handoff-v1",
            boardPresentation: "board-presentation-v1",
            boardInput: "board-input-v1",
            gameRuntimeSnapshot: "game-runtime-snapshot-v1"
        },
        fixtures: {
            outbound: "unity_runtime_handoff_v1.json",
            inbound: "unity_board_input_select_cell_v1.json",
            trialOutbound: "unity_trial_runtime_handoff_v1.json",
            trialInbound: "unity_trial_board_input_matrix_v1.json"
        },
        invariants: [
            "board.cells is a row-major nested array",
            "cell references use logical integer r/c only",
            "payloads contain no DOM, screen-space, world-space, GameObject, Transform, or Sprite data",
            "unknown contract versions must fail closed",
            "Trial fixtures preserve logical route/interception semantics without renderer coordinates"
        ]
    };

    return Object.freeze({
        "unity_runtime_handoff_v1.json": createUnityRuntimeHandoffFrame(normal),
        "unity_board_input_select_cell_v1.json": normalInput,
        "unity_trial_runtime_handoff_v1.json": createUnityRuntimeHandoffFrame(trial),
        "unity_trial_board_input_matrix_v1.json": {
            contractVersion: "unity-trial-board-input-fixtures-v1",
            commands: trialCommands
        },
        "unity_runtime_contract_manifest_v1.json": manifest
    });
}

export function checkUnityRuntimeFixtures({ fixtureDir = FIXTURE_DIR } = {}) {
    const expected = buildUnityRuntimeFixtureSet();
    const mismatches = [];

    for (const [filename, value] of Object.entries(expected)) {
        const filePath = path.join(fixtureDir, filename);
        const actual = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
        const expectedText = jsonText(value);
        if (actual !== expectedText) {
            mismatches.push(filename);
        }
    }

    return Object.freeze({
        ok: mismatches.length === 0,
        mismatches: Object.freeze(mismatches)
    });
}

export function writeUnityRuntimeFixtures({ fixtureDir = FIXTURE_DIR } = {}) {
    fs.mkdirSync(fixtureDir, { recursive: true });
    const expected = buildUnityRuntimeFixtureSet();

    for (const [filename, value] of Object.entries(expected)) {
        fs.writeFileSync(path.join(fixtureDir, filename), jsonText(value), "utf8");
    }

    return Object.freeze({ written: Object.keys(expected).length });
}

function main() {
    const mode = process.argv.includes("--write") ? "write" : "check";

    if (mode === "write") {
        const result = writeUnityRuntimeFixtures();
        console.log(`✅ Unity runtime fixtures regenerated: ${result.written} files`);
        return;
    }

    const result = checkUnityRuntimeFixtures();
    if (!result.ok) {
        console.error(`❌ Unity runtime fixture drift: ${result.mismatches.join(", ")}`);
        console.error("   Run: node scratch/unity_runtime_fixture_tool.mjs --write");
        process.exit(1);
    }

    console.log("✅ Unity runtime fixture drift check PASS");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main();
}
