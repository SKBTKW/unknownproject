export const ZONE_LINK_EDGE_KINDS = Object.freeze({
    NONE: 'NONE',
    ZONE_INTERNAL: 'ZONE_INTERNAL',
    ZONE_BOUNDARY: 'ZONE_BOUNDARY',
    LINK: 'LINK'
});

/**
 * Presentation-only mapping from existing board semantics to a visual edge kind.
 *
 * No zone/link rules are recalculated here. The semantic service remains the
 * authority for sameZone / zoneBoundary / linked; renderers only consume this
 * compact directive.
 */
export function resolveZoneLinkEdgeVisual(edge) {
    if (!edge) return Object.freeze({ kind: ZONE_LINK_EDGE_KINDS.NONE });

    if (edge.linked) {
        return Object.freeze({
            kind: ZONE_LINK_EDGE_KINDS.LINK,
            direction: edge.direction,
            neighbor: edge.neighbor || null
        });
    }

    if (edge.sameZone) {
        return Object.freeze({
            kind: ZONE_LINK_EDGE_KINDS.ZONE_INTERNAL,
            direction: edge.direction,
            neighbor: edge.neighbor || null
        });
    }

    if (edge.zoneBoundary) {
        return Object.freeze({
            kind: ZONE_LINK_EDGE_KINDS.ZONE_BOUNDARY,
            direction: edge.direction,
            neighbor: edge.neighbor || null
        });
    }

    return Object.freeze({
        kind: ZONE_LINK_EDGE_KINDS.NONE,
        direction: edge.direction,
        neighbor: edge.neighbor || null
    });
}

export function buildZoneLinkVisuals(cell) {
    const edges = Object.freeze((cell?.edges || []).map(resolveZoneLinkEdgeVisual));
    return Object.freeze({
        zoneId: cell?.zone?.zoneId ?? null,
        linkIds: Object.freeze((cell?.links || []).map(link => link?.linkId).filter(Boolean)),
        edges
    });
}

export default buildZoneLinkVisuals;
