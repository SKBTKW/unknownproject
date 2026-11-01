import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { RandomSource } from '../game/src/core/check_system/random_source.js';
import { EnemyArmyBlueprint, ENEMY_BLUEPRINT_SPECIES as SPECIES, ENEMY_BLUEPRINT_SLOTS as SLOTS } from '../game/src/trial/domain/enemy_army_blueprint.js';
import { ACTIVE_EQUIPMENT_TYPES as EQUIPMENT } from '../game/src/trial/systems/enemy_force_terrain_interaction_resolver.js';
import { generateEnemyArmyBlueprint, validateEnemyArmyBlueprintGenerationPolicy } from '../game/src/trial/systems/enemy_army_blueprint_generator.js';

export const MAX_DISTRIBUTION_SEEDS = 10000;
export const EXTREME_SPECIES_SHARE = 0.9;
export const DISTRIBUTION_MODEL_NAMES = Object.freeze(['A','B','C','D','E']);
const DISTANCE_BANDS = Object.freeze(['EXACT','LE_0_20','LE_0_40','LE_0_60','LE_0_80','LE_1_00']);
const hash = text => createHash('sha256').update(text).digest('hex');
const counts = keys => Object.fromEntries(keys.map(key => [key, 0]));
const loadData = () => JSON.parse(fs.readFileSync(new URL('./enemy_army_distribution_hypotheses_v1.json', import.meta.url), 'utf8'));
const composition = profile => Object.entries(profile).map(([type, share]) => ({ type, share }));

function policyFromSlotConfigs(data, { id, version, slots }) {
    const policy = { id, version, slots: {} };
    for (const slot of SLOTS) {
        const config = slots[slot];
        policy.slots[slot] = Object.entries(config.speciesWeights).flatMap(([species, speciesWeight]) =>
            Object.entries(config.equipmentWeights).map(([equipment, equipmentWeight]) => ({
                weight: speciesWeight * equipmentWeight,
                composition: { speciesComposition: composition(data.speciesProfiles[species]), equipmentComposition: composition(data.equipmentProfiles[equipment]) }
            })));
    }
    validateEnemyArmyBlueprintGenerationPolicy(policy);
    return policy;
}

function validateData(data) {
    if (data.status !== 'DEVELOPMENT_HYPOTHESES_ONLY' || data.schemaVersion !== 1) throw Error('DISTRIBUTION_HYPOTHESES_INVALID');
    const model = data.hierarchicalModels?.E;
    if (!model || !Array.isArray(model.variants) || typeof model.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(model.id)
        || !Number.isInteger(model.version) || model.version < 1 || model.selectorDerivation !== 'fnv1a-mulberry32-v1' || !model.variants.length) throw Error('DISTRIBUTION_HIERARCHY_INVALID');
    const ids = new Set();
    for (const variant of model.variants) {
        if (typeof variant.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(variant.id) || ids.has(variant.id)
            || !Number.isFinite(variant.weight) || variant.weight <= 0) throw Error('DISTRIBUTION_HIERARCHY_INVALID');
        ids.add(variant.id);
        const slots = Object.fromEntries(SLOTS.map(slot => [slot, { speciesWeights: variant.speciesWeights, equipmentWeights: variant.equipmentWeights }]));
        policyFromSlotConfigs(data, { id: `${model.id}-${variant.id}`, version: model.version, slots });
    }
    return data;
}

export function createDistributionPolicies() {
    const data = validateData(loadData());
    return Object.fromEntries(Object.entries(data.models).map(([name, model]) => [name, policyFromSlotConfigs(data, model)]));
}

function streamSeed(parts) {
    let value = 0x811c9dc5;
    for (const character of JSON.stringify(parts)) value = Math.imul(value ^ character.charCodeAt(0), 0x01000193) >>> 0;
    return value;
}

export function selectHierarchicalVariant({ runSeed, stageId = 1, model } = {}) {
    if (!Number.isInteger(runSeed) || runSeed < 0 || runSeed > 0xffffffff || stageId !== 1 || !model) throw Error('DISTRIBUTION_HIERARCHY_INPUT_INVALID');
    const random = new RandomSource(streamSeed(['enemy-army-distribution-army-trait-v1', runSeed, stageId, model.id, model.version]));
    const total = model.variants.reduce((sum, variant) => sum + variant.weight, 0);
    const roll = random.nextFloat() * total;
    let cursor = 0;
    for (const variant of model.variants) { cursor += variant.weight; if (roll < cursor) return variant; }
    return model.variants.at(-1);
}

