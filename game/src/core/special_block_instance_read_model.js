/* =============================================================
   game/src/core/special_block_instance_read_model.js
   Logical Special Block instance boundary.

   Multi-cell Special Blocks are persisted as per-cell entity copies. This
   module groups those copies by stable instanceId and never relies on shared
   JavaScript object identity.
   ============================================================= */

import { isSpecialBlockFunctional } from './special_block_domain.js';

function clone(value, fallback = null) {
    if (value === undefined) return fallback;
    return JSON.parse(JSON.stringify(value));
}

function definitionIdOf(entity) {
    return entity?.definitionId || entity?.type || null;
}

function fallbackInstanceId(entity, r, c) {
    const definitionId = definitionIdOf(entity) || 'SPECIAL_BLOCK';
    return `LEGACY:${definitionId}@${r}:${c}`;
}

function pointKey(point) {
    return `${point.r}:${point.c}`;
}

function comparePoints(a, b) {
    return a.r - b.r || a.c - b.c;
}

function normalizeFootprint(entity, members) {
    const declared = Array.isArray(entity?.footprint)
        ? entity.footprint
            .filter(p => Number.isInteger(p?.r) && Number.isInteger(p?.c))
            .map(p => ({ r: p.r, c: p.c }))
        : [];
    if (declared.length > 0) {
        const seen = new Set();
        return declared.filter(point => {
            const key = pointKey(point);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }
    return members.map(member => ({ r: member.r, c: member.c })).sort(comparePoints);
}

function developmentSignature(entity) {
    return JSON.stringify(entity?.developments ?? null);
}

export function enumerateSpecialBlockInstances(state) {
    const groups = new Map();
    for (let r = 0; r < (state?.grid?.length || 0); r++) {
        for (let c = 0; c < (state.grid[r]?.length || 0); c++) {
            const cell = state.grid[r][c];
            const entity = cell?.specialBlock || null;
            if (!entity) continue;
            const instanceId = entity.instanceId || fallbackInstanceId(entity, r, c);
            if (!groups.has(instanceId)) groups.set(instanceId, []);
            groups.get(instanceId).push({ r, c, cell, entity });
        }
    }

    const result = [];
    for (const [instanceId, rawMembers] of groups) {
        const members = [...rawMembers].sort(comparePoints);
        const canonical = members[0];
        const definitionIds = new Set(members.map(member => definitionIdOf(member.entity)));
        const lifecycleStates = new Set(members.map(member => member.entity?.state ?? 'ACTIVE'));
        const developmentStates = new Set(members.map(member => developmentSignature(member.entity)));
        const issues = [];
        if (definitionIds.size !== 1) issues.push('DEFINITION_MISMATCH');
        if (lifecycleStates.size !== 1) issues.push('LIFECYCLE_MISMATCH');
        if (developmentStates.size !== 1) issues.push('DEVELOPMENT_STATE_MISMATCH');

        const footprint = normalizeFootprint(canonical.entity, members);
        const anchor = footprint[0] || { r: canonical.r, c: canonical.c };
        result.push(Object.freeze({
            instanceId,
            definitionId: definitionIdOf(canonical.entity),
            anchor: Object.freeze({ ...anchor }),
            footprint: Object.freeze(footprint.map(point => Object.freeze({ ...point }))),
            cells: Object.freeze(members.map(member => Object.freeze({
                r: member.r,
                c: member.c,
                cell: member.cell
            }))),
            entity: canonical.entity,
            functional: members.every(member => isSpecialBlockFunctional(member.entity)),
            consistent: issues.length === 0,
            issues: Object.freeze(issues)
        }));
    }

    return Object.freeze(result.sort((a, b) =>
        String(a.instanceId).localeCompare(String(b.instanceId))
        || comparePoints(a.anchor, b.anchor)
    ));
}

export function findSpecialBlockInstanceCells(state, instanceId) {
    const instance = resolveSpecialBlockInstance(state, instanceId);
    return instance ? instance.cells : Object.freeze([]);
}

export function resolveSpecialBlockInstance(state, target) {
    const instances = enumerateSpecialBlockInstances(state);
    if (typeof target === 'string' && target) {
        return instances.find(instance => instance.instanceId === target) || null;
    }

    const point = target && typeof target === 'object'
        ? {
            r: Number.isInteger(target.r) ? target.r : target.row,
            c: Number.isInteger(target.c) ? target.c : target.column
        }
        : null;
    if (Number.isInteger(point?.r) && Number.isInteger(point?.c)) {
        const entity = state?.grid?.[point.r]?.[point.c]?.specialBlock || null;
        if (!entity) return null;
        const id = entity.instanceId || fallbackInstanceId(entity, point.r, point.c);
        return instances.find(instance => instance.instanceId === id) || null;
    }

    const entity = target?.specialBlock || target;
    if (entity && typeof entity === 'object' && entity.instanceId) {
        return instances.find(instance => instance.instanceId === entity.instanceId) || null;
    }
    return null;
}

export function snapshotSpecialBlockInstance(instance) {
    if (!instance) return null;
    return Object.freeze({
        instanceId: instance.instanceId,
        definitionId: instance.definitionId,
        anchor: Object.freeze({ ...instance.anchor }),
        footprint: Object.freeze(instance.footprint.map(point => Object.freeze({ ...point }))),
        functional: instance.functional,
        consistent: instance.consistent,
        issues: Object.freeze([...(instance.issues || [])]),
        entity: Object.freeze(clone(instance.entity, {}))
    });
}
