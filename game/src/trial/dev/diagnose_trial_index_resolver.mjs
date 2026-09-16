import assert from "node:assert/strict";
import {
    createCurrentTrialIndexResolver,
    resolveCurrentTrialIndex
} from "../systems/trial_index_resolver.js";

{
    const timingAuthority = { getCurrentTrialIndex: () => 2 };
    const gameState = { stage: { id: 3 } };
    assert.equal(resolveCurrentTrialIndex({ timingAuthority, gameState }), 2);
}

{
    const gameState = { stage: { id: 3 } };
    assert.equal(resolveCurrentTrialIndex({ gameState }), 3);
}

{
    const timingAuthority = { getCurrentTrialIndex: () => 1 };
    const resolver = createCurrentTrialIndexResolver({ timingAuthority });
    assert.equal(resolver({ stage: { id: 3 } }), 1);
}

console.log("diagnose_trial_index_resolver: OK");