export function createDistributionHypotheses() {
    const data = validateData(loadData());
    const policies = createDistributionPolicies();
    const result = Object.fromEntries(Object.entries(policies).map(([name, policy]) => [name, { policy, generate: generateEnemyArmyBlueprint }]));
    const model = structuredClone(data.hierarchicalModels.E);
    const variants = Object.fromEntries(model.variants.map(variant => {
        const slots = Object.fromEntries(SLOTS.map(slot => [slot, { speciesWeights: variant.speciesWeights, equipmentWeights: variant.equipmentWeights }]));
        return [variant.id, policyFromSlotConfigs(data, { id: `${model.id}-${variant.id}`, version: model.version, slots })];
    }));
    result.E = {
        policy: model,
        generate: ({ runSeed, stageId }) => {
            const variant = selectHierarchicalVariant({ runSeed, stageId, model });
            return generateEnemyArmyBlueprint({ runSeed, stageId, policy: variants[variant.id] });
        },
        describe: ({ runSeed, stageId }) => ({ armyTrait: selectHierarchicalVariant({ runSeed, stageId, model }).id })
    };
    return result;
}

export function validateSeedRange(count, startSeed) {
    if (!Number.isSafeInteger(count) || count < 1 || count > MAX_DISTRIBUTION_SEEDS
        || !Number.isSafeInteger(startSeed) || startSeed < 0 || startSeed + count - 1 > 0xffffffff) throw new RangeError('DISTRIBUTION_SEED_RANGE_INVALID');
}

function newTally() {
    return { samples: 0, speciesPresence: counts(SPECIES), speciesShareTotals: counts(SPECIES), dominantSpecies: counts([...SPECIES, 'TIED']),
        equipmentPresence: counts(EQUIPMENT), equipmentShareTotals: counts(EQUIPMENT), dominantEquipment: counts([...EQUIPMENT, 'TIED']),
        forceCoPresence: Object.fromEntries(SPECIES.map(s => [s, counts(EQUIPMENT)])), singleSpeciesForces: 0, extremeSpeciesForces: 0 };
}
function dominance(entries) {
    const max = Math.max(...entries.map(e => e.share));
    const leaders = entries.filter(e => Math.abs(e.share - max) < 1e-12);
    return leaders.length === 1 ? leaders[0].type : 'TIED';
}
function tallyForce(tally, force) {
    const { speciesComposition: species, equipmentComposition: equipment } = force.composition;
    tally.samples++;
    for (const entry of species) { tally.speciesPresence[entry.type]++; tally.speciesShareTotals[entry.type] += entry.share; }
    for (const entry of equipment) { tally.equipmentPresence[entry.type]++; tally.equipmentShareTotals[entry.type] += entry.share; }
    tally.dominantSpecies[dominance(species)]++; tally.dominantEquipment[dominance(equipment)]++;
    for (const s of species) for (const e of equipment) tally.forceCoPresence[s.type][e.type]++;
    if (species.length === 1) tally.singleSpeciesForces++;
    if (Math.max(...species.map(e => e.share)) >= EXTREME_SPECIES_SHARE) tally.extremeSpeciesForces++;
}
function finishTally(tally) {
    const rate = values => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, tally.samples ? value / tally.samples : null]));
    return { ...tally, speciesMeanShare: rate(tally.speciesShareTotals), equipmentMeanShare: rate(tally.equipmentShareTotals),
        speciesPresenceRate: rate(tally.speciesPresence), equipmentPresenceRate: rate(tally.equipmentPresence) };
}
const signature = entries => JSON.stringify([...entries].sort((a,b) => a.type < b.type ? -1 : a.type > b.type ? 1 : 0));
const vector = entries => Object.fromEntries(entries.map(entry => [entry.type, entry.share]));
const distance = (left, right) => 0.5 * SPECIES.reduce((sum, type) => sum + Math.abs((left[type] || 0) - (right[type] || 0)), 0);
const distanceBand = value => value === 0 ? 'EXACT' : value <= .2 ? 'LE_0_20' : value <= .4 ? 'LE_0_40' : value <= .6 ? 'LE_0_60' : value <= .8 ? 'LE_0_80' : 'LE_1_00';
function addDistance(tally, value) { tally.comparisons++; tally.total += value; tally.histogram[distanceBand(value)]++; }
const finishDistance = tally => ({ ...tally, mean: tally.comparisons ? tally.total / tally.comparisons : null });
function topCount(map) { return [...map.entries()].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]))[0] || [null,0]; }
function compactForces(snapshot) { return snapshot.forces.map(force => ({ slot: force.slot, species: force.composition.speciesComposition, equipment: force.composition.equipmentComposition })); }

