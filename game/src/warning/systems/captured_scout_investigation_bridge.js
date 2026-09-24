import { INVESTIGATION_ALL_FACETS } from "./investigation_request_service.js";

export const CAPTURED_SCOUT_INVESTIGATION_SOURCE = "CAPTURED_SCOUT_INTERROGATION";

export class CapturedScoutInvestigationBridge {
    apply({ engine, resolution } = {}) {
        if (!engine || !resolution) {
            return { success: false, reason: "CAPTURED_SCOUT_BRIDGE_INPUT_REQUIRED" };
        }
        if (resolution.eventId !== "EVENT_CAPTURED_SCOUT") {
            return { success: false, reason: "NOT_CAPTURED_SCOUT_EVENT" };
        }
        if (resolution.choiceId !== "INTERROGATE") {
            return { success: false, reason: "NO_INVESTIGATION_FOR_CHOICE" };
        }
        if (!Array.isArray(resolution.publicOutcomeTags)
            || !resolution.publicOutcomeTags.includes("INTEL_OPPORTUNITY")) {
            return { success: false, reason: "INTEL_OPPORTUNITY_REQUIRED" };
        }
        if (typeof engine.performGrantedInvestigation !== "function") {
            return { success: false, reason: "GRANTED_INVESTIGATION_RUNTIME_REQUIRED" };
        }

        return engine.performGrantedInvestigation({
            sourceType: CAPTURED_SCOUT_INVESTIGATION_SOURCE,
            allowedFacets: INVESTIGATION_ALL_FACETS,
            baseObservations: 1,
            enhanced: false,
            semanticSourceId: "EVENT_CAPTURED_SCOUT:INTERROGATE"
        });
    }
}

export default CapturedScoutInvestigationBridge;
