import { GameEngine, GameState, DeckManager, CardCycleSystem, CYCLE_POLICIES, UndoLandSystem } from '../game/src/app.js';

console.log("=== Testing Offering Reincarnation Cooldown (CardCycleSystem) ===");

let passCount = 0;
let failCount = 0;
function assert(name, condition) {
    if (condition) {
        console.log(`  ✅ [PASS] ${name}`);
        passCount++;
    } else {
        console.error(`  ❌ [FAIL] ${name}`);
        failCount++;
    }
}

const engine = new GameEngine();
const state = engine.state;
const deckMgr = engine.deckManager;
const cycleSys = deckMgr.cycleSystem;

// 1. レアリティ別ジッター範囲 ＆ availableTurn 算出検証
console.log("\n[Test 1: Rarity Jitter & availableTurn]");
const cardC = { id: "TEST_C", rarity: "C", cyclePolicy: "RARITY" };
const cardUC = { id: "TEST_UC", rarity: "UC", cyclePolicy: "RARITY" };
const cardR = { id: "TEST_R", rarity: "R", cyclePolicy: "RARITY" };
const cardUR = { id: "TEST_UR", rarity: "UR", cyclePolicy: "RARITY" };
const cardLand = { id: "TEST_LAND", category: "LAND", rarity: "R", cyclePolicy: "LAND_STANDARD" };

let allCPass = true;
let allUCPass = true;
let allRPass = true;
let allURPass = true;
let allLandPass = true;

for (let i = 0; i < 100; i++) {
    const cdC = cycleSys.calculateCooldown(cardC);
    if (cdC !== 1) allCPass = false;

    const cdUC = cycleSys.calculateCooldown(cardUC);
    if (cdUC < 2 || cdUC > 4) allUCPass = false;

    const cdR = cycleSys.calculateCooldown(cardR);
    if (cdR < 6 || cdR > 8) allRPass = false;

    const cdUR = cycleSys.calculateCooldown(cardUR);
    if (cdUR < 14 || cdUR > 16) allURPass = false;

    const cdLand = cycleSys.calculateCooldown(cardLand);
    if (cdLand !== 1) allLandPass = false;
}
assert("C は 100回連続で CD=1 固定であること", allCPass);
assert("UC は 100回すべて CD=2〜4 (3±1) の範囲内であること", allUCPass);
assert("R は 100回すべて CD=6〜8 (7±1) の範囲内であること", allRPass);
assert("UR は 100回すべて CD=14〜16 (15±1) の範囲内であること", allURPass);
assert("LAND_STANDARD はレアリティに関わらず CD=1 固定であること", allLandPass);

// T5 提示時の availableTurn 式検証: av = 5 + cd + 1
state.turn = 5;
cycleSys.registerOffering([cardC], 5);
assert("T5 提示時: C の availableTurn が 7 (5 + 1 + 1) であること", state.cardCooldowns["TEST_C"] === 7);

// 2. 具現化された厳密な境界ターン検証
console.log("\n[Test 2: Exact Turn Boundaries]");
// C: av=7 (T5提示 ➔ T5除外, T6除外, T7復帰)
assert("T5: TEST_C は isInCooldown で true (除外)", cycleSys.isInCooldown("TEST_C", 5) === true);
assert("T6: TEST_C は isInCooldown で true (除外)", cycleSys.isInCooldown("TEST_C", 6) === true);
assert("T7: TEST_C は isInCooldown で false (復帰)", cycleSys.isInCooldown("TEST_C", 7) === false);

// UC (基準値 CD=3 ➔ av = 5 + 3 + 1 = 9)
state.cardCooldowns["TEST_UC_FIXED"] = 9;
assert("T5: TEST_UC は除外", cycleSys.isInCooldown("TEST_UC_FIXED", 5) === true);
assert("T6: TEST_UC は除外", cycleSys.isInCooldown("TEST_UC_FIXED", 6) === true);
assert("T7: TEST_UC は除外", cycleSys.isInCooldown("TEST_UC_FIXED", 7) === true);
assert("T8: TEST_UC は除外", cycleSys.isInCooldown("TEST_UC_FIXED", 8) === true);
assert("T9: TEST_UC は復帰", cycleSys.isInCooldown("TEST_UC_FIXED", 9) === false);

// R (基準値 CD=7 ➔ av = 5 + 7 + 1 = 13)
state.cardCooldowns["TEST_R_FIXED"] = 13;
assert("T12: TEST_R は除外", cycleSys.isInCooldown("TEST_R_FIXED", 12) === true);
assert("T13: TEST_R は復帰", cycleSys.isInCooldown("TEST_R_FIXED", 13) === false);

// 3. 同一ターン再生成不変性テスト (Idempotency)
console.log("\n[Test 3: Idempotency]");
state.turn = 10;
state.cardCooldowns["CARD_A"] = 18;
// Offering生成やマリガンが走っても CARD_A が再提示されない限り 18 のまま
const preAv = state.cardCooldowns["CARD_A"];
// 別カードのみで registerOffering
cycleSys.registerOffering([{ id: "CARD_B", rarity: "C", cyclePolicy: "RARITY" }], 10);
assert("別カードの Offering 処理で CARD_A の availableTurn (18) が不変であること", state.cardCooldowns["CARD_A"] === preAv);

