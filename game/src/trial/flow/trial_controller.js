import { createBattleContext } from "../domain/battle_context.js";
import { createTrialState } from "../domain/trial_state.js";
import { TRIAL_PHASES } from "../domain/trial_types.js";
import { InterceptionPowerResolver } from "../systems/interception_power_resolver.js";
import { TrialCombatResolver } from "../systems/trial_combat_resolver.js";
import { TrialFlow } from "./trial_flow.js";

export class TrialController {
    constructor({
        powerResolver = new InterceptionPowerResolver(),
        combatResolver = new TrialCombatResolver(),
        flow = new TrialFlow()
    } = {}) {
        this.powerResolver = powerResolver;
        this.combatResolver = combatResolver;
        this.flow = flow;
        this.state = null;
    }

    startScenario(scenario) {
        this.state = createTrialState(scenario);
        this.state.enemy.totalSuppression = this.powerResolver.resolveSuppression(this.state.enemy.strategicSuppression);
        return this.state;
    }

    createBattleContext(input) {
        if (!this.state) throw new Error("TRIAL_NOT_STARTED");
        const allocatedDefense = Math.max(0, Number(input.allocatedDefense) || 0);
        if (allocatedDefense > this.state.human.availableDefense) {
            throw new Error("DEFENSE_ALLOCATION_EXCEEDS_AVAILABLE");
        }
        return createBattleContext({
            ...input,
            allocatedDefense,
            baseInterceptionPower: this.powerResolver.resolveDefense(allocatedDefense),
            enemySuppression: input.enemySuppression ?? this.state.enemy.totalSuppression,
            enemy: input.enemy || this.state.enemy,
            environment: input.environment || this.state.environment
        });
    }

    previewInterception(input) {
        if (!this.state) throw new Error("TRIAL_NOT_STARTED");
        const context = this.createBattleContext(input);
        return this.combatResolver.resolve(context);
    }

    resolveBattle(input) {
        if (!this.state) throw new Error("TRIAL_NOT_STARTED");
        if (this.state.phase === TRIAL_PHASES.SETUP) this.flow.advance(this.state);
        if (this.state.phase === TRIAL_PHASES.DEPLOYMENT) this.flow.advance(this.state);
        if (this.state.phase !== TRIAL_PHASES.BATTLE) throw new Error("TRIAL_NOT_IN_BATTLE_PHASE");

        const context = this.createBattleContext(input);
        const result = this.combatResolver.resolve(context);
        this.state.interceptions.push({ context, result });
        this.state.result = result;
        this.flow.advance(this.state);
        return result;
    }
}
