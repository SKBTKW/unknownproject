import { createBattleResolutionSnapshot } from "../domain/battle_resolution_snapshot.js";
import { normalizeBattleActions } from "../domain/battle_action.js";
import { BattlefieldContextResolver } from "./battlefield_context_resolver.js";
import { BattleFactResolver } from "./battle_fact_resolver.js";
import { BattleCausalityResolver } from "./battle_causality_resolver.js";
import { BattleCausalEventResolver } from "./battle_causal_event_resolver.js";
import { BattleConsequenceResolver } from "./battle_consequence_resolver.js";
import { BattleStateProjector } from "./battle_state_projector.js";
import { BattleNormalOutcomeProjector } from "./battle_normal_outcome_projector.js";

function mergeByIdOrType(first = [], second = []) {
    const rows = [];
    const seen = new Set();
    for (const row of [...first, ...second]) {
        const key = row?.causeId || row?.type;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        rows.push(row);
    }
    return rows;
}

export class BattleResolutionSnapshotFactory {
    constructor({
        battlefieldContextResolver = new BattlefieldContextResolver(),
        factResolver = new BattleFactResolver(),
        causalityResolver = new BattleCausalityResolver(),
        eventResolver = new BattleCausalEventResolver(),
        consequenceResolver = new BattleConsequenceResolver(),
        battleStateProjector = new BattleStateProjector(),
        normalOutcomeProjector = new BattleNormalOutcomeProjector()
    } = {}) {
        this.battlefieldContextResolver = battlefieldContextResolver;
        this.factResolver = factResolver;
        this.causalityResolver = causalityResolver;
        this.eventResolver = eventResolver;
        this.consequenceResolver = consequenceResolver;
        this.battleStateProjector = battleStateProjector;
        this.normalOutcomeProjector = normalOutcomeProjector;
    }

    create({
        battleId = null,
        routeId = null,
        battleContext = {},
        combatResult = {},
        actions = [],
        futureInputs = {}
    } = {}) {
        const battlefieldContext = this.battlefieldContextResolver.resolve({
            battleId,
            routeId,
            battleContext,
            combatResult,
            futureInputs
        });
        const normalizedActions = normalizeBattleActions(actions);
        const initialFacts = this.factResolver.resolve(battlefieldContext);
        const baseCauses = this.causalityResolver.resolve({
            battlefieldContext,
            facts: initialFacts,
            actions: normalizedActions
        });
        const consequences = this.consequenceResolver.resolve(baseCauses);
        const derivedCauses = this.causalityResolver.resolve({
            battlefieldContext,
            facts: initialFacts,
            actions: normalizedActions,
            consequences
        });
        const causes = mergeByIdOrType(baseCauses, derivedCauses);
        const causalEvents = this.eventResolver.resolve(causes);
        const battleState = this.battleStateProjector.project({
            battlefieldContext,
            causes,
            consequences
        });
        const normalOutcome = this.normalOutcomeProjector.project({
            battlefieldContext,
            causes,
            battleState
        });

        return createBattleResolutionSnapshot({
            battleId,
            routeId,
            battlefieldContext,
            initialFacts,
            actions: normalizedActions,
            causes,
            causalEvents,
            consequences,
            battleState,
            normalOutcome
        });
    }
}

export default BattleResolutionSnapshotFactory;
