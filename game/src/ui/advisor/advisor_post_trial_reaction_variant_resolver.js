function normalizeVariant(value) {
    if (Array.isArray(value)) return { lines: value };
    if (!value || typeof value !== "object") return null;
    return value;
}

function policyValue(profile, policyKey) {
    const value = Number(profile?.policy?.[policyKey]);
    return Number.isFinite(value) ? value : 0;
}

function pickFirstLine(lines) {
    return Array.isArray(lines)
        ? (lines.find(line => typeof line === "string" && line.trim()) || null)
        : null;
}

function resolveVariantSource(reaction, semanticSceneId) {
    const semantic = semanticSceneId
        ? normalizeVariant(reaction?.semanticVariants?.[semanticSceneId])
        : null;
    return semantic || reaction || null;
}

/**
 * Selects the Advisor's interpretive lens for a Post-Trial REACTION.
 *
 * Data authors may provide:
 * - lines / expression / priority as the default presentation;
 * - policyVariants keyed by Advisor policy axis;
 * - semanticVariants keyed by a public semanticSceneId, each of which may in
 *   turn provide its own default lines and policyVariants.
 *
 * This resolver reads only character policy and already-public semantic ids.
 * It never reads game state or hidden Trial truth.
 */
export function resolvePostTrialAdvisorReaction({
    reaction,
    profile,
    payload = {}
} = {}) {
    if (!reaction || typeof reaction !== "object") return null;

    const source = resolveVariantSource(reaction, payload?.semanticSceneId);
    const policyVariants = source?.policyVariants && typeof source.policyVariants === "object"
        ? source.policyVariants
        : null;

    let selectedPolicyKey = null;
    let selectedVariant = null;
    let selectedScore = -Infinity;

    if (policyVariants) {
        for (const [policyKey, rawVariant] of Object.entries(policyVariants)) {
            const variant = normalizeVariant(rawVariant);
            if (!variant) continue;
            const line = pickFirstLine(variant.lines);
            if (!line) continue;

            const score = policyValue(profile, policyKey);
            if (score > selectedScore) {
                selectedScore = score;
                selectedPolicyKey = policyKey;
                selectedVariant = variant;
            }
        }
    }

    const variantLine = pickFirstLine(selectedVariant?.lines);
    const sourceLine = pickFirstLine(source?.lines);
    const rootLine = pickFirstLine(reaction.lines);
    const line = variantLine || sourceLine || rootLine;
    if (!line) return null;

    return Object.freeze({
        line,
        expression: selectedVariant?.expression
            || source?.expression
            || reaction.expression
            || "NORMAL",
        priority: Number.isFinite(selectedVariant?.priority)
            ? selectedVariant.priority
            : Number.isFinite(source?.priority)
                ? source.priority
                : Number.isFinite(reaction.priority)
                    ? reaction.priority
                    : undefined,
        durationMs: Number.isFinite(selectedVariant?.durationMs)
            ? selectedVariant.durationMs
            : Number.isFinite(source?.durationMs)
                ? source.durationMs
                : Number.isFinite(reaction.durationMs)
                    ? reaction.durationMs
                    : undefined,
        policyLens: selectedPolicyKey,
        semanticSceneId: payload?.semanticSceneId || null
    });
}

export default resolvePostTrialAdvisorReaction;
