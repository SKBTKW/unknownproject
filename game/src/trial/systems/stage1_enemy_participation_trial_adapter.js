import { readBlueprintLifecycleSnapshot } from "../domain/enemy_army_blueprint_lifecycle_state.js";
import { readEnemyInvasionFoundationState } from "../domain/enemy_invasion_foundation_state.js";
import {
    Stage1TrialParticipationSnapshot,
    freezeStage1TrialParticipationState,
    readStage1TrialParticipationState
} from "../domain/stage1_trial_participation_snapshot.js";
import { EnemyForceConsolidationResolver } from "./enemy_force_consolidation_resolver.js";
import { EnemyInvasionFoundationLifecycleService } from "./enemy_invasion_foundation_lifecycle_service.js";
import { Stage1ParticipationPolicyResolver, validateStage1ParticipationPolicy } from "./stage1_participation_policy_resolver.js";

function slotOf(sourceForceId) { return sourceForceId.slice(sourceForceId.lastIndexOf("_") + 1); }

function profileFromSources(sources) {
    const primary = sources[0];
    return {
        bodySize: primary?.composition?.speciesComposition?.[0]?.type || "MEDIUM",
        equipment: primary?.composition?.equipmentComposition?.map(entry => entry.type) || ["STANDARD"]
    };
}

export class Stage1EnemyParticipationTrialAdapter {
    constructor({ policy, consolidationResolver = new EnemyForceConsolidationResolver() } = {}) {
        this.policy = validateStage1ParticipationPolicy(policy);
        this.policyResolver = new Stage1ParticipationPolicyResolver(this.policy);
        this.consolidationResolver = consolidationResolver;
    }

    resolve({ gameState, trialIndex, strategicSuppression, ingressCandidates = [] } = {}) {
        const stageId = Number(gameState?.stage?.id || 1);
        const participation = this.policyResolver.resolve({ strategicSuppression, stageId, trialIndex });
        if (!participation) return null;
        const saved = readStage1TrialParticipationState(gameState).snapshots.find(entry =>
            entry.stageId === stageId && entry.trialIndex === trialIndex
        );
        if (saved) {
            if (saved.strategicSuppression !== Number(strategicSuppression)
                || saved.policy.id !== participation.policy.id
                || saved.policy.version !== participation.policy.version) {
                throw new Error("STAGE1_PARTICIPATION_SNAPSHOT_CONFLICT");
            }
            return Stage1TrialParticipationSnapshot.fromSnapshot(saved).getSnapshot();
        }

        const blueprint = readBlueprintLifecycleSnapshot(gameState).blueprints.find(entry => entry.stageId === stageId);
        const invasion = readEnemyInvasionFoundationState(gameState);
        const directions = blueprint && invasion.directionSnapshots.find(entry =>
            entry.stageId === stageId && entry.armyId === blueprint.armyId
        );
        if (!blueprint || !directions) throw new Error("STAGE1_PARTICIPATION_SOURCE_FOUNDATION_REQUIRED");

        const consolidation = this.consolidationResolver.resolve({
            blueprint,
            directionSnapshot: directions,
            participantCount: participation.participantCount
        }).getSnapshot();

        const sourceById = new Map(blueprint.forces.map(force => [force.id, force]));
        const weighted = consolidation.participatingForces.map(force => ({
            force,
            weight: force.sourceForceIds.reduce((sum, id) => sum + Number(this.policy.sourceWeights[slotOf(id)]), 0)
        }));
        const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
        if (!(totalWeight > 0)) throw new Error("STAGE1_PARTICIPATION_ALLOCATION_UNRESOLVED");

        const usedIngressIds = new Set();
        let allocated = 0;
        const forces = weighted.map((entry, index) => {
            const common = entry.force.directionDiagnostics.commonIngressDirections;
            const ingressDirection = this.policy.ingressDirectionPriority.find(direction =>
                common.includes(direction) && ingressCandidates.some(candidate =>
                    !usedIngressIds.has(candidate.id) && candidate.edges?.includes(direction)
                )
            );
            const ingress = ingressCandidates
                .filter(candidate => !usedIngressIds.has(candidate.id) && candidate.edges?.includes(ingressDirection))
                .sort((left, right) => left.id.localeCompare(right.id))[0];
            if (!ingressDirection || !ingress) throw new Error("STAGE1_PARTICIPATION_COMMON_INGRESS_UNRESOLVED");
            usedIngressIds.add(ingress.id);
            const suppression = index === weighted.length - 1
                ? Number(strategicSuppression) - allocated
                : Number(strategicSuppression) * entry.weight / totalWeight;
            if (index !== weighted.length - 1) allocated += suppression;
            const sourceForces = entry.force.sourceForceIds.map(id => structuredClone(sourceById.get(id)));
            return {
                id: entry.force.participantUnitId,
                role: entry.force.sourceForceIds.some(id => slotOf(id) === "A") ? "MAIN" : "DETACHMENT",
                primarySourceForceId: entry.force.primarySourceForceId,
                sourceForceIds: [...entry.force.sourceForceIds],
                sourceForces,
                strategicSuppression: suppression,
                commander: null,
                quality: null,
                profile: profileFromSources(sourceForces),
                ingressDirection,
                ingressId: ingress.id,
                ingressCell: { r: ingress.r, c: ingress.c }
            };
        });

        const snapshot = new Stage1TrialParticipationSnapshot({
            schemaVersion: 1,
            stageId,
            trialIndex,
            armyId: blueprint.armyId,
            strategicSuppression: Number(strategicSuppression),
            policy: participation.policy,
            participantCount: forces.length,
            sourceForceIds: [...consolidation.sourceForceIds],
            forces,
            consolidation
        }).getSnapshot();
        // Persist only after policy, allocation and every ingress have been
        // resolved, so an incomplete preview cannot commit partial state.
        new EnemyInvasionFoundationLifecycleService({ gameState }).registerConsolidation(consolidation);
        const state = readStage1TrialParticipationState(gameState);
        gameState.stage1TrialParticipationState = freezeStage1TrialParticipationState({
            schemaVersion: 1,
            snapshots: [...state.snapshots, snapshot]
        });
        return structuredClone(snapshot);
    }
}

export default Stage1EnemyParticipationTrialAdapter;
