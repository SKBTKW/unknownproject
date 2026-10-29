import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { EnemyArmyBlueprint, ENEMY_BLUEPRINT_SPECIES as SPECIES, ENEMY_BLUEPRINT_SLOTS as SLOTS } from '../game/src/trial/domain/enemy_army_blueprint.js';
import { ACTIVE_EQUIPMENT_TYPES as EQUIPMENT } from '../game/src/trial/systems/enemy_force_terrain_interaction_resolver.js';
import { generateEnemyArmyBlueprint, validateEnemyArmyBlueprintGenerationPolicy } from '../game/src/trial/systems/enemy_army_blueprint_generator.js';

export const MAX_DISTRIBUTION_SEEDS = 10000;
export const EXTREME_SPECIES_SHARE = 0.9; // Diagnostic threshold only, not a game rule.
const hash = text => createHash('sha256').update(text).digest('hex');
const counts = keys => Object.fromEntries(keys.map(key => [key, 0]));

export function createDistributionPolicies() {
    const data = JSON.parse(fs.readFileSync(new URL('./enemy_army_distribution_hypotheses_v1.json', import.meta.url), 'utf8'));
    if (data.status !== 'DEVELOPMENT_HYPOTHESES_ONLY' || data.schemaVersion !== 1) throw Error('DISTRIBUTION_HYPOTHESES_INVALID');
    const composition = profile => Object.entries(profile).map(([type, share]) => ({ type, share }));
    return Object.fromEntries(Object.entries(data.models).map(([name, model]) => {
        const policy = { id: model.id, version: model.version, slots: {} };
        for (const slot of SLOTS) {
            const config = model.slots[slot];
            policy.slots[slot] = Object.entries(config.speciesWeights).flatMap(([species, speciesWeight]) =>
                Object.entries(config.equipmentWeights).map(([equipment, equipmentWeight]) => ({
                    weight: speciesWeight * equipmentWeight,
                    composition: { speciesComposition: composition(data.speciesProfiles[species]), equipmentComposition: composition(data.equipmentProfiles[equipment]) }
                })));
        }
        validateEnemyArmyBlueprintGenerationPolicy(policy);
        return [name, policy];
    }));
}

export function validateSeedRange(count, startSeed) {
    if (!Number.isSafeInteger(count) || count < 1 || count > MAX_DISTRIBUTION_SEEDS
        || !Number.isSafeInteger(startSeed) || startSeed < 0 || startSeed + count - 1 > 0xffffffff) {
        throw new RangeError('DISTRIBUTION_SEED_RANGE_INVALID');
    }
}