// 4. Undo スナップショット正確復元テスト
console.log("\n[Test 4: Undo Snapshot Restoration]");
const undoSys = new UndoLandSystem(state);
state.cardCooldowns = { "CARD_X": 15 };
state.consumedUniqueCards = ["UNIQUE_1"];
state.grid = Array(5).fill(null).map(() => Array(5).fill(null).map(() => ({ placed: false })));
undoSys.captureSnapshot();

// 配置・発動により変更
state.cardCooldowns["CARD_X"] = 25;
state.consumedUniqueCards.push("UNIQUE_2");

// Undo 実行
undoSys.undo();
assert("Undo 実行後に cardCooldowns がスナップショット (15) へ復元されること", state.cardCooldowns["CARD_X"] === 15);
assert("Undo 実行後に consumedUniqueCards がスナップショット (['UNIQUE_1']) へ復元されること", state.consumedUniqueCards.length === 1 && state.consumedUniqueCards[0] === "UNIQUE_1");

// 5. UNIQUE 選択時消費テスト
console.log("\n[Test 5: UNIQUE Consumed-on-Selection]");
const uniqueCard = { id: "CMD_TEST_UNIQUE", category: "COMMAND", cyclePolicy: "UNIQUE", minStage: 1, cost: {} };
state.consumedUniqueCards = [];
state.usedUniqueCards = [];
state.cardCooldowns = {};
state.turn = 5;

// Offering に提示されただけでは consumedUniqueCards に入らない
cycleSys.registerOffering([uniqueCard], 5);
assert("Offering 提示直後: consumedUniqueCards に入っていないこと", !state.consumedUniqueCards.includes("CMD_TEST_UNIQUE"));

// 選択 (consumeUnique)
cycleSys.consumeUnique("CMD_TEST_UNIQUE");
assert("選択後: consumedUniqueCards に登録されること", state.consumedUniqueCards.includes("CMD_TEST_UNIQUE"));
assert("選択後: isCardEligible で false (永久除外) になること", deckMgr.isCardEligible(uniqueCard, 1, 0) === false);

// 冪等性テスト: 2回呼んでも配列が重複しないこと
cycleSys.consumeUnique("CMD_TEST_UNIQUE");
assert("consumeUnique の冪等性: 複数回呼んでも consumedUniqueCards に1件だけ存在すること", state.consumedUniqueCards.filter(id => id === "CMD_TEST_UNIQUE").length === 1);

// 6. Hold 連携検証
console.log("\n[Test 6: Hold Separation]");
state.reserveSlots = [null, null, null];
state.consumedUniqueCards = [];
state.cardCooldowns = { "CMD_R_IN_HOLD": 13 }; // T13 復帰予定
state.turn = 13; // すでに CD は明けている (13 < 13 は false)
assert("T13: Cooldown 自体は明けていること", cycleSys.isInCooldown("CMD_R_IN_HOLD", 13) === false);

// しかし Hold にある場合
state.reserveSlots[0] = { id: "CMD_R_IN_HOLD", cardMasterId: "CMD_R_IN_HOLD", category: "COMMAND" };
assert("Hold 中のカードは isInHold で true になること", deckMgr.isInHold("CMD_R_IN_HOLD") === true);
assert("Hold 中のカードは isCardEligible で false (手札重複除外) になること", deckMgr.isCardEligible({ id: "CMD_R_IN_HOLD", minStage: 1 }, 1, 0) === false);

// Hold から使用 (空スロット化) された後
state.reserveSlots[0] = null;
assert("Hold 解除後: isCardEligible で true (復帰) になること", deckMgr.isCardEligible({ id: "CMD_R_IN_HOLD", minStage: 1 }, 1, 0) === true);

// 7. フォールバック時の Cooldown 再登録検証
console.log("\n[Test 7: Fallback Re-registration]");
state.turn = 10;
// 全カードが Cooldown 中の極限状況をシミュレート
const master = deckMgr.getLandCardMaster();
for (const c of master) {
    state.cardCooldowns[c.id] = 50; // 全て T50 まで CD
}
// 1枚だけ T30 に設定 (最小 CD, レアリティ R に設定)
master[0].cyclePolicy = "RARITY";
master[0].rarity = "R";
state.cardCooldowns[master[0].id] = 30;
const minCardId = master[0].id;

const offered = deckMgr.generateOfferingCards();
assert("極限状況でも必ず 3 枚の Offering が成立すること", offered.length === 3);
// 採用されたカードの availableTurn が現在ターン (T10) 基準で新しく再登録されていること (T10 + [6〜8] + 1 = 17〜19)
assert("採用されたカードの availableTurn が T10 基準 (17〜19) で新しく更新されていること", state.cardCooldowns[minCardId] >= 17 && state.cardCooldowns[minCardId] <= 19);

console.log(`\n========================================`);
console.log(`Results: ${passCount} Passed, ${failCount} Failed`);
if (failCount > 0) process.exit(1);
