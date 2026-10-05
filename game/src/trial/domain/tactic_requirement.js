function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function list(value) {
    return Array.isArray(value) ? [...value] : [];
}

export function createTacticRequirement({
    requiredContext = [],
    requiredCapabilities = [],
    requiredDeployment = {},
    requiredStates = [],
    requiredInfrastructure = [],
    requiredTiming = []
} = {}) {
    return Object.freeze({
        requiredContext: Object.freeze(list(requiredContext)),
        requiredCapabilities: Object.freeze(list(requiredCapabilities)),
        requiredDeployment: Object.freeze(clone(requiredDeployment) || {}),
        requiredStates: Object.freeze(list(requiredStates)),
        requiredInfrastructure: Object.freeze(list(requiredInfrastructure)),
        requiredTiming: Object.freeze(list(requiredTiming))
    });
}

export default createTacticRequirement;
