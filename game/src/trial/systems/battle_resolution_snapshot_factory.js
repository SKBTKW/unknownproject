import { createBattleResolutionSnapshot } from "../domain/battle_resolution_snapshot.js";
import { BattlefieldContextResolver } from "./battlefield_context_resolver.js";
import { BattleFactResolver } from "./battle_fact_resolver.js";
import { BattleCausalityResolver } from "./battle_causality_resolver.js";
import { BattleCausalEventResolver } from "./battle_causal_event_resolver.js";
import { BattleNormalOutcomeProjector } from "./battle_normal_outcome_projector.js";

export class BattleResolutionSnapshotFactory {
    constructor({
        battlefieldContextResolver = new BattlefieldContextResolver(),
        factResolver = new BattleFactResolver(),
        causalityResolver = new BattleCausalityResolver(),
        eventResolver = new BattleCausalEventResolver(),
        normalOutcomeProjector = new BattleNormalOutcomeProjector()
    } = {}) {
        this.battlefieldContextResolver = battlefieldContextResolver;
        this.factResolver = factResolver;
        this.causalityResolver = causalityResolver;
        this.eventResolver = eventResolver;
        this.normalOutcomeProjector = normalOutcomeProjector;
    }

    create({
        battleId = null,
        routeId = null,
        battleContext = {},
        combatResult = {},
        futureInputs = {}
    } = {}) {
        const battlefieldContext = this.battlefieldContextResolver.resolve({
            battleId,
            routeId,
            battleContext,
            combatResult,
            futureInputs
        });
        const initialFacts = this.factResolver.resolve(battlefieldContext);
        const causes = this.causalityResolver.resolve({ battlefieldContext, facts: initialFacts });
        const causalEvents = this.eventResolver.resolve(causes);
        const normalOutcome = this.normalOutcomeProjector.project({ battlefieldContext, causes });

        return createBattleResolutionSnapshot({
            battleId,
            routeId,
            battlefieldContext,
            initialFacts,
            causes,
            causalEvents,
            normalOutcome
        });
    }
}

export default BattleResolutionSnapshotFactory;
