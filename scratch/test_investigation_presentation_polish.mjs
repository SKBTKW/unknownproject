import assert from "node:assert/strict";
import { InvestigationReportPresenter } from "../game/src/warning/presentation/investigation_report_presenter.js";
import { InvestigationReportTextRenderer } from "../game/src/warning/presentation/investigation_report_text_renderer.js";
import { InvestigationHistoryPresenter } from "../game/src/warning/presentation/investigation_history_presenter.js";
import { InvestigationNarrativeComposer } from "../game/src/warning/presentation/investigation_narrative_composer.js";
import { InvestigationNarrativeTextRenderer } from "../game/src/warning/presentation/investigation_narrative_text_renderer.js";

const presenter = new InvestigationReportPresenter();
const renderer = new InvestigationReportTextRenderer({ locale: "ja" });
const history = new InvestigationHistoryPresenter();

const makeReport = (id, verse, observations) => Object.freeze({
    id,
    observedAtVerse: verse,
    trialIndex: 1,
    sourceType: "FOOTPRINTS",
    observations: Object.freeze(observations.map(item => Object.freeze({ ...item })))
});

const first = makeReport("r8", 8, [
    { facet: "PHYSIQUE", tag: "LARGE_BODY_PRESENT" },
    { facet: "DIRECTION", tag: "NORTH_ACTIVITY" },
    { facet: "TERRAIN", tag: "FOREST_ACTIVITY" }
]);

const bands = [[4,"LIMITED"],[5,"ONE_CLUE"],[9,"MULTIPLE"],[12,"CRITICAL"]];
const volumeText = bands.map(([total, band]) => {
    const view = presenter.present(first, {
        roll: { dice: total === 12 ? [6,6] : [1,total - 1], total },
        critical: total === 12,
        firstObservation: true
    });
    assert.equal(view.observationVolumeBand, band);
    return renderer.render(view).observationVolume;
});
assert.equal(new Set(volumeText).size, 4);

const critical = renderer.render(presenter.present(first, {
    roll: { dice: [6,6], total: 12 },
    critical: true,
    firstObservation: true
}));
assert.deepEqual(critical.sections.map(section => section.group), ["ENEMY","APPROACH","ENVIRONMENT"]);

const second = makeReport("r10", 10, [
    { facet: "DIRECTION", tag: "NORTH_ACTIVITY" },
    { facet: "EQUIPMENT", tag: "HEAVY_EQUIPMENT" }
]);
const result = Object.freeze({
    report: second,
    roll: Object.freeze({ dice: Object.freeze([4,4]), total: 8 }),
    critical: false,
    previousReport: first,
    comparison: Object.freeze({
        newTags: Object.freeze(["HEAVY_EQUIPMENT"]),
        repeatedTags: Object.freeze(["NORTH_ACTIVITY"])
    })
});
const beforeResult = JSON.stringify(result);
const rendered = renderer.render(presenter.presentResult(result));
assert.equal(rendered.observations.find(x => x.tag === "HEAVY_EQUIPMENT").status, "NEW");
assert.equal(rendered.observations.find(x => x.tag === "NORTH_ACTIVITY").status, "RECONFIRMED");
assert.equal(JSON.stringify(result), beforeResult);

const historyBefore = history.presentHistory([first, second]);
const historyJson = JSON.stringify(historyBefore);
const laterState = { reports: JSON.parse(JSON.stringify([first, second])), observedTags: ["NORTH_ACTIVITY"] };
laterState.reports.push({ id:"r12", observedAtVerse:12, trialIndex:1, sourceType:"SCOUT_SIGHTING",
    observations:[{ facet:"MOVEMENT", tag:"NIGHT_MOVEMENT" }] });
assert.equal(JSON.stringify(historyBefore), historyJson);
assert.deepEqual(history.presentHistory(JSON.parse(JSON.stringify([first, second]))), historyBefore);
assert.deepEqual(historyBefore[1].reconfirmed.map(x => x.tag), ["NORTH_ACTIVITY"]);

const empty = renderer.render(presenter.present(null));
assert.equal(empty.hasObservations, false);
assert.equal(empty.sections.length, 0);

const unknown = renderer.render(presenter.present(makeReport("ru", 11, [
    { facet:"UNKNOWN", tag:"UNMAPPED_TRACE" }
]), { firstObservation:true }));
assert.equal(unknown.observations[0].value, "未整理の観測記録");
assert.ok(!unknown.observations[0].value.includes("UNMAPPED_TRACE"));

const narrative = new InvestigationNarrativeTextRenderer({ locale:"ja" }).render(
    new InvestigationNarrativeComposer().compose(rendered)
);
assert.ok(narrative.text.includes("手掛かり"));
assert.ok(narrative.text.includes("次の試練"));
for (const forbidden of ["TrueEnemyState","strategicSuppression","ingress","route"]) {
    assert.ok(!narrative.text.includes(forbidden));
}

console.log("PASS investigation presentation polish");
