import assert from "node:assert/strict";
import fs from "node:fs";
import { InvestigationCardPresentationRuntime } from "../game/src/ui/investigation_card_presentation_runtime.js";
import { InvestigationResultPresentationBridge } from "../game/src/warning/presentation/investigation_result_presentation_bridge.js";

const report = Object.freeze({
    id: "runtime-report-1",
    observedAtVerse: 8,
    trialIndex: 1,
    sourceType: "FOOTPRINTS",
    observations: Object.freeze([
        Object.freeze({ facet: "DIRECTION", tag: "NORTH_ACTIVITY" }),
        Object.freeze({ facet: "PHYSIQUE", tag: "LARGE_BODY_PRESENT" })
    ])
});
const result = Object.freeze({
    success: true,
    report,
    roll: Object.freeze({ dice: Object.freeze([5, 4]), total: 9 }),
    critical: false,
    previousReport: null,
    comparison: null
});

const before = JSON.stringify(result);
const projection = new InvestigationResultPresentationBridge().project(result);
assert.equal(projection.available, true);
assert.equal(projection.report.observationVolumeBand, "MULTIPLE");
assert.equal(projection.report.sections.length, 2);
assert.match(projection.narrative.text, /複数/);
assert.equal(JSON.stringify(result), before, "presentation bridge must not mutate execution result");

// A tag seen in an older immutable report must be presented as reconfirmed even
// when the immediately previous report did not contain it.
const historicalReport = Object.freeze({
    id: "runtime-report-3",
    observedAtVerse: 10,
    trialIndex: 1,
    sourceType: "FOOTPRINTS",
    observations: Object.freeze([
        Object.freeze({ facet: "DIRECTION", tag: "NORTH_ACTIVITY" })
    ])
});
const historicalResult = Object.freeze({
    success: true,
    report: historicalReport,
    roll: null,
    critical: false,
    previousReport: Object.freeze({
        id: "runtime-report-2",
        observedAtVerse: 9,
        observations: Object.freeze([
            Object.freeze({ facet: "TERRAIN", tag: "FOREST_USE" })
        ])
    }),
    comparison: Object.freeze({
        newTags: Object.freeze(["NORTH_ACTIVITY"]),
        repeatedTags: Object.freeze([])
    }),
    state: Object.freeze({
        reports: Object.freeze([
            Object.freeze({
                id: "runtime-report-1",
                observedAtVerse: 8,
                observations: Object.freeze([
                    Object.freeze({ facet: "DIRECTION", tag: "NORTH_ACTIVITY" })
                ])
            }),
            Object.freeze({
                id: "runtime-report-2",
                observedAtVerse: 9,
                observations: Object.freeze([
                    Object.freeze({ facet: "TERRAIN", tag: "FOREST_USE" })
                ])
            }),
            historicalReport
        ])
    })
});
const historicalProjection = new InvestigationResultPresentationBridge().project(historicalResult);
assert.equal(
    historicalProjection.report.observations[0].status,
    "RECONFIRMED",
    "non-consecutive historical evidence must not be mislabeled as new"
);

// Presentation history must be deterministic across JSON restore and must not
// expose mutable aliases to the restored KnownEnemyState reports.
const historyState = {
    reports: [
        {
            id: "restore-r1",
            observedAtVerse: 8,
            sourceType: "FOOTPRINTS",
            observations: [{ facet: "DIRECTION", tag: "NORTH_ACTIVITY" }]
        },
        {
            id: "restore-r2",
            observedAtVerse: 9,
            sourceType: "SCOUT_SIGHTING",
            observations: [
                { facet: "DIRECTION", tag: "NORTH_ACTIVITY" },
                { facet: "PHYSIQUE", tag: "LARGE_BODY_PRESENT" }
            ]
        }
    ]
};
const historyBridge = new InvestigationResultPresentationBridge();
const beforeRestoreHistory = historyBridge.projectHistory(historyState);
const restoredHistoryState = JSON.parse(JSON.stringify(historyState));
const afterRestoreHistory = historyBridge.projectHistory(restoredHistoryState);
assert.deepEqual(afterRestoreHistory, beforeRestoreHistory, "restore must preserve history presentation");
assert.equal(afterRestoreHistory[1].reconfirmed[0].tag, "NORTH_ACTIVITY");
assert.equal(afterRestoreHistory[1].newlyObserved[0].tag, "LARGE_BODY_PRESENT");
assert.equal(Object.isFrozen(afterRestoreHistory[0].snapshot), true);
assert.equal(Object.isFrozen(afterRestoreHistory[0].snapshot.observations), true);
restoredHistoryState.reports[0].observations[0].tag = "MUTATED_AFTER_PROJECTION";
assert.equal(
    afterRestoreHistory[0].snapshot.observations[0].tag,
    "NORTH_ACTIVITY",
    "history presentation must own an immutable snapshot copy"
);