export function analyzeArmyDistribution(options = {}) {
    const { count = 1000, startSeed = 0, models = ['A','B','C'] } = options;
    validateSeedRange(count, startSeed);
    const legacy = Object.hasOwn(options, 'policies') || Object.hasOwn(options, 'generator');
    const hypotheses = legacy
        ? Object.fromEntries(Object.entries(options.policies || createDistributionPolicies()).map(([name, policy]) => [name, { policy, generate: options.generator || generateEnemyArmyBlueprint }]))
        : options.hypotheses || createDistributionHypotheses();
    if (!Array.isArray(models) || !models.length || new Set(models).size !== models.length || models.some(name => !DISTRIBUTION_MODEL_NAMES.includes(name) || !Object.hasOwn(hypotheses, name))) throw Error('DISTRIBUTION_MODELS_INVALID');
    for (const name of models) if (name !== 'E' || legacy) validateEnemyArmyBlueprintGenerationPolicy(hypotheses[name].policy);
    const seeds = Array.from({ length: count }, (_, i) => startSeed + i);
    const seedSetDigest = hash(JSON.stringify(seeds));
    const results = {};
    for (const name of models) {
        const descriptor = hypotheses[name], policy = structuredClone(descriptor.policy);
        const overall = newTally(), slots = Object.fromEntries(SLOTS.map(slot => [slot, newTally()]));
        const diversity = { speciesProfiles: counts(['1','2','3']), equipmentProfiles: counts(['1','2','3']), combinedProfiles: counts(['1','2','3']) };
        const relations = { exactSpeciesAllForces: 0, exactEquipmentAllForces: 0, exactCombinedAllForces: 0, atLeastTwoDominantSpeciesMatch: 0,
            allDominantSpeciesMatch: 0, withinArmySpeciesDistance: { comparisons: 0, total: 0, histogram: counts(DISTANCE_BANDS) },
            betweenAdjacentArmiesSpeciesDistance: { comparisons: 0, total: 0, histogram: counts(DISTANCE_BANDS) } };
        const speciesArmyProfiles = new Map(), combinedArmyProfiles = new Map(), equipmentProfiles = new Map(), traits = {};
        const digest = createHash('sha256');
        let generationFailures = 0, replayMatches = 0, replayMismatches = 0, replayErrors = 0, previousVectors = null;
        const failureExamples = [], examples = { seed42: null, firstExactSpecies: null, firstSingleSpeciesForce: null, firstAllDominantsDifferent: null };
        const failure = (seed, phase, error) => { if (failureExamples.length < 20) failureExamples.push({ seed, phase, message: error?.message || String(error) }); };
        for (const runSeed of seeds) {
            let snapshot;
            try {
                snapshot = EnemyArmyBlueprint.fromSnapshot(descriptor.generate({ runSeed, stageId: 1, policy }).getSnapshot()).getSnapshot();
                if (snapshot.runSeed !== runSeed || snapshot.stageId !== 1) throw Error('DISTRIBUTION_SNAPSHOT_INPUT_MISMATCH');
            } catch (error) { generationFailures++; failure(runSeed, 'GENERATION', error); continue; }
            const encoded = JSON.stringify(snapshot); digest.update(encoded + '\n');
            try {
                const replay = JSON.stringify(descriptor.generate({ runSeed, stageId: 1, policy }).getSnapshot());
                if (replay === encoded) replayMatches++; else { replayMismatches++; failure(runSeed, 'REPLAY', 'Snapshot mismatch'); }
            } catch (error) { replayErrors++; failure(runSeed, 'REPLAY', error); }
            const trait = descriptor.describe?.({ runSeed, stageId: 1 })?.armyTrait;
            if (trait) traits[trait] = (traits[trait] || 0) + 1;
            for (const force of snapshot.forces) { tallyForce(overall, force); tallyForce(slots[force.slot], force); }
            const speciesSignatures = snapshot.forces.map(force => signature(force.composition.speciesComposition));
            const equipmentSignatures = snapshot.forces.map(force => signature(force.composition.equipmentComposition));
            const combinedSignatures = snapshot.forces.map((force, i) => speciesSignatures[i] + equipmentSignatures[i]);
            for (const [key, values] of Object.entries({ speciesProfiles: speciesSignatures, equipmentProfiles: equipmentSignatures, combinedProfiles: combinedSignatures })) diversity[key][new Set(values).size]++;
            if (new Set(speciesSignatures).size === 1) relations.exactSpeciesAllForces++;
            if (new Set(equipmentSignatures).size === 1) relations.exactEquipmentAllForces++;
            if (new Set(combinedSignatures).size === 1) relations.exactCombinedAllForces++;
            const dominants = snapshot.forces.map(force => dominance(force.composition.speciesComposition));
            const dominantCounts = Object.values(dominants.reduce((acc, value) => (acc[value]=(acc[value]||0)+1, acc), {}));
            if (Math.max(...dominantCounts) >= 2) relations.atLeastTwoDominantSpeciesMatch++;
            if (Math.max(...dominantCounts) === 3) relations.allDominantSpeciesMatch++;
            const vectors = snapshot.forces.map(force => vector(force.composition.speciesComposition));
            addDistance(relations.withinArmySpeciesDistance, (distance(vectors[0],vectors[1])+distance(vectors[0],vectors[2])+distance(vectors[1],vectors[2]))/3);
            if (previousVectors) addDistance(relations.betweenAdjacentArmiesSpeciesDistance, SLOTS.reduce((sum,_,i)=>sum+distance(previousVectors[i],vectors[i]),0)/3);
            previousVectors = vectors;
            const speciesArmy = JSON.stringify(speciesSignatures), combinedArmy = JSON.stringify(combinedSignatures);
            speciesArmyProfiles.set(speciesArmy,(speciesArmyProfiles.get(speciesArmy)||0)+1); combinedArmyProfiles.set(combinedArmy,(combinedArmyProfiles.get(combinedArmy)||0)+1);
            for (const value of equipmentSignatures) equipmentProfiles.set(value,(equipmentProfiles.get(value)||0)+1);
            const compact = { seed: runSeed, forces: compactForces(snapshot), ...(trait ? { armyTrait: trait } : {}) };
            if (runSeed === 42) examples.seed42 = compact;
            if (!examples.firstExactSpecies && new Set(speciesSignatures).size === 1) examples.firstExactSpecies = compact;
            if (!examples.firstSingleSpeciesForce && snapshot.forces.some(force=>force.composition.speciesComposition.length===1)) examples.firstSingleSpeciesForce = compact;
            if (!examples.firstAllDominantsDifferent && new Set(dominants).size === 3) examples.firstAllDominantsDifferent = compact;
        }
        const finishedSlots = Object.fromEntries(SLOTS.map(slot => [slot, finishTally(slots[slot])]));
        const armyWideTop = topCount(new Map(Object.entries(overall.dominantSpecies)));
        const slotDominantPredictability = Object.fromEntries(SLOTS.map(slot => {
            const top = topCount(new Map(Object.entries(finishedSlots[slot].dominantSpecies)));
            return [slot, { predictedSpecies: top[0], accuracy: finishedSlots[slot].samples ? top[1]/finishedSlots[slot].samples : null,
                liftVsArmyWideBaseline: overall.samples ? top[1]/finishedSlots[slot].samples - armyWideTop[1]/overall.samples : null }];
        }));
        const topSpeciesArmy = topCount(speciesArmyProfiles), topCombinedArmy = topCount(combinedArmyProfiles), topEquipment = topCount(equipmentProfiles);
        results[name] = { policy: { id: policy.id, version: policy.version, digest: hash(JSON.stringify(policy)) }, seedSetDigest,
            attemptedArmies: count, successfulArmies: count-generationFailures, generationFailures, generationFailureRate: generationFailures/count,
            replayMatches, replayMismatches, replayErrors, blueprintDigest: digest.digest('hex'), failureExamples,
            overall: finishTally(overall), slots: finishedSlots, diversity,
            relations: { ...relations, withinArmySpeciesDistance: finishDistance(relations.withinArmySpeciesDistance),
                betweenAdjacentArmiesSpeciesDistance: finishDistance(relations.betweenAdjacentArmiesSpeciesDistance), slotDominantPredictability,
                armyWideDominantBaseline: { predictedSpecies: armyWideTop[0], accuracy: overall.samples ? armyWideTop[1]/overall.samples : null },
                uniqueSpeciesArmies: speciesArmyProfiles.size, mostCommonSpeciesArmyCount: topSpeciesArmy[1], uniqueCombinedArmies: combinedArmyProfiles.size,
                mostCommonCombinedArmyCount: topCombinedArmy[1], mostCommonEquipmentProfileCount: topEquipment[1], mostCommonEquipmentProfileRate: overall.samples ? topEquipment[1]/overall.samples : null },
            armyTraits: traits, examples };
    }
    return { schemaVersion: 2, status: 'DEVELOPMENT_HYPOTHESES_ONLY', stageId: 1, seeds: { start:startSeed,count,step:1,digest:seedSetDigest },
        semantics: { meanShares:'Equal weight per potential force; not headcount or suppression weighted', forceCoPresence:'Force co-presence; NOT individual species/equipment assignment',
            dominance:'Largest stored share; ties counted as TIED', extremeSpeciesShare:EXTREME_SPECIES_SHARE,
            withinArmyDistance:'Mean total-variation distance over A-B, A-C, B-C species compositions',
            betweenArmyDistance:'Mean slot-aligned total-variation distance between adjacent seeds in the declared seed set',
            pairing:'Same RunSeed set; policy identity is part of each independent stream derivation' }, results };
}

