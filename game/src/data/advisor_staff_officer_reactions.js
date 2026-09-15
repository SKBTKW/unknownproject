import { ADVISOR_EXPRESSIONS, ADVISOR_SCENES } from "./advisor_scene_catalog.js";

// Character reaction data only. Required gameplay guidance belongs to Advisor Duty,
// and must remain available independently of this table.
// Missing scene = intentional silence.
export const STAFF_OFFICER_REACTIONS = Object.freeze({
    id: "STAFF_OFFICER",
    reactions: Object.freeze({
        [ADVISOR_SCENES.SEVERAL_LANDS_PLACED]: {
            expression: ADVISOR_EXPRESSIONS.NORMAL,
            lines: ["順調です。このまま進めましょう。"]
        },
        [ADVISOR_SCENES.LARGE_EXPANSION]: {
            expression: ADVISOR_EXPRESSIONS.CONCERNED,
            lines: ["広がりましたね。……補給が追いつけばよいのですが。"]
        },
        [ADVISOR_SCENES.FOOD_CRITICAL]: {
            expression: ADVISOR_EXPRESSIONS.CONCERNED,
            lines: ["食料が危険域です。ほかに優先すべきものはありません。"]
        },
        [ADVISOR_SCENES.REFUGEES_FOUND]: {
            expression: ADVISOR_EXPRESSIONS.CONCERNED,
            lines: ["収容可能数を確認します。……まず、入れるだけ入れましょう。"]
        },
        [ADVISOR_SCENES.CIVILIANS_LOST]: {
            expression: ADVISOR_EXPRESSIONS.CONCERNED,
            lines: ["……名簿を。確認が必要です。"]
        },
        [ADVISOR_SCENES.TRIAL_WARNING]: {
            expression: ADVISOR_EXPRESSIONS.TENSE,
            lines: ["……備えを確認します。"]
        },
        [ADVISOR_SCENES.TRIAL_INTERCEPTION_CONFIRMED]: {
            expression: ADVISOR_EXPRESSIONS.NORMAL,
            lines: ["承知しました。配置を確定します。"]
        },
        [ADVISOR_SCENES.TRIAL_REGION_ABANDONED]: {
            expression: ADVISOR_EXPRESSIONS.CONCERNED,
            lines: ["……撤収を開始します。残せる者が出ないように。"]
        },
        [ADVISOR_SCENES.TRIAL_PREPARED_DEFENSE_SUCCESS]: {
            expression: ADVISOR_EXPRESSIONS.SATISFIED,
            lines: ["備えた分だけ、残りました。"]
        },
        [ADVISOR_SCENES.TRIAL_PYRRHIC_VICTORY]: {
            expression: ADVISOR_EXPRESSIONS.CONCERNED,
            lines: ["敵は退きました。……こちらの損耗を確認します。"]
        },
        [ADVISOR_SCENES.TRIAL_VICTORY_WITH_CIVILIAN_LOSS]: {
            expression: ADVISOR_EXPRESSIONS.CONCERNED,
            lines: ["勝敗の記録は後で結構です。……名簿を。"]
        },
        [ADVISOR_SCENES.TRIAL_DESPERATE_STAND_SUCCESS]: {
            expression: ADVISOR_EXPRESSIONS.SATISFIED,
            lines: ["……生き残りましたね。"]
        },
        [ADVISOR_SCENES.THIRD_TRIAL_VICTORY]: {
            expression: ADVISOR_EXPRESSIONS.SATISFIED,
            lines: ["……終わりました。"]
        },
        [ADVISOR_SCENES.RUN_CLEAR]: {
            expression: ADVISOR_EXPRESSIONS.SATISFIED,
            lines: ["これだけ残せたのなら……十分です。"]
        },
        [ADVISOR_SCENES.GAME_OVER]: {
            expression: ADVISOR_EXPRESSIONS.CONCERNED,
            lines: ["……最後まで、確認します。"]
        }
    })
});
