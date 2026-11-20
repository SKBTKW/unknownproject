import assert from 'node:assert/strict';
import { getAdvisorRecords } from '../game/src/ui/advisor/advisor_record_adapter.js';
import { AdvisorContentController } from '../game/src/ui/advisor/advisor_content_controller.js';

class Element {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.textContent = ''; }
    appendChild(child) { this.children.push(child); return child; }
    replaceChildren() { this.children = []; }
}
globalThis.document = { createElement: tag => new Element(tag) };

const state = {
    turn: 12,
    gameLogs: ['[T12] settlement', '[T7] tracks'],
    knownEnemyState: { reports: [
        { id: 'r10', observedAtVerse: 10, observations: [{ facet: 'DIRECTION', tag: 'NORTH_ACTIVITY' }] },
        { id: 'r8', observedAtVerse: 8, observations: [
            { facet: 'DIRECTION', tag: 'NORTH_ACTIVITY' },
            { facet: 'PHYSIQUE', tag: 'LARGE_BODY_PRESENT' }
        ] }
    ] }
};
const original = JSON.stringify(state);
const records = getAdvisorRecords(state);
assert.deepEqual(records.map(x => x.turn), [12, 10, 8, 8, 7]);
assert.deepEqual(records.filter(x => x.valueKey).map(x => x.statusKey), [
    'INVESTIGATION_STATUS_RECONFIRMED',
    'INVESTIGATION_STATUS_NEW',
    'INVESTIGATION_STATUS_NEW'
]);
assert.ok(records.every(r => !('forceId' in r)));
assert.equal(getAdvisorRecords(state, 2).length, 2);
assert.deepEqual(getAdvisorRecords(state, 0), []);
assert.deepEqual(getAdvisorRecords({}, 20), []);
assert.equal(JSON.stringify(state), original);
assert.deepEqual(getAdvisorRecords(JSON.parse(original)), records);

const i18n = { t: (key, params = {}) => ({
    UI_ADVISOR_RECORD_TITLE: '記録',
    UI_ADVISOR_RECORD_EMPTY: '記録なし',
    UI_ADVISOR_RECORD_ROW: `[T${params.turn}] ${params.message}`,
    INVESTIGATION_STATUS_NEW: '新たに判明',
    INVESTIGATION_STATUS_RECONFIRMED: '再確認',
    INVESTIGATION_TAG_NORTH_ACTIVITY: '北方の活動痕跡',
    INVESTIGATION_TAG_LARGE_BODY_PRESENT: '巨大な足跡'
}[key] || key) };
const host = new Element('div');
new AdvisorContentController({ i18n, stateProvider: () => state }).renderRecords(host);
assert.equal(host.children.length, 6);
assert.equal(host.children[2].textContent, '[T10] 再確認: 北方の活動痕跡');
assert.equal(host.children[3].textContent, '[T8] 新たに判明: 北方の活動痕跡');
assert.ok(host.children.every(x => !x.textContent.includes('undefined')));
console.log('PASS AD DOC record timeline & DOM render');
