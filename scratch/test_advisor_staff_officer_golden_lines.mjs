import assert from 'node:assert/strict';
import { ADVISOR_SCENES } from '../game/src/data/advisor_scene_catalog.js';
import { STAFF_OFFICER_REACTIONS } from '../game/src/data/advisor_staff_officer_reactions.js';

const reactions = STAFF_OFFICER_REACTIONS.reactions;
const golden = Object.freeze({
    [ADVISOR_SCENES.LARGE_EXPANSION]: '広がりましたね。……補給が追いつけばよいのですが。',
    [ADVISOR_SCENES.REFUGEES_FOUND]: '収容可能数を確認します。……受け入れられる人数から。',
    [ADVISOR_SCENES.CIVILIANS_LOST]: '……名簿を。確認が必要です。',
    [ADVISOR_SCENES.TRIAL_WARNING]: '……備えを確認します。',
    [ADVISOR_SCENES.TRIAL_INTERCEPTION_CONFIRMED]: '承知しました。配置を確定します。',
    [ADVISOR_SCENES.TRIAL_REGION_ABANDONED]: '……撤収を開始します。取り残される者が出ないように。',
    [ADVISOR_SCENES.TRIAL_PREPARED_DEFENSE_SUCCESS]: '備えた分だけ、残りました。',
    [ADVISOR_SCENES.TRIAL_SURVIVED_UNDAMAGED]: '残火への損害はありません。……備えが効きました。',
    [ADVISOR_SCENES.TRIAL_SURVIVED_DAMAGED]: '敵は退きました。……損害の確認を始めます。',
    [ADVISOR_SCENES.TRIAL_VICTORY_WITH_CIVILIAN_LOSS]: '勝敗の記録は後で結構です。……名簿を。',
    [ADVISOR_SCENES.TRIAL_DESPERATE_STAND_SUCCESS]: '……生き残りましたね。',
    [ADVISOR_SCENES.THIRD_TRIAL_VICTORY]: '……終わりました。',
    [ADVISOR_SCENES.RUN_CLEAR]: 'これだけ残せたのなら……十分です。',
    [ADVISOR_SCENES.GAME_OVER]: '……最後まで、確認します。'
});
for (const [scene, line] of Object.entries(golden)) {
    assert.equal(reactions[scene]?.lines?.[0], line, `${scene} golden line drifted`);
}
for (const [scene, reaction] of Object.entries(reactions)) {
    for (const line of reaction.lines || []) {
        for (const pattern of [/正しい/, /素晴らしい/, /最善/, /正解/, /ほかに優先すべきものはありません/]) {
            assert.ok(!pattern.test(line), `${scene} contains grading or optimal-answer language: ${line}`);
        }
    }
}
console.log('staff officer golden reaction lines: ok');
