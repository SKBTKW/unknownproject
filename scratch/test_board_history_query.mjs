import assert from "node:assert/strict";
import { BoardHistoryQuery } from "../game/src/core/board_history_query.js";
import { RunHistoryReadModel } from "../game/src/systems/run_history_read_model.js";

const state = {
    grid: [
        [
            {
                placed: true,
                terrain: { terrainId: "GL1_PLAINS" },
                entity: {
                    type: "BATTLE_SITE",
                    trialIndex: 1,
                    scenarioId: "TRIAL_1",
                    outcome: "REPEL",
                    damaged: true
                }
            },
            {
                placed: true,
                terrain: { terrainId: "E2_HILL" },
                specialBlock: { type: "WATCHTOWER" }
            }
        ],
        [
            {
                placed: true,
                terrain: { terrainId: "GL2_FOREST" },
                entities: [
                    {
                        id: "BATTLE_SITE@1:0",
                        trialIndex: 2,
                        scenarioId: "TRIAL_2",
                        outcome: "BREAKTHROUGH",
                        damaged: false
                    }
                ]
            }
        ]
    ]
};

const query = new BoardHistoryQuery({ state });

assert.equal(query.hasBattleSite(), true);
assert.equal(query.hasBattleSite({ minimum: 2 }), true);
assert.equal(query.hasBattleSite({ minimum: 3 }), false);
assert.equal(query.hasBattleSite({ trialIndex: 1 }), true);
assert.equal(query.hasBattleSite({ trialIndex: 3 }), false);
assert.equal(query.hasBattleSite({ scenarioId: "TRIAL_2" }), true);
assert.equal(query.hasBattleSite({ outcome: "REPEL" }), true);
assert.equal(query.hasBattleSite({ outcome: "FAILED" }), false);
assert.equal(query.hasBattleSite({ damaged: true }), true);
assert.equal(query.hasBattleSite({ damaged: false }), true);

const sites = query.getBattleSites();
assert.equal(sites.length, 2);
assert.throws(() => {
    sites[0].trialIndex = 99;
}, TypeError);
assert.equal(query.hasBattleSite({ trialIndex: 1 }), true);

const history = new RunHistoryReadModel({
    chronicleSystem: { getAllEvents: () => [] },
    boardHistoryQuery: query
});

assert.equal(
    history.matches({ historyType: "HAS_BATTLE_SITE", trialIndex: 2 }),
    true
);
assert.equal(
    history.matches({ historyType: "HAS_BATTLE_SITE", trialIndex: 3 }),
    false
);

// A Chronicle Trial record alone must not fabricate a Board battle site.
const noBoardSiteHistory = new RunHistoryReadModel({
    chronicleSystem: {
        getAllEvents: () => [{
            type: "TRIAL_RESULT",
            meta: { outcome: "SURVIVED" }
        }]
    },
    boardHistoryQuery: new BoardHistoryQuery({ state: { grid: [] } })
});
assert.equal(noBoardSiteHistory.hasSurvivedTrial(), true);
assert.equal(noBoardSiteHistory.hasBattleSite(), false);

console.log("PASS board history query");
