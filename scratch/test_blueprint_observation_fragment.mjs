import assert from 'node:assert/strict';
import { projectBlueprintObservationFragment as project } from '../game/src/warning/domain/blueprint_observation_fragment.js';
const blueprint = { schemaVersion: 1, stageId: 1, forces: [
    { id: 'ARMY_A', composition: { speciesComposition: [{type:'LARGE',share:1}] } },
    { id: 'ARMY_B', composition: { speciesComposition: [{type:'SMALL',share:1}] } }
] };
const sight = {kind:'SPECIES_WITNESSED',evidence:'DIRECT_SIGHTING',sourceForceId:'ARMY_A',species:'LARGE'};
const before = JSON.stringify(blueprint);
const output = project({blueprint,observation:sight});
assert.deepEqual(output,{kind:'SPECIES_WITNESSED',tokens:[{role:'SUBJECT',valueKey:'INVESTIGATION_SPECIES_LARGE'}],certainty:'DIRECT_OBSERVATION'});
assert.ok(Object.isFrozen(output) && Object.isFrozen(output.tokens));
assert.ok(!JSON.stringify(output).includes('ARMY_A'),'source force must be hidden');
assert.equal(project({blueprint,observation:{...sight,evidence:'FOOTPRINTS'}}),null,'footprints cannot establish species');
assert.equal(project({blueprint,observation:{...sight,sourceForceId:'ARMY_UNKNOWN'}}),null);
assert.equal(project({blueprint,observation:{...sight,sourceForceId:'ARMY_B'}}),null);
assert.equal(project({blueprint,observation:{...sight,kind:'SERVITUDE'}}),null,'v1 blueprint has no servitude fact');
assert.equal(project({blueprint,observation:{...sight,activity:'CARRY_CARGO'}}),null,'unknown activity field must be rejected');
assert.equal(project({blueprint:{...blueprint,schemaVersion:2},observation:sight}),null,'fail closed for future schema');
assert.equal(project({blueprint:null,observation:sight}),null);
assert.equal(JSON.stringify(blueprint),before,'truth must be immutable');
console.log('PASS blueprint observation fragment / no inferred relations / no force leak');