function newTally() {
    return { samples: 0, speciesPresence: counts(SPECIES), speciesShareTotals: counts(SPECIES),
        dominantSpecies: counts([...SPECIES, 'TIED']), equipmentPresence: counts(EQUIPMENT),
        equipmentShareTotals: counts(EQUIPMENT), dominantEquipment: counts([...EQUIPMENT, 'TIED']),
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

export function analyzeArmyDistribution({ count = 1000, startSeed = 0, models = ['A','B','C'], policies = createDistributionPolicies(), generator = generateEnemyArmyBlueprint } = {}) {
    validateSeedRange(count, startSeed);
    if (!Array.isArray(models) || !models.length || new Set(models).size !== models.length
        || models.some(name => !['A','B','C'].includes(name) || !Object.hasOwn(policies, name))) throw Error('DISTRIBUTION_MODELS_INVALID');
    for (const name of models) validateEnemyArmyBlueprintGenerationPolicy(policies[name]);
    const seeds = Array.from({ length: count }, (_, i) => startSeed + i);
    const seedSetDigest = hash(JSON.stringify(seeds));
    const results = {};
    for (const name of models) {
        const policy = structuredClone(policies[name]);
        const overall = newTally(), slots = Object.fromEntries(SLOTS.map(slot => [slot, newTally()]));
        const diversity = { speciesProfiles: counts(['1','2','3']), equipmentProfiles: counts(['1','2','3']), combinedProfiles: counts(['1','2','3']) };
        const digest = createHash('sha256');
        let generationFailures = 0, replayMatches = 0, replayMismatches = 0, replayErrors = 0;
        const failureExamples = [];
        const failure = (seed, phase, error) => { if (failureExamples.length < 20) failureExamples.push({ seed, phase, message: error?.message || String(error) }); };
        for (const runSeed of seeds) {
            let snapshot;
            try {
                snapshot = EnemyArmyBlueprint.fromSnapshot(generator({ runSeed, stageId: 1, policy }).getSnapshot()).getSnapshot();
                if (snapshot.runSeed !== runSeed || snapshot.stageId !== 1) throw Error('DISTRIBUTION_SNAPSHOT_INPUT_MISMATCH');
            } catch (error) { generationFailures++; failure(runSeed, 'GENERATION', error); continue; }
            const encoded = JSON.stringify(snapshot); digest.update(encoded + '\n');
            try {
                const replay = JSON.stringify(generator({ runSeed, stageId: 1, policy }).getSnapshot());
                if (replay === encoded) replayMatches++;
                else { replayMismatches++; failure(runSeed, 'REPLAY', 'Snapshot mismatch'); }
            } catch (error) { replayErrors++; failure(runSeed, 'REPLAY', error); }
            for (const force of snapshot.forces) { tallyForce(overall, force); tallyForce(slots[force.slot], force); }
            for (const [key, get] of Object.entries({ speciesProfiles: f => signature(f.composition.speciesComposition),
                equipmentProfiles: f => signature(f.composition.equipmentComposition), combinedProfiles: f => signature(f.composition.speciesComposition) + signature(f.composition.equipmentComposition) })) {
                diversity[key][new Set(snapshot.forces.map(get)).size]++;
            }
        }
        results[name] = { policy: { id: policy.id, version: policy.version, digest: hash(JSON.stringify(policy)) }, seedSetDigest,
            attemptedArmies: count, successfulArmies: count - generationFailures, generationFailures, generationFailureRate: generationFailures / count,
            replayMatches, replayMismatches, replayErrors, blueprintDigest: digest.digest('hex'), failureExamples,
            overall: finishTally(overall), slots: Object.fromEntries(SLOTS.map(slot => [slot, finishTally(slots[slot])])), diversity };
    }
    return { schemaVersion: 1, status: 'DEVELOPMENT_HYPOTHESES_ONLY', stageId: 1,
        seeds: { start: startSeed, count, step: 1, digest: seedSetDigest },
        semantics: { meanShares: 'Equal weight per potential force; not headcount or suppression weighted',
            forceCoPresence: 'Number of forces containing both categories; NOT an individual species/equipment joint distribution',
            dominance: 'Largest stored share; exact/tolerance ties counted as TIED', extremeSpeciesShare: EXTREME_SPECIES_SHARE,
            pairing: 'Same RunSeed set, but policy ID/version is part of stream derivation; not matched uniform draws' }, results };
}

export function distributionMarkdown(report) {
    const pct = x => Number.isFinite(x) ? (100 * x).toFixed(2) + '%' : 'N/A';
    const rows = ['# Enemy Army distribution hypotheses', '', `Seeds: ${report.seeds.start}..${report.seeds.start+report.seeds.count-1} (${report.seeds.count} per model).`,
        '', 'Development hypotheses only. No production policy is selected.', '',
        '| Model | LARGE mean | MEDIUM mean | SMALL mean | LIGHT mean | STANDARD mean | HEAVY mean | Extreme forces | Failures |',
        '|---|---:|---:|---:|---:|---:|---:|---:|---:|'];
    for (const [name, result] of Object.entries(report.results)) rows.push(`| ${name} | ${[...SPECIES.map(s=>pct(result.overall.speciesMeanShare[s])),...EQUIPMENT.map(e=>pct(result.overall.equipmentMeanShare[e])),pct(result.overall.extremeSpeciesForces/result.overall.samples),result.generationFailures].join(' | ')} |`);
    rows.push('', 'Shares are equal-force marginal means, not individual counts. Co-presence does not establish individual correlation.', '',
        '| Model / force | LARGE mean | MEDIUM mean | SMALL mean | HEAVY present | SMALL and HEAVY co-present |',
        '|---|---:|---:|---:|---:|---:|');
    for (const [name,result] of Object.entries(report.results)) for (const [slot,tally] of Object.entries(result.slots)) rows.push(`| ${name}/${slot} | ${SPECIES.map(s=>pct(tally.speciesMeanShare[s])).join(' | ')} | ${pct(tally.equipmentPresenceRate.HEAVY)} | ${pct(tally.forceCoPresence.SMALL.HEAVY/tally.samples)} |`);
    rows.push('', 'Force-level co-presence rates only (NOT individual equipment assignments):', '',
        '| Model | LARGE + HEAVY | MEDIUM + LIGHT | MEDIUM + STANDARD | MEDIUM + HEAVY | SMALL + HEAVY | 3 species profiles / army | Single species forces | Replay matches |',
        '|---|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const [name,r] of Object.entries(report.results)) rows.push(`| ${name} | ${[['LARGE','HEAVY'],['MEDIUM','LIGHT'],['MEDIUM','STANDARD'],['MEDIUM','HEAVY'],['SMALL','HEAVY']].map(([s,e])=>pct(r.overall.forceCoPresence[s][e]/r.overall.samples)).join(' | ')} | ${pct(r.diversity.speciesProfiles[3]/r.successfulArmies)} | ${pct(r.overall.singleSpeciesForces/r.overall.samples)} | ${r.replayMatches}/${r.successfulArmies} |`);
    return rows.join('\n') + '\n';
}
