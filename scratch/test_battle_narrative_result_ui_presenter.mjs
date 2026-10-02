import assert from "node:assert/strict";
import { renderBattleExplanationHtml } from "../game/src/ui/battle_explanation_ui_presenter.js";

const I18n = {
    t(key, params = {}) {
        const labels = {
            UI_TRIAL_BATTLE_EXPLANATION_TITLE: "戦闘の経緯",
            UI_TRIAL_BATTLE_WHAT: "何が起きたか",
            UI_TRIAL_BATTLE_WHY: "なぜ起きたか",
            UI_TRIAL_BATTLE_DECISIVE: "決定的だったこと",
            UI_TRIAL_BATTLE_CONSEQUENCE: "何につながったか",
            UI_TRIAL_BATTLE_FORTUNE: "介入",
            UI_TRIAL_BATTLE_NORMAL_RESULT: "通常結果",
            UI_TRIAL_BATTLE_FINAL_RESULT: "最終結果",
            UI_TRIAL_BATTLE_CAUSE_TERRAIN_ADVANTAGE: "地形上の優位を得た",
            UI_TRIAL_BATTLE_CONSEQUENCE_SUPPORT_DELAYED: "敵支援が遅延した",
            UI_TRIAL_BATTLE_FORTUNE_ROLL: `2D6: ${params.total}`,
            UI_TRIAL_OUTCOME_REPEL: "撃退"
        };
        return labels[key] ?? key;
    }
};

const normalReadModel = {
    narrative: {
        explanation: {
            what: { source: "NORMAL_OUTCOME", result: { outcome: "REPEL" } },
            normalResult: { outcome: "REPEL" },
            why: [{ causeId: "C1", type: "TERRAIN_ADVANTAGE", sourceAction: "A1" }],
            decisive: null,
            consequences: [{ consequenceId: "K1", type: "SUPPORT_DELAYED" }],
            fortune: { present: false, status: "NONE", roll: null },
            finalResult: null
        }
    }
};
const normalHtml = renderBattleExplanationHtml(normalReadModel, I18n);
assert.match(normalHtml, /戦闘の経緯/);
assert.match(normalHtml, /通常結果: 撃退/);
assert.match(normalHtml, /地形上の優位を得た/);
assert.match(normalHtml, /敵支援が遅延した/);
assert.doesNotMatch(normalHtml, /2D6/);

const fortuneReadModel = {
    narrative: {
        explanation: {
            what: { source: "FINAL_COMBAT_RESULT", result: { outcome: "REPEL" } },
            normalResult: { outcome: "REPEL" },
            why: [],
            decisive: { eventId: "D1", type: "<DECISIVE_EVENT>" },
            consequences: [],
            fortune: { present: true, status: "RESOLVED", roll: { total: 9 } },
            finalResult: { outcome: "REPEL" }
        }
    }
};
const fortuneHtml = renderBattleExplanationHtml(fortuneReadModel, I18n);
assert.match(fortuneHtml, /最終結果: 撃退/);
assert.match(fortuneHtml, /2D6: 9/);
assert.match(fortuneHtml, /&lt;DECISIVE EVENT&gt;/);
assert.doesNotMatch(fortuneHtml, /<DECISIVE_EVENT>/);

assert.equal(renderBattleExplanationHtml(null, I18n), "");
assert.equal(renderBattleExplanationHtml({ narrative: {} }, I18n), "");

console.log("✅ Battle Narrative result UI presenter focused test PASS");
