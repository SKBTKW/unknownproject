import assert from 'node:assert/strict';
import { evaluateAdvisorEnemyTopic } from '../game/src/ui/advisor/advisor_topic_evaluation.js';
import { resolveAdvisorEnemyTopicAdvice } from '../game/src/ui/advisor/advisor_topic_advice.js';
const report = (id, trialIndex, observedAtVerse, facet, tag) => ({ id, trialIndex, observedAtVerse, observations: [{ facet, tag, subject: { sourceForceId: 'hidden' } }] });
const known = { trialIndex: 2, observedTags: ['SCALE_VERY_LARGE'], reports: [
    report('future', 2, 12, 'SCALE', 'SCALE_VERY_LARGE'),
    report('old', 1, 4, 'SCALE', 'SCALE_LARGE'),
    report('direction', 2, 8, 'DIRECTION', 'NORTH_ACTIVITY'),
    report('size', 2, 9, 'PHYSIQUE', 'LARGE_BODY_PRESENT'),
    report('movement', 2, 10, 'MOVEMENT', 'BAGGAGE_PRESENT'),
    report('unknown', 2, 10, 'SCALE', 'UNRECOGNIZED'),
    report('mismatch', 2, 10, 'EQUIPMENT', 'SCALE_LARGE'),
    report('undated', 2, null, 'SCALE', 'SCALE_SMALL'),
] };
const before = JSON.stringify(known);
const facts = evaluateAdvisorEnemyTopic(known, 10);
assert.deepEqual(facts.map(x => x.id), ['MOVEMENT', 'LARGE_BODY', 'DIRECTION']);
assert.equal(facts[1].reportId, 'size');
assert.ok(!JSON.stringify(facts).includes('hidden'));
assert.deepEqual(evaluateAdvisorEnemyTopic({}, 10), []);
assert.deepEqual(evaluateAdvisorEnemyTopic(known, undefined), []);
assert.deepEqual(evaluateAdvisorEnemyTopic(JSON.parse(before), 10), facts);
assert.deepEqual(resolveAdvisorEnemyTopicAdvice(facts, {}, 'shallow'), []);
assert.equal(resolveAdvisorEnemyTopicAdvice(facts, { policy: { defense: 4, logistics: 1 } })[0].id, 'LARGE_BODY');
assert.equal(resolveAdvisorEnemyTopicAdvice(facts, { policy: { defense: 1, logistics: 4 } })[0].id, 'MOVEMENT');
assert.equal(resolveAdvisorEnemyTopicAdvice(facts, {}, 'deep').length, 3);
assert.equal(JSON.stringify(known), before);
console.log('PASS advisor topic evaluation/advice: evidence scope, freshness, policy, depth, immutable projection');

// Integration contract: production controller, with a minimal DOM host.
const { AdvisorContentController } = await import('../game/src/ui/advisor/advisor_content_controller.js');
const { I18n } = await import('../game/src/i18n.js');
class El {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.className = ''; this.textContent = ''; this.dataset = {}; }
    appendChild(child) { this.children.push(child); return child; }
    replaceChildren() { this.children = []; }
    setAttribute() {}
    findAll(cls) { return [...(this.className.split(' ').includes(cls) ? [this] : []), ...this.children.flatMap(child => child.findAll(cls))]; }
}
globalThis.document = { createElement: tag => new El(tag) };
const data = { turn: 10, knownEnemyState: known };
const profile = { policy: { defense: 4, logistics: 1 } };
const ctrl = new AdvisorContentController({ stateProvider: () => data, i18n: I18n, profile });
for (const lang of ['ja', 'en']) {
    I18n.setLanguage(lang);
    const dictionary = I18n.getDictionary(lang);
    for (const key of ['UI_ADVISOR_TOPIC_EVALUATION_TITLE', 'UI_ADVISOR_TOPIC_ADVICE_TITLE', 'UI_ADVISOR_TOPIC_ADVICE_ROW', 'UI_ADVISOR_EVALUATION_NO_CURRENT', ...['DIRECTION','SCALE','LARGE_BODY','PHYSIQUE','EQUIPMENT','MOVEMENT','TERRAIN'].flatMap(id => [`UI_ADVISOR_EVALUATION_${id}`, `UI_ADVISOR_TOPIC_ADVICE_${id}`])]) assert.ok(Object.hasOwn(dictionary,key), `${lang} missing ${key}`);
    const host = new El('div');
    ctrl.setDepth('medium'); ctrl.renderTopicReport(host);
    assert.equal(host.findAll('advisor-topic-evaluation').length, 3);
    assert.deepEqual(host.findAll('advisor-topic-advice').map(x => x.textContent), [I18n.t('UI_ADVISOR_TOPIC_ADVICE_ROW', { verse: 9, evidence: I18n.t('INVESTIGATION_TAG_LARGE_BODY_PRESENT'), advice: I18n.t('UI_ADVISOR_TOPIC_ADVICE_LARGE_BODY') })]);
    assert.ok(host.findAll('advisor-topic-evaluation').every(x => !x.textContent.includes('hidden') && !x.textContent.includes('{evidence}') && !x.textContent.includes('{verse}')));
    ctrl.setDepth('shallow'); host.replaceChildren(); ctrl.renderTopicReport(host);
    assert.equal(host.findAll('advisor-topic-evaluation').length, 1);
    assert.equal(host.findAll('advisor-topic-advice').length, 0);
    ctrl.setDepth('deep'); host.replaceChildren(); ctrl.renderTopicReport(host);
    assert.equal(host.findAll('advisor-topic-advice').length, 3);
    const oldOnly = new AdvisorContentController({ stateProvider: () => ({ turn: 10, knownEnemyState: { trialIndex: 3, reports: known.reports } }), i18n: I18n, profile });
    host.replaceChildren(); oldOnly.renderTopicReport(host);
    assert.equal(host.findAll('advisor-topic-evaluation').length, 0);
    assert.equal(host.findAll('advisor-topic-advice').length, 0);
    assert.ok(host.findAll('advisor-status-row').some(x => x.textContent === I18n.t('UI_ADVISOR_EVALUATION_NO_CURRENT')));
}
I18n.setLanguage('ja');
assert.equal(JSON.stringify(known), before);
console.log('PASS advisor topic report DOM and bilingual dictionary contract');
