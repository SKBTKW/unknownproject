export function releaseSettledTrialPreviewSession(harness) {
    if (!harness) return { released: false };
    const wasActive = harness.session !== null;
    harness.session = null;
    return { released: wasActive };
}

export default releaseSettledTrialPreviewSession;
