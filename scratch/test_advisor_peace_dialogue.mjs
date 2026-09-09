import assert from "node:assert/strict";
import { DEFAULT_ADVISOR_PROFILE } from "../game/src/ui/advisor/advisor_profiles.js";
import { ADVISOR_DIALOGUES } from "../game/src/ui/advisor/advisor_dialogue_database.js";
import { AdvisorRuntimeState } from "../game/src/ui/advisor/advisor_runtime_state.js";
import { AdvisorReactionEvaluator } from "../game/src/ui/advisor/advisor_reaction_evaluator.js";
import { ADVISOR_TOPICS, createAdvisorPeaceSnapshot, resolveAdvisorPeaceStates } from "../game/src/ui/advisor/advisor_peace_state_resolver.js";
import { I18n } from "../game/src/i18n.js";
import { AdvisorEventBridge } from "../game/src/ui/advisor/advisor_event_bridge.js";
import { resolveAdvisorAwareToast } from "../game/src/ui/advisor/advisor_toast_policy.js";

console.log("\nAdvisor Peace Dialogue tests");
let passed = 0;
function check(condition, message) { assert.ok(condition, message); passed += 1; console.log(`  PASS: ${message}`); }
const evaluator = new AdvisorReactionEvaluator({ rng: () => 0 });
const runtime = new AdvisorRuntimeState();
runtime.recordSpeech("game_start", 1);

const criticalStates = resolveAdvisorPeaceStates({ emberRatio: 0.2, foodRunway: 0.5, defenseReference: 0, zoneCount: 0, boardOccupancy: 0 });
let result = evaluator.evaluateTurn({ states: criticalStates, runtime, profile: DEFAULT_ADVISOR_PROFILE, turn: 2 });
check(result?.id === "EMBER_CRITICAL", "🔥系Topicが他の危機より優先される");
check(result.topic === ADVISOR_TOPICS.EMBER, "一度の選択が単一Topicを返す");
runtime.recordSpeech(result.topic, 2);
result = evaluator.evaluateTurn({ states: criticalStates, runtime, profile: DEFAULT_ADVISOR_PROFILE, turn: 3 });
check(result === null, "同じCRITICAL状態を毎ターン連発しない");

const emberPriorityRuntime = new AdvisorRuntimeState({ lastSpokenTurn: 2, previousResolvedStates: [["ember", "EMBER_WARNING"]] });
result = evaluator.evaluateTurn({ states: [
    { id: "EMBER_WARNING", topic: "ember", severity: 2 },
    { id: "FOOD_CRITICAL", topic: "survival", severity: 3 }
], runtime: emberPriorityRuntime, profile: DEFAULT_ADVISOR_PROFILE, turn: 3 });
check(result === null, "継続中の🔥警告がある間は他Topicへ話題を移さない");

const worseningRuntime = new AdvisorRuntimeState({ lastSpokenTurn: 4, previousResolvedStates: [["ember", "EMBER_WARNING"]] });
result = evaluator.evaluateTurn({ states: [{ id: "EMBER_CRITICAL", topic: "ember", severity: 3 }], runtime: worseningRuntime, profile: DEFAULT_ADVISOR_PROFILE, turn: 5 });
check(result?.id === "EMBER_CRITICAL", "WARNINGからCRITICALへの悪化はrecent抑制を越える");

const quietRuntime = new AdvisorRuntimeState({ lastSpokenTurn: 1, previousResolvedStates: [["stability", "STABLE_OVERALL"]] });
result = evaluator.evaluateTurn({ states: [{ id: "STABLE_OVERALL", topic: "stability", severity: 1 }], runtime: quietRuntime, profile: DEFAULT_ADVISOR_PROFILE, turn: 2 });
check(result === null, "0〜1T無言では通常Topicを話さない");
result = evaluator.evaluateTurn({ states: [{ id: "STABLE_OVERALL", topic: "stability", severity: 1 }], runtime: quietRuntime, profile: DEFAULT_ADVISOR_PROFILE, turn: 7 });
check(result?.id === "STABLE_OVERALL", "6T無言後は安定評価を候補化できる");
result = evaluator.evaluateTurn({ states: [], runtime: quietRuntime, profile: DEFAULT_ADVISOR_PROFILE, turn: 14 });
check(result === null, "6T以上でも価値あるTopicがなければ無言を維持する");

const tieStates = [
    { id: "FOOD_WARNING", topic: "logistics", severity: 2 },
    { id: "DEFENSE_WEAK", topic: "defense", severity: 2 }
];
const tieFirst = new AdvisorReactionEvaluator({ rng: () => 0 }).evaluateTurn({ states: tieStates, runtime: new AdvisorRuntimeState(), profile: DEFAULT_ADVISOR_PROFILE, turn: 6 });
const tieLast = new AdvisorReactionEvaluator({ rng: () => 0.99 }).evaluateTurn({ states: tieStates, runtime: new AdvisorRuntimeState(), profile: DEFAULT_ADVISOR_PROFILE, turn: 6 });
check(tieFirst.topic !== tieLast.topic, "同Policy値の同率候補を注入RNGで選択できる");
const recentRuntime = new AdvisorRuntimeState({ lastSpokenTurn: 1, recentTopics: [{ topic: "logistics", turn: 4 }] });
result = evaluator.evaluateTurn({ states: tieStates, runtime: recentRuntime, profile: DEFAULT_ADVISOR_PROFILE, turn: 6 });
check(result?.topic === "defense", "同Policy値ではrecentでないTopicを優先する");

