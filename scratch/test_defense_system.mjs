import {
    GameEngine,
    TopHeaderComponent
} from '../game/src/app.js';
import { serializeGameState } from '../game/src/core/state_serializer.js';

let total = 0;
let passed = 0;

function assert(condition, name, details = '') {
    total++;
    if (!condition) {
        console.error(`  ❌ ${name}${details ? `: ${details}` : ''}`);
        process.exitCode = 1;
        return;
    }
    passed++;
    console.log(`  ✅ ${name}`);
}

function snapshotResources(state) {
    return {
        food: state.food,
        wood: state.wood,
        mystic: state.mystic,
        currentDefense: state.currentDefense,
        maxDefense: state.maxDefense
    };
}

function defenseLand(defense = 3) {
    return {
        id: 'E2_HILL',
        terrainId: 'E2_HILL',
        nameKey: 'TERRAIN_HILL',
        category: 'LAND',
        gl: 1,
        e: 2,
        shape: [[1]],
        baseYieldsPerTile: { food: 0, wood: 0, defense, mystic: 0 }
    };
}

console.log('🛡️ DefenseSystem regression tests');

// A: 新規ゲームは本営基礎値で全快開始。
const initialEngine = GameEngine.createGame();
assert(initialEngine.defenseSystem.getCurrentDefense() === 10, '新規ゲームの現在🛡️は10');
assert(initialEngine.defenseSystem.getMaxDefense() === 10, '新規ゲームの最大🛡️は10');

// B/C: 最大値増加は現在値を回復しない。
const placed = initialEngine.gridEngine.placeShape(1, 2, [[1]], defenseLand(3));
assert(placed.success === true, '防衛値を持つ土地を配置できる');
assert(initialEngine.defenseSystem.getMaxDefense() === 13, '土地配置で最大🛡️だけが13へ増える');
assert(initialEngine.defenseSystem.getCurrentDefense() === 10, '最大🛡️増加後も現在🛡️は10のまま');

const expandedEngine = GameEngine.createGame();
expandedEngine.gridEngine.expandGrid(7);
assert(expandedEngine.defenseSystem.getMaxDefense() === 14, 'Stage盤面拡張後は強化本営から最大🛡️14を再計算する');
assert(expandedEngine.defenseSystem.getCurrentDefense() === 10, 'Stage盤面拡張でも現在🛡️は自動回復しない');

// D/F/G: 損耗・回復・最大低下時クランプ。
initialEngine.defenseSystem.setCurrentDefense(13);
const loss = initialEngine.applyTrialDefenseLoss(4);
assert(loss.after === 9 && initialEngine.defenseSystem.getMaxDefense() === 13, '損耗APIは現在🛡️だけを減らす');
const recovery = initialEngine.recoverCurrentDefense(99);
assert(recovery.after === 13, '回復APIは最大🛡️を超えない');
initialEngine.state.grid[1][2].placed = false;
initialEngine.state.grid[1][2].terrain = null;
const clamped = initialEngine.defenseSystem.reconcileWithMax();
assert(clamped.maxDefense === 10 && clamped.currentDefense === 10 && clamped.clamped, '最大🛡️低下時に現在🛡️をクランプする');

// E: Trial公開APIは現在値を返す。
initialEngine.defenseSystem.increaseMaxCapacity(10);
initialEngine.defenseSystem.setCurrentDefense(7);
assert(initialEngine.getTrialAvailableDefense() === 7, 'Trial投入可能量は現在🛡️を参照する');
assert(initialEngine.defenseSystem.getMaxDefense() === 20, 'Trial参照と最大🛡️は独立している');

// I-1: 仕様未確定時は再建せず、資源も変化させない。
const unresolvedEngine = GameEngine.createGame();
unresolvedEngine.defenseSystem.increaseMaxCapacity(5);
unresolvedEngine.defenseSystem.setCurrentDefense(7);
const beforeUnresolved = snapshotResources(unresolvedEngine.state);
const unresolved = unresolvedEngine.rebuildDefense();
assert(unresolved.success === false && unresolved.reason === 'REBUILD_COST_UNDEFINED', '再建コスト未定義時は明示的に拒否する');
assert(JSON.stringify(snapshotResources(unresolvedEngine.state)) === JSON.stringify(beforeUnresolved), '再建失敗時は資源と🛡️を変更しない');

