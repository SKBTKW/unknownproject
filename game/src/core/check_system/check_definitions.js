/**
 * 📜 CHECK_DEFINITIONS (汎用判定定義マスターデータ)
 * 
 * 責務:
 * 1. 各判定のダイス仕様（個数・面数・抽出ルール）を定義する。
 * 2. 判定結果帯（outcomes: failure, mixed, success, great_success 等）を定義する。
 * 3. 各 outcome は重複なく、かつ出目範囲に空白（穴）がない完全な排他区間として定義する。
 */

export const CHECK_DEFINITIONS = {
    // 🎲 標準 2D6 判定 (PbtA / TRPG スタイル)
    "standard_2d6": {
        id: "standard_2d6",
        nameKey: "CHECK_STANDARD_2D6_NAME",
        dice: { count: 2, sides: 6, keep: "all" },
        outcomes: [
            { max: 5,               id: "failure",       nameKey: "CHECK_OUTCOME_FAILURE" },
            { min: 6,  max: 8,      id: "mixed",         nameKey: "CHECK_OUTCOME_MIXED" },
            { min: 9,  max: 10,     id: "success",       nameKey: "CHECK_OUTCOME_SUCCESS" },
            { min: 11,              id: "great_success", nameKey: "CHECK_OUTCOME_GREAT_SUCCESS" }
        ]
    },

    // ⚔️ 試練・迎撃戦術判定 (Trial Tactics)
    "trial_intercept": {
        id: "trial_intercept",
        nameKey: "CHECK_TRIAL_INTERCEPT_NAME",
        dice: { count: 2, sides: 6, keep: "all" },
        outcomes: [
            { max: 5,               id: "failure",       nameKey: "CHECK_OUTCOME_FAILURE" },
            { min: 6,  max: 8,      id: "mixed",         nameKey: "CHECK_OUTCOME_MIXED" },
            { min: 9,  max: 10,     id: "success",       nameKey: "CHECK_OUTCOME_SUCCESS" },
            { min: 11,              id: "great_success", nameKey: "CHECK_OUTCOME_GREAT_SUCCESS" }
        ]
    },

    // 🔮 神託判定 (3D6 から上位 2 個を採用)
    "oracle_check": {
        id: "oracle_check",
        nameKey: "CHECK_ORACLE_NAME",
        dice: { count: 3, sides: 6, keep: "highest_2" },
        outcomes: [
            { max: 6,               id: "failure",       nameKey: "CHECK_OUTCOME_FAILURE" },
            { min: 7,  max: 9,      id: "mixed",         nameKey: "CHECK_OUTCOME_MIXED" },
            { min: 10, max: 11,     id: "success",       nameKey: "CHECK_OUTCOME_SUCCESS" },
            { min: 12,              id: "great_success", nameKey: "CHECK_OUTCOME_GREAT_SUCCESS" }
        ]
    },

    // 🌪️ 過酷な試練判定
    "harsh_check": {
        id: "harsh_check",
        nameKey: "CHECK_HARSH_NAME",
        dice: { count: 2, sides: 6, keep: "all" },
        outcomes: [
            { max: 7,               id: "failure",       nameKey: "CHECK_OUTCOME_FAILURE" },
            { min: 8,  max: 9,      id: "mixed",         nameKey: "CHECK_OUTCOME_MIXED" },
            { min: 10, max: 11,     id: "success",       nameKey: "CHECK_OUTCOME_SUCCESS" },
            { min: 12,              id: "great_success", nameKey: "CHECK_OUTCOME_GREAT_SUCCESS" }
        ]
    }
};
