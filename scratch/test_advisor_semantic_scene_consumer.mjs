import assert from "node:assert/strict";
import { AdvisorEventBridge } from "../game/src/ui/advisor/advisor_event_bridge.js";
import { ADVISOR_EVENTS } from "../game/src/ui/advisor/advisor_dialogue_database.js";

console.log("\nAdvisor Semantic Scene Consumer tests");
let passed = 0;
function check(condition, message) {
    assert.ok(condition, message);
    passed += 1;
    console.log(`  PASS: ${message}`);
}

const emitted = [];
let enabled = true;
const dialogue = {
    emit: () => false,
    emitTopic: result => { emitted.push(result); return true; }
};
const bridge = new AdvisorEventBridge(dialogue, null, {
    profile: { policy: { development: 4, connection: 4, defense: 1 } },
    enabledProvider: () => enabled
});

bridge.setSnapshotMilestonesEnabled(false);
bridge.observeSnapshot({ turn: 1, trialActive: false, state: {}, zoneCount: 0, linkCount: 0 });

check(
    bridge.consumeSemanticScene({
        sceneId: "ZONE_COMPLETED",
        verse: 1,
        context: { mergeType: "2x2", terrainId: "E1_PLAINS" }
    }),
    "ZONE_COMPLETED Semantic Sceneを既存Adviceへ渡せる"
);
check(emitted.at(-1)?.id === ADVISOR_EVENTS.ZONE_COMPLETED, "Semantic SceneをFIRST_*へ再変換しない");
check(bridge.runtime.firstZoneReacted === true, "legacy zone初回状態を消費済みに同期する");

const afterZone = emitted.length;
bridge.observeSnapshot({ turn: 1, trialActive: false, state: {}, zoneCount: 1, linkCount: 0 });
check(emitted.length === afterZone, "Semantic Scene ownership中はsnapshot milestoneを抑止する");

check(
    bridge.consumeSemanticScene({
        sceneId: "FIRST_RUN_TRIAL_ROUTE",
        verse: 15,
        context: { trialIndex: 1 }
    }),
    "FirstRun Trial route Sceneはmandatory dutyとして低defense policyでも発話できる"
);
check(emitted.at(-1)?.id === ADVISOR_EVENTS.FIRST_RUN_TRIAL_ROUTE, "FirstRun route Sceneを専用Advisor eventへ渡す");
check(emitted.at(-1)?.mandatory === true, "FirstRun Trial duty Sceneはmandatory意味を保持する");

check(
    bridge.consumeSemanticScene({
        sceneId: "FIRST_RUN_TRIAL_CAUSALITY",
        verse: 15,
        context: {
            trialIndex: 1,
            battleIndex: 0,
            causality: {
                available: true,
                modifiers: [{ source: "FOREST_DEPLOYMENT", target: "ENEMY_SUPPRESSION", before: 100, after: 70 }]
            }
        }
    }),
    "FirstRun Trial causality Sceneは確定済み結果の説明Dutyとして発話できる"
);
check(emitted.at(-1)?.id === ADVISOR_EVENTS.FIRST_RUN_TRIAL_CAUSALITY, "FirstRun causality Sceneを専用Advisor eventへ渡す");
check(emitted.at(-1)?.mandatory === true, "FirstRun causality Sceneもmandatory意味を保持する");
check(emitted.at(-1)?.context?.causality?.available === true, "FirstRun causality Sceneは確定済み因果contextを保持する");

enabled = false;
check(
    bridge.consumeSemanticScene({ sceneId: "LINK_COMPLETED", verse: 1, context: { linkCount: 1 } }) === false,
    "Advisor OFFではScene occurrenceと独立して発話しない"
);
check(bridge.runtime.firstLinkReacted === true, "Advisor OFFでもlegacy link初回状態を消費済みに同期する");
check(
    bridge.consumeSemanticScene({ sceneId: "OMEN", verse: 1, context: { eventId: "OMEN_TEST" } }) === false,
    "未割当Sceneは別の意味へ推測変換しない"
);

bridge.destroy();
console.log(`Advisor Semantic Scene Consumer: ${passed}/${passed} PASS`);
