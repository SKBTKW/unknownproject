// src/trials.js - 2D Grid Compatible 3-Zone Frontline Defense Trial Engine
export const ENEMY_TACTICS = [
  { id: 'et-assault', name: '強襲', desc: '制圧力 +10%', condition: null },
  { id: 'et-surprise', name: '奇襲', desc: '防衛力 -10', condition: '森' }
];

export const PLAYER_TACTICS = [
  {
    id: 'tactic-def-formation',
    name: '防御陣形',
    defBonus: 10,
    condition: null,
    desc: '防衛力+10 / 「強襲」が無効化された時、敵制圧力-10%',
    canUse: () => true,
    counterTarget: 'et-assault',
    powerReduce: 0.10
  },
  {
    id: 'tactic-ambush',
    name: '伏兵',
    defBonus: 0,
    condition: '森',
    desc: '使用条件：森 / 敵戦術を無効化 ＆ 敵制圧力-20%',
    canUse: () => true,
    counterTarget: 'any',
    powerReduce: 0.20
  }
];

export function calculateInitialTrialPower(state) {
  let totalBoardDefense = 0;
  let totalProductionAccumulated = state.food + state.materials;

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const tile = state.grid[y][x];
      if (tile.isOccupied || tile.isHQ) {
        totalBoardDefense += tile.getYield(state.fire, state.maxFire).def;
      }
    }
  }

  const initialPower = totalBoardDefense + Math.round(totalProductionAccumulated * 0.3);
  return { totalBoardDefense, totalProductionAccumulated, initialPower };
}

// 2Dグリッド適合：3方向（北翼・中央・南翼）の防衛線別防衛力集計
export function calculateZoneDefensePower(state) {
  let northDef = 0;
  let centerDef = 0;
  let southDef = 0;

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const tile = state.grid[y][x];
      if (tile.isOccupied || tile.isHQ) {
        const def = tile.getYield(state.fire, state.maxFire).def;
        if (y <= 2) northDef += def;
        else if (y <= 4) centerDef += def;
        else southDef += def;
      }
    }
  }

  return { northDef, centerDef, southDef };
}

// 代替案A：3方向（北翼・中央・南翼）防衛線別の選出 ＆ 制圧力分配
export function selectTrialBattlefields(state) {
  const { initialPower } = calculateInitialTrialPower(state);
  const zoneDef = calculateZoneDefensePower(state);

  const waveBattlefields = [
    {
      waveIndex: 1,
      zoneName: '北翼戦線 (上部)',
      tileDef: zoneDef.northDef,
      enemyPower: Math.round(initialPower * 0.50),
      enemyTactic: ENEMY_TACTICS[0],
      playerTactic: PLAYER_TACTICS[0]
    },
    {
      waveIndex: 2,
      zoneName: '中央戦線 (本営正面)',
      tileDef: zoneDef.centerDef,
      enemyPower: Math.round(initialPower * 0.20),
      enemyTactic: ENEMY_TACTICS[1],
      playerTactic: PLAYER_TACTICS[1]
    },
    {
      waveIndex: 3,
      zoneName: '南翼戦線 (下部)',
      tileDef: zoneDef.southDef,
      enemyPower: Math.round(initialPower * 0.30),
      enemyTactic: ENEMY_TACTICS[0],
      playerTactic: PLAYER_TACTICS[0]
    }
  ];

  return waveBattlefields;
}

// 3戦線解決エンジン (スライド通りの差分合算・動的判定)
export function resolveSlideExactTrialCombat(state, waveBattlefields) {
  const { initialPower } = calculateInitialTrialPower(state);
  let totalDiffSum = 0;
  const waveResults = [];

  waveBattlefields.forEach((wave, idx) => {
    let tileDef = wave.tileDef;
    let enemyPower = wave.enemyPower;
    let enemyTactic = wave.enemyTactic;
    let playerTactic = wave.playerTactic;

    let isEnemyTacticNegated = false;

    if (playerTactic) {
      tileDef += playerTactic.defBonus;
      if (playerTactic.counterTarget === 'any' || (enemyTactic && playerTactic.counterTarget === enemyTactic.id)) {
        isEnemyTacticNegated = true;
        enemyPower = Math.round(enemyPower * (1 - playerTactic.powerReduce));
      }
    }

    if (enemyTactic && !isEnemyTacticNegated) {
      if (enemyTactic.id === 'et-assault') {
        enemyPower = Math.round(enemyPower * 1.10);
      }
    }

    const waveDiff = tileDef - enemyPower;
    totalDiffSum += waveDiff;

    waveResults.push({
      waveIndex: idx + 1,
      zoneName: wave.zoneName,
      tileDef,
      enemyPower,
      waveDiff
    });
  });

  const finalScore = initialPower + totalDiffSum;
  const isSuccess = totalDiffSum >= 0;

  if (!isSuccess) {
    const loss = Math.abs(totalDiffSum);
    const fireLoss = Math.ceil(loss / 25);
    state.fire = Math.max(0, state.fire - fireLoss);
    state.addLog(`🚨 試練結果: 3戦線差分合計 ${totalDiffSum}。残り火 -${fireLoss}🔥 被害！`, 'warning');
    return { isSuccess: false, fireLoss, rank: 'D', totalDiffSum, finalScore, waveResults };
  } else {
    state.addLog(`✨ 試練結果: 3戦線完全防衛成功！ (差分合計 +${totalDiffSum})`, 'success');
    return { isSuccess: true, fireLoss: 0, rank: 'S', totalDiffSum, finalScore, waveResults };
  }
}
