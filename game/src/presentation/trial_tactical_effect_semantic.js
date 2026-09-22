import {
    MODIFIER_TARGETS,
    TRIAL_TERRAIN_EFFECTS
} from '../trial/domain/trial_types.js';

export const TRIAL_TACTICAL_EFFECT_PHASES = Object.freeze({
    AVAILABLE: 'AVAILABLE',
    APPLIED: 'APPLIED'
});

export const TRIAL_TACTICAL_EFFECT_POLARITIES = Object.freeze({
    ADVANTAGE: 'ADVANTAGE',
    DISADVANTAGE: 'DISADVANTAGE',
    MIXED: 'MIXED',
    NEUTRAL: 'NEUTRAL'
});

function normalizeCell(cell) {
    if (!cell) return null;
    const r = Number.isInteger(cell.r) ? cell.r : cell.row;
    const c = Number.isInteger(cell.c) ? cell.c : cell.column;
    return Number.isInteger(r) && Number.isInteger(c)
        ? Object.freeze({ r, c })
        : null;
}

function favorableFor(row) {
    const before = Number(row?.before);
    const after = Number(row?.after);
    if (!Number.isFinite(before) || !Number.isFinite(after)) return null;
    if (row?.target === MODIFIER_TARGETS.ENEMY_SUPPRESSION) return after < before;
    if (row?.target === MODIFIER_TARGETS.HUMAN_INTERCEPTION) return after > before;
    return null;
}

function normalizeChange(row) {
    if (!row?.source) return null;
    const before = Number(row.before);
    const after = Number(row.after);
    const value = Number(row.value);
    const threshold = Number(row.threshold);
    const overflowEfficiency = Number(row.overflowEfficiency);

    return Object.freeze({
        target: row.target || null,
        operation: row.operation || null,
        before: Number.isFinite(before) ? before : null,
        after: Number.isFinite(after) ? after : null,
        value: Number.isFinite(value) ? value : null,
        threshold: Number.isFinite(threshold) ? threshold : null,
        overflowEfficiency: Number.isFinite(overflowEfficiency) ? overflowEfficiency : null,
        favorable: favorableFor(row)
    });
}

function resolvePolarity(changes) {
    const known = changes
        .map(change => change.favorable)
        .filter(value => value === true || value === false);
    if (known.length === 0) return TRIAL_TACTICAL_EFFECT_POLARITIES.NEUTRAL;
    const hasAdvantage = known.includes(true);
    const hasDisadvantage = known.includes(false);
    if (hasAdvantage && hasDisadvantage) return TRIAL_TACTICAL_EFFECT_POLARITIES.MIXED;
    return hasAdvantage
        ? TRIAL_TACTICAL_EFFECT_POLARITIES.ADVANTAGE
        : TRIAL_TACTICAL_EFFECT_POLARITIES.DISADVANTAGE;
}

function sourceRows(result, phase) {
    if (phase === TRIAL_TACTICAL_EFFECT_PHASES.APPLIED) {
        return Array.isArray(result?.appliedModifiers) ? result.appliedModifiers : [];
    }
    return Array.isArray(result?.modifiers) ? result.modifiers : [];
}

export function projectTrialTacticalEffects(result, {
    cell = null,
    routeId = null,
    phase = TRIAL_TACTICAL_EFFECT_PHASES.AVAILABLE
} = {}) {
    const anchorCell = normalizeCell(cell);
    if (!anchorCell || !result || result.success === false) return Object.freeze([]);

    const grouped = new Map();
    for (const row of sourceRows(result, phase)) {
        if (!row?.source) continue;
        if (!grouped.has(row.source)) grouped.set(row.source, []);
        const change = normalizeChange(row);
        if (change) grouped.get(row.source).push(change);
    }

    const effects = [];
    for (const [effectId, changes] of grouped.entries()) {
        effects.push(Object.freeze({
            cell: anchorCell,
            routeId: routeId ?? null,
            effectId,
            phase,
            polarity: resolvePolarity(changes),
            changes: Object.freeze(changes)
        }));
    }
    return Object.freeze(effects);
}

export function resolveTrialTacticalEffectGlyph(effectId) {
    switch (effectId) {
        case TRIAL_TERRAIN_EFFECTS.FOREST_DEPLOYMENT:
        case TRIAL_TERRAIN_EFFECTS.DEEP_FOREST_DEPLOYMENT:
            return '🌲';
        case TRIAL_TERRAIN_EFFECTS.WETLAND_EXIT:
            return '≋';
        case TRIAL_TERRAIN_EFFECTS.DESERT_EXIT:
            return '☀';
        case TRIAL_TERRAIN_EFFECTS.HIGH_GROUND:
            return '▲';
        default:
            return '◆';
    }
}
