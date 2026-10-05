import { createSpatialEngagement, RELATIVE_ENGAGEMENT } from "../domain/spatial_engagement.js";

function point(cell) {
    if (!cell) return null;
    const r = Number.isInteger(cell.r) ? cell.r : cell.row;
    const c = Number.isInteger(cell.c) ? cell.c : cell.column;
    return Number.isInteger(r) && Number.isInteger(c) ? { r, c } : null;
}

function vector(from, to) {
    const a = point(from);
    const b = point(to);
    if (!a || !b) return null;
    const dr = b.r - a.r;
    const dc = b.c - a.c;
    if (dr === 0 && dc === 0) return null;
    return { dr: Math.sign(dr), dc: Math.sign(dc) };
}

export class RelativeEngagementResolver {
    resolve({ battleLocation = null, enemyApproach = null, humanEngagementOrigin = null } = {}) {
        const enemyAdvanceVector = vector(enemyApproach, battleLocation);
        const humanAttackVector = vector(humanEngagementOrigin, battleLocation);
        let relativeEngagement = RELATIVE_ENGAGEMENT.UNRESOLVED;

        if (enemyAdvanceVector && humanAttackVector) {
            const dot = enemyAdvanceVector.dr * humanAttackVector.dr
                + enemyAdvanceVector.dc * humanAttackVector.dc;
            const cross = enemyAdvanceVector.dr * humanAttackVector.dc
                - enemyAdvanceVector.dc * humanAttackVector.dr;

            if (dot < 0) relativeEngagement = RELATIVE_ENGAGEMENT.FRONT;
            else if (dot > 0) relativeEngagement = RELATIVE_ENGAGEMENT.REAR;
            // Board rows increase downward. Negative cross is the enemy's left side.
            else if (cross < 0) relativeEngagement = RELATIVE_ENGAGEMENT.LEFT_FLANK;
            else if (cross > 0) relativeEngagement = RELATIVE_ENGAGEMENT.RIGHT_FLANK;
        }

        return createSpatialEngagement({
            battleLocation,
            enemyApproach,
            humanEngagementOrigin,
            enemyAdvanceVector,
            humanAttackVector,
            relativeEngagement
        });
    }
}

export default RelativeEngagementResolver;
