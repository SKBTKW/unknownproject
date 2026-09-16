const JA = Object.freeze({
    title: "捕らえられた斥候",
    desc: "境界を巡回していた者たちが、亜人の斥候を一人捕らえた。何を見られたのか、何を知っているのかは分からない。扱いを決めなければならない。",
    decision: "重大な判断", result: "結果", close: "閉じる", advisor: "側近の見解",
    EXECUTE: "処断する — 情報を持ち帰らせない",
    INTERROGATE: "拘束して尋問する — 情報を探る",
    RELEASE: "解放する — 衝突の拡大を避ける",
    RESULT_EXECUTE: "斥候は処断された。こちらで見たものを本人が持ち帰ることはない。ただし、この扱いが相手側にどう受け止められるかはまだ分からない。",
    RESULT_INTERROGATE: "斥候は拘束され、聞き取りが始まった。得られる情報の価値と確かさは、まだ分からない。",
    RESULT_RELEASE: "斥候は解放された。衝突を避ける余地は残るが、彼がここで見たものもまた持ち帰られる。",
    OUTER: "捕縛地点：人類の活動圏の外縁", MID: "捕縛地点：活動圏の内側", INNER: "捕縛地点：本営に比較的近い地域",
    CALM: "住民の反応：まだ大きな動揺はない", UNEASY: "住民の反応：不安が広がっている", ANGRY: "住民の反応：強硬な処置を求める声がある",
    NEAR_MAIN_ROAD: "主要な往来路の近くで見つかった", WATCHTOWER_SEEN: "見張りや防備を観察していた可能性がある", EXPERIENCED_SCOUT: "経験のある斥候と思われる", MAP_FRAGMENT_FOUND: "粗い地図片を所持していた", LIGHTLY_EQUIPPED: "軽装で偵察を目的としていたように見える", WOUNDED: "捕縛時にはすでに負傷していた"
});
const EN = Object.freeze({
    title: "Captured Scout", desc: "A frontier patrol captured a demihuman scout. We do not know exactly what was seen or known. A decision must be made.",
    decision: "Critical Decision", result: "Outcome", close: "Close", advisor: "Advisor's View",
    EXECUTE: "Do not allow the scout to return with information", INTERROGATE: "Detain and question the scout", RELEASE: "Release the scout to avoid immediate escalation",
    RESULT_EXECUTE: "The scout will not personally carry the observations back. How the other side interprets the decision remains unknown.", RESULT_INTERROGATE: "The scout remains in custody and questioning has begun. The value and reliability of anything learned are not yet known.", RESULT_RELEASE: "The scout was released. Immediate escalation may be avoided, but the observations leave with the scout.",
    OUTER: "Capture site: outer edge of human activity", MID: "Capture site: inside the active human domain", INNER: "Capture site: comparatively close to headquarters",
    CALM: "Public reaction: no major unrest yet", UNEASY: "Public reaction: unease is spreading", ANGRY: "Public reaction: some are demanding a harsher response",
    NEAR_MAIN_ROAD: "Found near a major route", WATCHTOWER_SEEN: "May have observed part of the watch and defenses", EXPERIENCED_SCOUT: "Appears to be an experienced scout", MAP_FRAGMENT_FOUND: "Carried a rough map fragment", LIGHTLY_EQUIPPED: "Lightly equipped for reconnaissance", WOUNDED: "Already wounded when captured"
});
export function choiceText(i18n, key) {
    const dict = i18n?.getLanguage?.() === "en" ? EN : JA;
    return dict[key] || i18n?.t?.(key) || key;
}