export function distributionMarkdown(report) {
    const pct=x=>Number.isFinite(x)?(100*x).toFixed(2)+'%':'N/A', num=x=>Number.isFinite(x)?x.toFixed(4):'N/A';
    const rows=['# Enemy Army distribution hypotheses','',`Seeds: ${report.seeds.start}..${report.seeds.start+report.seeds.count-1} (${report.seeds.count} per model).`,'','Development hypotheses only. No production policy is selected.','',
        '| Model | LARGE | MEDIUM | SMALL | Exact species A/B/C | >=2 dominant match | Within distance | Between distance | Pure forces | Failures |',
        '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|'];
    for(const [name,r] of Object.entries(report.results)) rows.push(`| ${name} | ${SPECIES.map(s=>pct(r.overall.speciesMeanShare[s])).join(' | ')} | ${pct(r.relations.exactSpeciesAllForces/r.successfulArmies)} | ${pct(r.relations.atLeastTwoDominantSpeciesMatch/r.successfulArmies)} | ${num(r.relations.withinArmySpeciesDistance.mean)} | ${num(r.relations.betweenAdjacentArmiesSpeciesDistance.mean)} | ${pct(r.overall.singleSpeciesForces/r.overall.samples)} | ${r.generationFailures} |`);
    rows.push('','Slot predictability is majority-class accuracy from slot identity; it is not verified Gameplay knowledge.','',
        '| Model | A prediction | B prediction | C prediction | Exact equipment A/B/C | Top equipment profile | Unique species armies | Replay |','|---|---:|---:|---:|---:|---:|---:|---:|');
    for(const [name,r] of Object.entries(report.results)) rows.push(`| ${name} | ${SLOTS.map(slot=>`${r.relations.slotDominantPredictability[slot].predictedSpecies} ${pct(r.relations.slotDominantPredictability[slot].accuracy)}`).join(' | ')} | ${pct(r.relations.exactEquipmentAllForces/r.successfulArmies)} | ${pct(r.relations.mostCommonEquipmentProfileRate)} | ${r.relations.uniqueSpeciesArmies} | ${r.replayMatches}/${r.successfulArmies} |`);
    rows.push('','Shares are force-level marginals. Equipment and species are NOT an individual joint distribution. Distances are diagnostic definitions, not game rules.');
    return rows.join('\n')+'\n';
}
