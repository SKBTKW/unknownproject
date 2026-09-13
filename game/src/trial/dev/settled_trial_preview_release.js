export function releaseSettledTrialPreviewSession(harness) {
    if (!harness) return { released: false, restoreBoundary: null };
    const wasActive = harness.session !== null;
    harness.session = null;
    const restoreBoundary = harness.trialRestoreBoundaryService?.end?.() || null;
    return { released: wasActive, restoreBoundary };
}

export default releaseSettledTrialPreviewSession;