const shown = [];
const calls = [];
const runtime = new InvestigationCardPresentationRuntime({
    bridge: { project: value => ({ available: true, result: value, marker: "PRESENTED" }) },
    component: { show: value => shown.push(value) },
    localeProvider: () => "ja"
});
const engine = {
    executeInvestigationCard(card, source) {
        calls.push({ card, source });
        return { success: true, report };
    }
};
const card = { id: "INVESTIGATE_FOOTPRINTS", category: "INVESTIGATION" };
const executed = runtime.execute(engine, card, { type: "OFFERING", index: 0 });
assert.equal(executed.success, true);
assert.equal(calls.length, 1);
assert.equal(calls[0].card, card);
assert.deepEqual(calls[0].source, { type: "OFFERING", index: 0 });
assert.equal(shown.length, 1);
assert.equal(executed.presentation.marker, "PRESENTED");

const failedShown = [];
const failureShown = [];
const failedRuntime = new InvestigationCardPresentationRuntime({
    component: {
        show: value => failedShown.push(value),
        showFailure: value => failureShown.push(value)
    }
});
const failed = failedRuntime.execute({
    executeInvestigationCard() { return { success: false, reason: "INVESTIGATION_LOCKED" }; }
}, card, { type: "OFFERING", index: 0 });
assert.equal(failed.success, false);
assert.equal(failedShown.length, 0, "failed gameplay execution must not open success presentation");
assert.equal(failureShown.length, 1, "failed gameplay execution must present its reason");
assert.equal(failureShown[0].reason, "INVESTIGATION_LOCKED");
assert.match(failureShown[0].message, /調査|段階/);
assert.equal(failed.failurePresentation, failureShown[0]);

const unavailableFailures = [];
const unavailableRuntime = new InvestigationCardPresentationRuntime({
    component: { showFailure: value => unavailableFailures.push(value) }
});
const unavailable = unavailableRuntime.execute({}, card, { type: "OFFERING", index: 0 });
assert.equal(unavailable.reason, "INVESTIGATION_EXECUTION_UNAVAILABLE");
assert.equal(unavailableFailures.length, 1);
assert.equal(unavailable.failurePresentation.reason, "INVESTIGATION_EXECUTION_UNAVAILABLE");

const englishProjection = new InvestigationResultPresentationBridge({ locale: "en" }).project(result);
assert.equal(englishProjection.report.observationVolumeBand, "MULTIPLE");
assert.match(englishProjection.report.observationVolume, /Several|characteristics/i);

const componentSource = fs.readFileSync(new URL("../game/src/ui/investigation_report_component.js", import.meta.url), "utf8");
assert.match(componentSource, /event\?\.key === "Escape"/);
assert.match(componentSource, /close\.focus\?\.\(\)/);
assert.match(componentSource, /document\.removeEventListener\("keydown"/);

const uiSource = fs.readFileSync(new URL("../game/src/ui/ui_controller.js", import.meta.url), "utf8");
assert.match(uiSource, /category\s*===\s*"INVESTIGATION"/);
assert.match(uiSource, /playInvestigationCard\(card, idx, reserveIdx\)/);
assert.match(
    uiSource,
    /if\s*\(category\s*===\s*"INVESTIGATION"\)[\s\S]*?playInvestigationCard\(card, idx, reserveIdx\);[\s\S]*?return;/,
    "Investigation confirmation must not fall through into the generic command render path"
);
assert.match(uiSource, /UI_INVESTIGATION_EXECUTE/);
assert.match(uiSource, /UI_CARD_HINT_INVESTIGATE/);
assert.match(uiSource, /executeInvestigationCard/);
assert.doesNotMatch(
    uiSource,
    /if\s*\(category\s*===\s*"INVESTIGATION"\)\s*\{\s*this\.playCommandCard/s,
    "Investigation must not be routed through generic command execution"
);

console.log("✅ Investigation runtime presentation connection PASS");
