import { BattleAdvisorPresentationBridge } from "./battle_advisor_presentation_bridge.js";
import { BattleAdvisorReactionProjector } from "./battle_advisor_reaction_projector.js";

/**
 * Controller-independent runtime delivery for Battle Advisor reactions.
 *
 * The canonical Battle Resolution Snapshot remains the only battle authority.
 * Sanitized semantic projection is converted to optional character reaction
 * presentation and handed to AdvisorDialogueSystem.emitPresentation().
 */
export class BattleAdvisorRuntimeDelivery {
    constructor({
        dialogueSystem,
        characterProvider = () => null,
        enabledProvider = () => true,
        reactionProjector = new BattleAdvisorReactionProjector(),
        presentationBridge = null
    } = {}) {
        this.dialogueSystem = dialogueSystem;
        this.characterProvider = characterProvider;
        this.reactionProjector = reactionProjector;

        this.presentationBridge = presentationBridge || new BattleAdvisorPresentationBridge({
            enabledProvider,
            emitSemantic: semantic => this.#emitSemantic(semantic)
        });
    }

    #emitSemantic(semantic) {
        const character = this.characterProvider?.() ?? null;
        const presentation = this.reactionProjector.project({ semantic, character });
        if (!presentation) return false;
        if (!this.dialogueSystem || typeof this.dialogueSystem.emitPresentation !== "function") {
            return false;
        }
        return this.dialogueSystem.emitPresentation(presentation) !== false;
    }

    present(snapshot, options = {}) {
        return this.presentationBridge.present(snapshot, options);
    }
}

export default BattleAdvisorRuntimeDelivery;
