import assert from 'node:assert/strict';
import { projectAdvisorReportTopics } from '../game/src/ui/advisor/advisor_topic_report_projector.js';

const state = {
    gameLogs: ['[T1] arbitrary text about a forest'],
    knownEnemyState: {
        reports: [
            { id: 'r2', observedAtVerse: 10, observations: [
                { facet: 'DIRECTION', tag: 'NORTH_ACTIVITY' },
                { facet: 'PHYSIQUE', tag: 'LARGE_BODY_PRESENT' }
            ] },
            { id: 'r1', observedAtVerse: 8, observations: [
                { facet: 'DIRECTION', tag: 'NORTH_ACTIVITY' }
            ] }
        ]
    }
};
const before = JSON.stringify(state);
const projection = projectAdvisorReportTopics(state);
assert.deepEqual(projection.map(t => t.id), ['ENEMY', 'LAND', 'STATUS']);
const enemy = projection[0].entries;
assert.deepEqual(enemy.map(e => e.verse), [8, 10, 10]);
assert.equal(enemy[0].statusKey, 'INVESTIGATION_STATUS_NEW');
assert.equal(enemy.find(e => e.verse === 10 && e.tag === 'NORTH_ACTIVITY').statusKey, 'INVESTIGATION_STATUS_RECONFIRMED');
assert.ok(enemy.some(e => e.valueKey === 'INVESTIGATION_TAG_LARGE_BODY_PRESENT'));
assert.equal('forceId' in enemy[2], false);
assert.deepEqual(projection[1].entries, [], 'free-form logs cannot establish land facts');
assert.equal(JSON.stringify(state), before, 'projection must not mutate truth/history');
assert.equal(projectAdvisorReportTopics({})[0].entries.length, 0);
console.log('PASS advisor topic report projector');
