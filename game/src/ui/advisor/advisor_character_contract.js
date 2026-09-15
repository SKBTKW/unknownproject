const EMPTY_OBJECT = Object.freeze({});
const EMPTY_ARRAY = Object.freeze([]);

function frozenObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return EMPTY_OBJECT;
    return Object.isFrozen(value) ? value : Object.freeze({ ...value });
}

function frozenArray(value) {
    if (!Array.isArray(value)) return EMPTY_ARRAY;
    return Object.isFrozen(value) ? value : Object.freeze([...value]);
}

export const ADVISOR_CHARACTER_REQUIRED_FIELDS = Object.freeze([
    "id",
    "archetype",
    "displayNameKey",
    "personality",
    "policy",
    "personalityTraits",
    "speechStyle",
    "characterRules",
    "reactions",
    "dutyDialogue",
    "initialSkills"
]);

export function createAdvisorCharacterDefinition(definition = {}) {
    if (!definition.id) throw new TypeError("ADVISOR_CHARACTER_ID_REQUIRED");
    if (!definition.archetype) throw new TypeError("ADVISOR_CHARACTER_ARCHETYPE_REQUIRED");
    if (!definition.displayNameKey) throw new TypeError("ADVISOR_CHARACTER_DISPLAY_NAME_KEY_REQUIRED");
    if (!definition.personality) throw new TypeError("ADVISOR_CHARACTER_PERSONALITY_REQUIRED");

    const sourcePortraits = definition.portraits || {};
    const portraits = Object.freeze({
        normal: sourcePortraits.normal ?? definition.portrait ?? null,
        expanded: sourcePortraits.expanded ?? definition.portraitExpanded ?? sourcePortraits.normal ?? definition.portrait ?? null,
        collapsed: sourcePortraits.collapsed ?? definition.portraitCollapsed ?? sourcePortraits.normal ?? definition.portrait ?? null
    });

    return Object.freeze({
        id: definition.id,
        archetype: definition.archetype,
        displayNameKey: definition.displayNameKey,
        portraits,
        // Compatibility aliases for the current AdvisorDockComponent. New code should prefer portraits.*.
        portrait: portraits.normal,
        portraitExpanded: portraits.expanded,
        portraitCollapsed: portraits.collapsed,
        personality: definition.personality,
        policy: frozenObject(definition.policy),
        personalityTraits: frozenObject(definition.personalityTraits),
        speechStyle: frozenObject(definition.speechStyle),
        characterRules: frozenObject(definition.characterRules),
        reactions: frozenObject(definition.reactions),
        dutyDialogue: frozenObject(definition.dutyDialogue),
        initialSkills: frozenArray(definition.initialSkills)
    });
}

export function assertAdvisorCharacterDefinition(character) {
    if (!character || typeof character !== "object") throw new TypeError("ADVISOR_CHARACTER_REQUIRED");
    for (const field of ADVISOR_CHARACTER_REQUIRED_FIELDS) {
        if (!(field in character)) throw new TypeError(`ADVISOR_CHARACTER_FIELD_REQUIRED:${field}`);
    }
    if (!character.portraits || typeof character.portraits !== "object") {
        throw new TypeError("ADVISOR_CHARACTER_PORTRAITS_REQUIRED");
    }
    return true;
}
