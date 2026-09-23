/* =============================================================
   game/src/cards/card_execution_requirement_service.js
   Separate execution-time requirement boundary. Offering eligibility must
   never be reused as the authority for executing a reserved/stale card.
   ============================================================= */

class CardExecutionRequirementService {
    constructor({ evaluator = null } = {}) {
        this.evaluator = evaluator;
    }

    evaluate(cardDefinition, context = {}) {
        const requirements = cardDefinition?.execution?.requirements;
        if (!Array.isArray(requirements) || requirements.length === 0) {
            return Object.freeze({ canExecute: true, failures: Object.freeze([]) });
        }

        if (typeof this.evaluator !== "function") {
            return Object.freeze({
                canExecute: false,
                failures: Object.freeze(["EXECUTION_REQUIREMENT_EVALUATOR_REQUIRED"])
            });
        }

        const failures = requirements
            .filter(requirement => !this.evaluator(requirement, context))
            .map(requirement => requirement.id || requirement.type || "EXECUTION_REQUIREMENT_FAILED");

        return Object.freeze({
            canExecute: failures.length === 0,
            failures: Object.freeze(failures)
        });
    }
}

export { CardExecutionRequirementService };
export default CardExecutionRequirementService;
