import assert from "node:assert/strict";
import { AdvisorDialogueSystem } from "../game/src/ui/advisor/advisor_dialogue_system.js";
import { DEFAULT_ADVISOR_PROFILE } from "../game/src/ui/advisor/advisor_profiles.js";
import { ADVISOR_EVENTS } from "../game/src/ui/advisor/advisor_dialogue_database.js";
import { AdvisorEventBridge } from "../game/src/ui/advisor/advisor_event_bridge.js";
import { resolveAdvisorStatus } from "../game/src/ui/advisor/advisor_status_resolver.js";
import { resolveAdvisorAdvice } from "../game/src/ui/advisor/advisor_advice_resolver.js";
import { getAdvisorRecords } from "../game/src/ui/advisor/advisor_record_adapter.js";
import { GameFactHub, GAME_FACT_TYPES } from "../game/src/core/game_fact.js";

console.log("\nAdvisor Foundation tests");
let passed = 0;
function check(condition, message) {
    assert.ok(condition, message);
    passed += 1;
    console.log(`  PASS: ${message}`);
}

let now = 1000;
let nextTimer = 0;
const timers = new Map();
const dialogue = new AdvisorDialogueSystem({
    profile: DEFAULT_ADVISOR_PROFILE,
    translate: (key, params = {}) => `${key}:${params.turn ?? ""}`,
    now: () => now,
    setTimer: callback => { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimer: id => timers.delete(id)
});
const displayed = [];
dialogue.subscribe(item => displayed.push(item?.event || null));
check(dialogue.emit(ADVISOR_EVENTS.GAME_START, { turn: 2 }), "eventから発言候補を表示する");
check(dialogue.current.event === ADVISOR_EVENTS.GAME_START, "現在の発言を保持する");
check(!dialogue.emit(ADVISOR_EVENTS.GAME_START, { turn: 2 }), "cooldown中の同一eventを抑止する");
check(dialogue.emit(ADVISOR_EVENTS.TRIAL_START), "高priority発言を受理する");
check(dialogue.current.event === ADVISOR_EVENTS.TRIAL_START, "高priority発言が現在表示を更新する");
dialogue.emit(ADVISOR_EVENTS.GAME_START, { turn: 3 });
check(dialogue.queue.length === 0, "cooldown対象をqueueへ重複追加しない");
now += 3000;
check(dialogue.emit(ADVISOR_EVENTS.STABLE_OVERALL, { turn: 4 }), "低priority発言をqueueへ追加できる");
check(dialogue.queue.length === 1, "低priority発言をqueueに保持する");
dialogue.dismiss();
check(dialogue.current.event === ADVISOR_EVENTS.STABLE_OVERALL, "dismiss後にqueueの次発言を表示する");

const hub = new GameFactHub();
const bridge = new AdvisorEventBridge(dialogue, hub);
bridge.observeSnapshot({ turn: 1, trialActive: false, trialRemaining: 4 });
bridge.observeSnapshot({ turn: 2, trialActive: false, trialRemaining: 1 });
check(displayed.includes(ADVISOR_EVENTS.TRIAL_WARNING), "公開snapshotからTrial警告へ橋渡しする");
hub.emit(GAME_FACT_TYPES.TRIAL_PLAN_CONFIRMED, { routes: 2 });
check(dialogue.queue.some(item => item.event === ADVISOR_EVENTS.TRIAL_PLAN_CONFIRMED), "公開GameFactをAdvisor eventへ橋渡しする");

const state = {
    turn: 4,
    nextTrialTurn: 5,
    trialSchedule: { warningDuration: 5 },
    mergedBlocks: { zoneA: {} },
    mergeLinks: new Set(["a::b"]),
    reserveSlots: [{ id: "card" }],
    gameLogs: ["[T4] LOG_TEST", "plain"],
    emberSystem: { getStatus: () => "STANDARD" }
};
const status = resolveAdvisorStatus(state, {});
check(status.urgency[0].key === "UI_ADVISOR_STATUS_TRIAL_WARNING", "状況ResolverがTrial接近を優先する");
check([...status.urgency, ...status.status, ...status.outlook].length <= 5, "状況要約を最大5項目に制限する");
const advice = resolveAdvisorAdvice(state, {});
check(advice.topic === "defense" && advice.suggestionKey, "助言Resolverが事実と提案を分離する");
const records = getAdvisorRecords(state);
check(records[0].turn === 4 && records[0].message === "LOG_TEST", "既存GameLogを複製せず表示形式へ変換する");
check(state.gameLogs[0] === "[T4] LOG_TEST", "Advisor ResolverがGameStateを書き換えない");

bridge.destroy();
dialogue.destroy();
console.log(`Advisor Foundation: ${passed}/${passed} PASS`);
