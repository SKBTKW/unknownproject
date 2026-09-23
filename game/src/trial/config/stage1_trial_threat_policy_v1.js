import { TrialThreatResolver } from "../systems/trial_threat_resolver.js";

export const STAGE1_TRIAL1_BASE_STRATEGIC_SUPPRESSION = 20;

export const STAGE1_TRIAL_THREAT_POLICY_V1 = Object.freeze({
    baseThreatByTrial: Object.freeze({
        1: STAGE1_TRIAL1_BASE_STRATEGIC_SUPPRESSION
    }),
    placedBlockWeight: 0,
    territoryWeight: 0,
    completedZoneWeight: 0,
    linkWeight: 0,
    stageWeight: 0
});

/**
 * Canonical production policy for the first Stage1 Trial only.
 *
 * 20 StrategicSuppression intentionally remains inside the default one-force
 * band (suppressionPerForce=35), so Trial1 has one legal army/route while the
 * later-Trial scale and civilization-growth coefficients stay unresolved.
 *
 * The pure TrialThreatResolver default remains behavior-neutral (all zero);
 * production composition opts into this policy explicitly.
 */
export function createStage1TrialThreatResolverV1() {
    return new TrialThreatResolver({
        ...STAGE1_TRIAL_THREAT_POLICY_V1,
        baseThreatByTrial: { ...STAGE1_TRIAL_THREAT_POLICY_V1.baseThreatByTrial }
    });
}

export default createStage1TrialThreatResolverV1;
