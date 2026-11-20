// General advice, not a predicted battle outcome or a compulsory instruction.
const TOPIC_POLICY = Object.freeze({ DIRECTION: 'defense', SCALE: 'survival', LARGE_BODY: 'defense', PHYSIQUE: 'defense', EQUIPMENT: 'defense', MOVEMENT: 'logistics', TERRAIN: 'defense' });

export function resolveAdvisorEnemyTopicAdvice(evaluations, profile, depth = 'medium') {
    if (!Array.isArray(evaluations) || depth === 'shallow') return [];
    const weight = item => {
        const value = profile?.policy?.[TOPIC_POLICY[item.id]];
        return Number.isFinite(value) ? value : 0;
    };
    return Object.freeze(evaluations.filter(item => Object.hasOwn(TOPIC_POLICY, item.id))
        .slice().sort((a, b) => weight(b) - weight(a) || b.verse - a.verse || a.id.localeCompare(b.id, 'en'))
        .slice(0, depth === 'deep' ? 3 : 1)
        .map(item => Object.freeze({ ...item, suggestionKey: `UI_ADVISOR_TOPIC_ADVICE_${item.id}` })));
}
