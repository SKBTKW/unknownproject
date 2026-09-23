import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BoardDomainAdapter } from "../game/src/core/board_domain_adapter.js";
import { BOARD_CAPABILITIES } from "../game/src/core/special_block_domain.js";
import { DeploymentOriginResolver } from "../game/src/trial/domain/deployment_origin_resolver.js";

function makeState() {
    return {
        grid: [
            [
                {
                    r: 0,
                    c: 0,
                    placed: true,
                    isHQ: true,
                    terrain: { terrainId: "HQ", e: 0, gl: 0 }
                },
                {
                    r: 0,
                    c: 1,
                    placed: true,
                    isHQ: false,
                    terrain: { terrainId: "E1_PLAINS", e: 1, gl: 0 }
                }
            ],
            [
                {
                    r: 1,
                    c: 0,
                    placed: true,
                    isHQ: false,
                    terrain: { terrainId: "E1_PLAINS", e: 1, gl: 0 }
                },
                {
                    r: 1,
                    c: 1,
                    placed: true,
                    isHQ: false,
                    terrain: { terrainId: "E2_HILL", e: 2, gl: 0 }
                }
            ]
        ]
    };
}

function makeSpecialBlockService() {
    return {
        readCapabilities() {
            return new Set();
        },
        readTrialTraits() {
            return null;
        }
    };
}

{
    assert.equal(
        BOARD_CAPABILITIES.REINFORCEMENT_ORIGIN,
        "REINFORCEMENT_ORIGIN"
    );
    assert.equal(
        BOARD_CAPABILITIES.DEFENSE_ANCHOR,
        "DEFENSE_ANCHOR"
    );
}

{
    const state = makeState();
    const semanticSource = {
        readCellDeploymentSemantics({ r, c }) {
            if (r === 1 && c === 1) {
                return {
                    capabilities: [BOARD_CAPABILITIES.DEFENSE_ANCHOR],
                    trialTraits: { fieldwork: true }
                };
            }
            return null;
        },
        listDeploymentOrigins() {
            return [{
                id: "ZONE_ORIGIN:alpha",
                kind: BOARD_CAPABILITIES.REINFORCEMENT_ORIGIN,
                cell: { r: 1, c: 0 },
                capabilities: [BOARD_CAPABILITIES.REINFORCEMENT_ORIGIN],
                trialTraits: {
                    reinforcementOrigin: true,
                    logisticsFoodDelta: 1
                }
            }];
        }
    };

    const board = new BoardDomainAdapter({
        state,
        specialBlockService: makeSpecialBlockService(),
        trialDeploymentSemanticSource: semanticSource
    });

    const facts = board.readTrialDeploymentFacts({ r: 1, c: 1 });
    assert.equal(
        facts.capabilities.includes(BOARD_CAPABILITIES.DEFENSE_ANCHOR),
        true
    );
    assert.equal(facts.trialTraits.fieldwork, true);

    const origins = board.listTrialDeploymentOrigins();
    assert.equal(origins.length, 2, "HQ + semantic reinforcement origin");
    const origin = origins.find(item => item.kind === BOARD_CAPABILITIES.REINFORCEMENT_ORIGIN);
    assert.ok(origin);
    assert.equal(origin.id, "ZONE_ORIGIN:alpha");
    assert.deepEqual(origin.cell, { r: 1, c: 0 });
    assert.equal(
        origin.capabilities.includes(BOARD_CAPABILITIES.REINFORCEMENT_ORIGIN),
        true
    );

    const resolver = new DeploymentOriginResolver({ boardQuery: board });
    const selected = resolver.chooseOrigin({ target: { r: 1, c: 1 } });
    assert.equal(selected.success, true);
    assert.equal(selected.origin.id, "ZONE_ORIGIN:alpha");
    assert.equal(selected.distance, 1);
}

{
    const state = makeState();
    const malformedSource = {
        listDeploymentOrigins() {
            return [
                { id: "NO_CELL", capabilities: [BOARD_CAPABILITIES.REINFORCEMENT_ORIGIN] },
                { id: "NO_CAP", cell: { r: 1, c: 0 }, capabilities: [] }
            ];
        }
    };
    const board = new BoardDomainAdapter({
        state,
        specialBlockService: makeSpecialBlockService(),
        trialDeploymentSemanticSource: malformedSource
    });
    const origins = board.listTrialDeploymentOrigins();
    assert.equal(origins.length, 1, "malformed semantic origins fail closed; HQ remains");
    assert.equal(origins[0].kind, "HQ");
}

{
    const boardSource = readFileSync(
        new URL("../game/src/core/board_domain_adapter.js", import.meta.url),
        "utf8"
    );
    const trialSource = readFileSync(
        new URL("../game/src/trial/domain/deployment_origin_resolver.js", import.meta.url),
        "utf8"
    );

    assert.equal(/GARRISON/.test(boardSource), false);
    assert.equal(/GARRISON/.test(trialSource), false);
    assert.equal(/mergeGroupId/.test(trialSource), false);
    assert.equal(/conversion\.definitionId/.test(trialSource), false);
}

console.log("test_board_trial_deployment_semantics: PASS");