// I-2: 通常資源での再建は原子的に支払い、最大まで一括回復する。
const rebuildEngine = GameEngine.createGame({
    defenseRebuildCostResolver: ({ missingDefense }) => ({ food: missingDefense, material: missingDefense + 1 })
});
rebuildEngine.defenseSystem.increaseMaxCapacity(4);
rebuildEngine.defenseSystem.setCurrentDefense(11);
rebuildEngine.state.food = 10;
rebuildEngine.state.wood = 10;
rebuildEngine.state.material = 10;
const rebuilt = rebuildEngine.rebuildDefense();
assert(rebuilt.success === true, '通常資源が足りる場合だけ再建が成功する');
assert(rebuildEngine.state.currentDefense === 14 && rebuildEngine.state.maxDefense === 14, '再建成功時に最大まで一括回復する');
assert(rebuildEngine.state.food === 7 && rebuildEngine.state.wood === 6 && rebuildEngine.state.mystic === 0, '再建成功時だけ所定資源を消費する');

// I-3: ✨補填は明示許可と確認の両方が必要。
const mysticEngine = GameEngine.createGame({
    defenseRebuildCostResolver: () => ({ food: 2, material: 2 }),
    defenseMysticFallbackResolver: () => 1
});
mysticEngine.defenseSystem.increaseMaxCapacity(2);
mysticEngine.defenseSystem.setCurrentDefense(8);
mysticEngine.state.food = 0;
mysticEngine.state.wood = 0;
mysticEngine.state.material = 0;
mysticEngine.state.mystic = 1;
const beforeMystic = snapshotResources(mysticEngine.state);
const noConsent = mysticEngine.rebuildDefense({ allowMysteryFallback: true });
assert(noConsent.success === false && noConsent.reason === 'MYSTIC_CONFIRMATION_REQUIRED', '✨補填は確認なしでは実行しない');
assert(JSON.stringify(snapshotResources(mysticEngine.state)) === JSON.stringify(beforeMystic), '✨補填キャンセル時は状態を変更しない');
const withConsent = mysticEngine.rebuildDefense({ allowMysteryFallback: true, confirmMysteryFallback: true });
assert(withConsent.success === true && mysticEngine.state.mystic === 0, '明示確認後のみ✨補填を実行する');
assert(mysticEngine.state.currentDefense === mysticEngine.state.maxDefense, '✨補填による再建も最大まで一括回復する');

// J: 配置ActionのUndoは現在値と最大値の両方を事前状態へ戻す。
const undoEngine = GameEngine.createGame();
undoEngine.defenseSystem.setCurrentDefense(8);
undoEngine.state.handOffering[0] = { id: 'TEST_DEFENSE_LAND', terrain: defenseLand(3), currentShape: [[1]] };
const action = undoEngine.placeLand(1, 2, undoEngine.state.handOffering[0], 0, { type: 'OFFERING', index: 0 });
assert(action.success === true && undoEngine.state.currentDefense === 8 && undoEngine.state.maxDefense === 13, '配置Actionでも現在維持・最大増加となる');
const undo = undoEngine.undoLastAction();
assert(undo.success === true && undoEngine.state.currentDefense === 8 && undoEngine.state.maxDefense === 10, 'Undoで現在🛡️と最大🛡️を配置前へ復元する');

const serialized = serializeGameState(undoEngine.state);
assert(serialized.currentDefense === 8 && serialized.maxDefense === 10, '直列化結果に現在🛡️と最大🛡️を保存する');

const staleEngine = GameEngine.createGame();
staleEngine.state.vigilanceTurns = 1;
staleEngine.state.vigilanceStartsNextTurn = false;
staleEngine.defenseSystem.setCurrentDefense(13);
staleEngine.state.vigilanceTurns = 0;
const reconciledSerialization = serializeGameState(staleEngine.state);
assert(reconciledSerialization.currentDefense === 10 && reconciledSerialization.maxDefense === 10, '直列化前に失効した最大値補正と現在値を整合させる');

// H: HUDは「現在 / 最大」で描画する。
const hudEngine = GameEngine.createGame();
hudEngine.defenseSystem.increaseMaxCapacity(5);
hudEngine.defenseSystem.setCurrentDefense(8);
const elements = new Map();
const ensureElement = id => {
    if (!elements.has(id)) elements.set(id, { innerText: '', style: {}, classList: { add() {}, remove() {} } });
    return elements.get(id);
};
ensureElement('mainTerritoryBadge');
const previousDocument = globalThis.document;
const header = new TopHeaderComponent({ state: hudEngine.state });
globalThis.document = {
    getElementById: id => (
        id === 'territoryBadgeFooterSlot' || id === 'territoryBadgeContainer'
            ? null
            : ensureElement(id)
    )
};
header.render({ t: key => key });
assert(ensureElement('valDefense').innerText === '8 / 15', 'HUDが現在🛡️ / 最大🛡️を表示する');
if (previousDocument === undefined) delete globalThis.document;
else globalThis.document = previousDocument;

console.log(`\nDefenseSystem: ${passed}/${total} PASS`);
if (passed !== total) process.exitCode = 1;
