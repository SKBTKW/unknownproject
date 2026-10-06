function list(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function setOf(value) {
    return new Set(list(value));
}

function missingFrom(required, actual) {
    const present = setOf(actual);
    return list(required).filter(item => !present.has(item));
}

function matchesDeploymentRequirement(requirement = {}, deployment = {}) {
    const entries = Object.entries(requirement || {});
    if (entries.length === 0) return { matched: true, missing: [] };

    const missing = [];
    for (const [key, expected] of entries) {
        const actual = deployment?.[key];
        if (Array.isArray(expected)) {
            const absent = missingFrom(expected, Array.isArray(actual) ? actual : []);
            if (absent.length > 0) missing.push({ key, expected, actual, missing: absent });
            continue;
        }
        if (expected && typeof expected === "object") {
            const nested = matchesDeploymentRequirement(expected, actual || {});
            if (!nested.matched) missing.push({ key, expected, actual, missing: nested.missing });
            continue;
        }
        if (actual !== expected) missing.push({ key, expected, actual });
    }
    return { matched: missing.length === 0, missing };
}

/**
 * Pure eligibility evaluator for declared TacticRequirement data.
 *
 * It answers only whether already-declared semantic requirements are present.
 * It does not decide tactic success, mutate Battle State, roll dice, score
 * candidates, or infer requirements from facility/card identities.
 */
export class TacticRequirementEvaluator {
    evaluate({
        requirement = {},
        context = [],
        capabilities = [],
        deployment = {},
        states = [],
        infrastructure = [],
        timing = []
    } = {}) {
        const missingContext = missingFrom(requirement.requiredContext, context);
        const missingCapabilities = missingFrom(requirement.requiredCapabilities, capabilities);
        const missingStates = missingFrom(requirement.requiredStates, states);
        const missingInfrastructure = missingFrom(requirement.requiredInfrastructure, infrastructure);
        const missingTiming = missingFrom(requirement.requiredTiming, timing);
        const deploymentMatch = matchesDeploymentRequirement(
            requirement.requiredDeployment || {},
            deployment || {}
        );

        const reasons = [];
        for (const value of missingContext) reasons.push({ axis: "CONTEXT", value });
        for (const value of missingCapabilities) reasons.push({ axis: "CAPABILITY", value });
        for (const value of missingStates) reasons.push({ axis: "STATE", value });
        for (const value of missingInfrastructure) reasons.push({ axis: "INFRASTRUCTURE", value });
        for (const value of missingTiming) reasons.push({ axis: "TIMING", value });
        for (const value of deploymentMatch.missing) reasons.push({
            axis: "DEPLOYMENT",
            value
        });

        return {
            eligible: reasons.length === 0,
            reasons,
            matched: {
                context: missingContext.length === 0,
                capabilities: missingCapabilities.length === 0,
                deployment: deploymentMatch.matched,
                states: missingStates.length === 0,
                infrastructure: missingInfrastructure.length === 0,
                timing: missingTiming.length === 0
            }
        };
    }
}

export default TacticRequirementEvaluator;
