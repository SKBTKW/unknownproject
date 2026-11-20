// Evaluate only dated observations from the current KnownEnemyState trial.
// No enemy blueprint, hidden schedule, or random input belongs here.
const RULES = Object.freeze([
    ['DIRECTION', /^(NORTH|NORTH_EAST|EAST|SOUTH_EAST|SOUTH|SOUTH_WEST|WEST|NORTH_WEST)_ACTIVITY$/, 'DIRECTION'],
    ['SCALE', /^SCALE_(SMALL|MEDIUM|LARGE|VERY_LARGE)$/, 'SCALE'],
    ['PHYSIQUE', /^LARGE_BODY_PRESENT$/, 'LARGE_BODY'],
    ['PHYSIQUE', /^(MEDIUM|SMALL)_BODY_PRESENT$/, 'PHYSIQUE'],
    ['EQUIPMENT', /^(LIGHT_EQUIPMENT|STANDARD_EQUIPMENT|HEAVY_EQUIPMENT|METAL_ARMOR|LONG_WEAPON|PROJECTILE_WEAPON)$/, 'EQUIPMENT'],
    ['MOVEMENT', /^(NIGHT_MOVEMENT|BAGGAGE_PRESENT)$/, 'MOVEMENT'],
    ['TERRAIN', /^FOREST_ACTIVITY$/, 'TERRAIN']
]);

export function evaluateAdvisorEnemyTopic(knownEnemyState, currentVerse) {
    const trial = knownEnemyState?.trialIndex;
    if (!Number.isInteger(trial) || trial < 1 || !Number.isInteger(currentVerse)) return [];
    const reports = Array.isArray(knownEnemyState.reports) ? knownEnemyState.reports : [];
    const latest = new Map();
    for (const report of reports) {
        if (report?.trialIndex !== trial || !Number.isInteger(report.observedAtVerse)
            || report.observedAtVerse < 1 || report.observedAtVerse > currentVerse
            || typeof report.id !== 'string' || !report.id) continue;
        for (const fact of Array.isArray(report.observations) ? report.observations : []) {
            if (typeof fact?.tag !== 'string') continue;
            const rule = RULES.find(([facet, pattern]) => facet === fact.facet && pattern.test(fact.tag));
            if (!rule) continue;
            const [, , id] = rule;
            const previous = latest.get(id);
            if (previous && previous.verse > report.observedAtVerse) continue;
            latest.set(id, Object.freeze({ id, verse: report.observedAtVerse,
                reportId: report.id, factKey: `INVESTIGATION_TAG_${fact.tag}`,
                evaluationKey: `UI_ADVISOR_EVALUATION_${id}` }));
        }
    }
    return Object.freeze([...latest.values()].sort((a, b) => b.verse - a.verse || a.id.localeCompare(b.id, 'en')));
}