const milestoneRuntime = new AdvisorRuntimeState();
check(evaluator.evaluateMilestone("ZONE_COMPLETED", milestoneRuntime)?.id === "FIRST_ZONE_COMPLETED", "初回Zoneは必須反応");
check(evaluator.evaluateMilestone("ZONE_COMPLETED", milestoneRuntime)?.id === "ZONE_COMPLETED", "2回目Zoneは通常反応候補");
check(evaluator.evaluateMilestone("LINK_COMPLETED", milestoneRuntime)?.id === "FIRST_LINK_COMPLETED", "初回Linkは必須反応");
check(evaluator.evaluateMilestone("LINK_COMPLETED", milestoneRuntime)?.id === "LINK_COMPLETED", "2回目Linkは通常反応候補");
check(evaluator.evaluateMilitaryAction("BUILD_DEFENSE", milestoneRuntime)?.id === "MILITARY_ACTION", "軍事ActionTypeへ初回反応する");
check(evaluator.evaluateMilitaryAction("BUILD_DEFENSE", milestoneRuntime) === null, "同じ軍事ActionTypeへ再反応しない");
check(evaluator.evaluateGlobalEvent({ id: "HARVEST" }, milestoneRuntime, 3) === null, "Policy非関連Global Eventは無反応になれる");
check(evaluator.evaluateGlobalEvent({ id: "PLAGUE" }, milestoneRuntime, 3)?.id === "GLOBAL_EVENT_SURVIVAL", "生存関連Global Eventを候補化する");
check(evaluator.evaluateGlobalEvent({ id: "PLAGUE" }, milestoneRuntime, 4) === null, "同カテゴリGlobal Eventを数ターン抑制する");

const state = { turn: 3, ember: 5, maxEmber: 20, food: 10, currentDefense: 7, maxDefense: 10, nextTrialDefenseRequirement: 20, mergedBlocks: {}, mergeLinks: new Set(), stage: { size: 5 }, grid: [] };
const snapshot = createAdvisorPeaceSnapshot(state);
check(snapshot.emberRatio === 0.25 && snapshot.foodRunway === 0.5, "公開GameStateから読み取り専用snapshotを作る");
check(state.ember === 5 && state.food === 10, "State ResolverがGameStateを書き換えない");
check(DEFAULT_ADVISOR_PROFILE.policy.ember === 4 && DEFAULT_ADVISOR_PROFILE.policy.mysticism === 1, "老将軍Policyは4段階整数で定義される");
check(ADVISOR_DIALOGUES.every(entry => !entry.lineKeys.some(key => key === "UI_ADVISOR_DIALOGUE_TURN_START")), "TURN_START固定台詞を平時Databaseから除外する");
check(ADVISOR_DIALOGUES.flatMap(entry => entry.lineKeys).every(key => !I18n.t(key).includes("残火")), "Dialogue本文に作中禁止語を含めない");

const emitted = [];
const bridgeDialogue = {
    emit: event => { emitted.push(event); return true; },
    emitTopic: result => { emitted.push(result.id); return true; }
};
const bridge = new AdvisorEventBridge(bridgeDialogue, null, { profile: DEFAULT_ADVISOR_PROFILE, enabledProvider: () => true, rng: () => 0 });
const peacefulState = { turn: 1, ember: 20, maxEmber: 20, food: 100, mergedBlocks: {}, mergeLinks: new Set(), stage: { size: 5 }, grid: [] };
bridge.observeSnapshot({ turn: 1, trialRemaining: 10, warningDuration: 5, state: peacefulState });
bridge.observeSnapshot({ turn: 2, trialRemaining: 8, warningDuration: 5, state: { ...peacefulState, turn: 2 } });
const beforeBoundary = emitted.length;
bridge.observeSnapshot({ turn: 3, trialRemaining: 5, warningDuration: 5, state: { ...peacefulState, turn: 3 } });
check(emitted.length === beforeBoundary, "Trial announcement開始後は平時発話を停止する");

const rewardToast = { type: "MERGE_2X2", text: "meaning", rewards: { food: 10, ember: 2 } };
check(resolveAdvisorAwareToast(rewardToast, true).text === "🌾+10 🔥+2", "Advisor ONでは説明Toastを数値表示へ置き換える");
check(resolveAdvisorAwareToast(rewardToast, false).text === "meaning", "Advisor OFFでは従来説明Toastを維持する");
check(resolveAdvisorAwareToast({ type: "RESOURCE", text: "🌾+3" }, true).text === "🌾+3", "数値ToastはAdvisor ONでも維持する");

console.log(`Advisor Peace Dialogue: ${passed}/${passed} PASS`);
