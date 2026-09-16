import { TrialController } from "../flow/trial_controller.js";
import { GameFactHub, GAME_FACT_TYPES } from "../../core/game_fact.js";
import { TRIAL_COMPLETION_OUTCOMES, TRIAL_PHASES } from "../domain/trial_types.js";

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

const hub = new GameFactHub();
const controller = new TrialController({
    gameFactHub: hub,
    emberSystem: {
        current: 8,
        engine: {
            state: { turn: 15, ember: 8 },
            runTerminationService: { getResult: () => null },
            chronicleSystem: {
                events: [],
                getAllEvents() { return [...this.events]; },
                record(event) {
                    this.events.push(JSON.parse(JSON.stringify(event)));
                    return event;
                }
            }
        }
    }
});

controller.state = {
    phase: TRIAL_PHASES.RESULT,
    scenarioId: "T1",
    trialCompleted: true,
    ember: 8,
    result: {
        completed: true,
        outcome: TRIAL_COMPLETION_OUTCOMES.SURVIVED,
        emberRemaining: 8,
        totalEmberDamage: 2
    },
    resultSettlement: null
};

const before = controller.getLifecycleReadModel();
assert(before.resultReady === true, "RESULT must be renderer-readable");
assert(before.canExitTrial === false, "RESULT must not be releasable before settlement");

const settled = controller.settleTrialResult();
assert(settled.success, "controller settlement must succeed");
assert(settled.lifecycle.canExitTrial === true, "settlement must make Trial exit-ready");

const facts = hub.getFacts();
assert(facts.some(fact => fact.type === GAME_FACT_TYPES.TRIAL_RESULT_SETTLED), "settlement fact must be emitted");
assert(facts.some(fact => fact.type === GAME_FACT_TYPES.TRIAL_EXIT_READY), "exit-ready fact must be emitted");
assert(controller.state.result?.completed === true, "exit readiness must not destroy Trial result");

console.log("PASS: Trial settlement emits semantic exit readiness without clearing result state");
