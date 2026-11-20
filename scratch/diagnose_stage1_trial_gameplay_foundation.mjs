import { pathToFileURL } from "node:url";
import { blueprintArmyId } from "../game/src/trial/domain/enemy_army_blueprint.js";
import { Stage1TrialGameplayAuditResolver } from "../game/src/trial/dev/stage1_trial_gameplay_audit_resolver.js";
import { prepareStage1, strategies } from "./diagnose_stage1_board_strategy.mjs";

export const diagnosticPolicies = Object.freeze([
    Object.freeze({
        id: "prototype-block-pressure-v1",
        status: "PROTOTYPE",
        appliesToProduction: false,
        baseSuppression: 20,
        placedBlockWeight: 2,
        territoryTileWeight: 0,
        completedZoneWeight: 0,
        linkWeight: 0,
        stageWeight: 0,
        participantBands: [
            { participantCount: 1, minInclusive: 0, maxInclusive: 34 },
            { participantCount: 2, minInclusive: 35, maxInclusive: 69 },
            { participantCount: 3, minInclusive: 70, maxInclusive: null }
        ]
    }),
    Object.freeze({
        id: "prototype-territory-pressure-v1",
        status: "PROTOTYPE",
        appliesToProduction: false,
        baseSuppression: 20,
        placedBlockWeight: 0,
        territoryTileWeight: 1,
        completedZoneWeight: 4,
        linkWeight: 2,
        stageWeight: 0,
        participantBands: [
            { participantCount: 1, minInclusive: 0, maxInclusive: 29 },
            { participantCount: 2, minInclusive: 30, maxInclusive: 49 },
            { participantCount: 3, minInclusive: 50, maxInclusive: null }
        ]
    })
]);

export function createDiagnosticSourceIdentity(seed) {
    const armyId = blueprintArmyId(seed, 1);
    const slots = ["A", "B", "C"];
    return {
        blueprint: {
            schemaVersion: 1,
            runSeed: seed,
            stageId: 1,
            armyId,
            generationPolicy: { id: "stage1-gameplay-audit-fixture", version: 1 },
            forces: slots.map((slot, index) => ({
                id: `${armyId}_${slot}`,
                slot,
                composition: {
                    speciesComposition: [{ type: ["LARGE", "MEDIUM", "SMALL"][index], share: 1 }],
                    equipmentComposition: [{ type: ["HEAVY", "STANDARD", "LIGHT"][index], share: 1 }]
                }
            }))
        },
        directionSnapshot: {
            schemaVersion: 1,
            stageId: 1,
            armyId,
            forces: slots.map((slot, index) => ({
                sourceForceId: `${armyId}_${slot}`,
                slot,
                activityDirection: ["NORTH", "EAST", "SOUTH"][index]
            }))
        }
    };
}

export function runStage1GameplayFoundationAudit({
    seeds = [20260922, 20260923, 20260924],
    policies = diagnosticPolicies
} = {}) {
    const resolver = new Stage1TrialGameplayAuditResolver();
    const samples = [];
    for (const seed of seeds) {
        for (const strategy of strategies) {
            const { snapshot } = prepareStage1(strategy, { seed, hypotheses: {} });
            const development = {
                stage: snapshot.stage,
                placedBlockCount: snapshot.normalLandBlocks,
                territoryTiles: snapshot.normalLandCells,
                completedZones: snapshot.zones,
                links: snapshot.links
            };
            samples.push({
                seed,
                strategy,
                board: {
                    normalLandBlocks: snapshot.normalLandBlocks,
                    normalLandCells: snapshot.normalLandCells,
                    specialBlocks: snapshot.specialBlocks,
                    food: snapshot.food,
                    material: snapshot.material,
                    defense: snapshot.defense,
                    ember: snapshot.ember,
                    interceptionCandidateCount: snapshot.interceptionCandidates.length
                },
                comparison: resolver.compare({
                    development,
                    productionStrategicSuppression: snapshot.productionThreat,
                    candidatePolicies: policies,
                    legacySuppressionPerForce: 35,
                    sourceIdentity: createDiagnosticSourceIdentity(seed)
                })
            });
        }
    }
    return {
        schemaVersion: 1,
        generatedBy: "diagnose_stage1_trial_gameplay_foundation.mjs",
        productionMutation: false,
        seeds: [...seeds],
        strategies: [...strategies],
        candidatePolicyIds: policies.map(policy => policy.id),
        samples
    };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const seeds = process.argv.slice(2).map(Number).filter(Number.isSafeInteger);
    console.log(JSON.stringify(runStage1GameplayFoundationAudit({
        seeds: seeds.length > 0 ? seeds : undefined
    }), null, 2));
}
