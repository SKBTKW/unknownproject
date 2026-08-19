const fs = require('fs');
const path = require('path');

// 1. Read main_hybrid.js
const hybridPath = path.join(__dirname, 'game', 'src', 'main_hybrid.js');
let code = fs.readFileSync(hybridPath, 'utf8');

// 2. Replacements dictionary
const replacements = [
  // UI and resources
  { from: '? 残り火', to: '🔥 残り火' },
  { from: '? 食料', to: '🌾 食料' },
  { from: '? ?', to: '🧱 資材' },
  { from: '??? 防衛力', to: '🛡️ 防衛力' },
  { from: '神? (Mystic)', to: '神秘 (Mystic)' },
  { from: '?の生命活動', to: '集落の生命活動' },
  { from: '?の生存維持', to: '集落の生存維持' },
  { from: '精霊との交信??', to: '精霊との交信や奇跡' },
  { from: '「神秘??」', to: '「神秘の奇跡」' },
  { from: 'グローバル??', to: 'グローバル奇跡（' },
  { from: '神罰など?', to: '神罰など）' },
  { from: '30 ?', to: '30 🔥' },
  { from: '-1 ?/ターン', to: '-1 🔥/ターン' },
  { from: '-1 ? のペナル', to: '-1 🔥 のペナル' },
  { from: 'ペナル?がありま', to: 'ペナルティがありま' },
  { from: '食料?による', to: '食料備蓄による' },
  { from: '食料 ?-20', to: '食料 🌾-20' },
  { from: '?-20 を支払', to: '🌾-20 を支払' },
  { from: '残量に応じて、残り火の減衰が変化します?<br>', to: '残量に応じて、残り火の減衰が変化します！<br>' },
  { from: '支払後?残量? ? 500', to: '支払後の残量が 🌾 500' },
  { from: '+1 ? (大豊作', to: '+1 🔥 (大豊作' },
  { from: '支払後?残量? ? 200', to: '支払後の残量が 🌾 200' },
  { from: '0 ? (十?な', to: '0 🔥 (十分な' },
  { from: '十?な食料による残り火の維?', to: '十分な食料による残り火の維持' },
  { from: '支払後?残量? ? 200 未満', to: '支払後の残量が 🌾 200 未満' },
  { from: '-1 ? (通常', to: '-1 🔥 (通常' },
  { from: '開始時の食料? ? 20 未満', to: '開始時の食料が 🌾 20 未満' },
  { from: '-2 ? (深刻', to: '-2 🔥 (深刻' },
  { from: '残り火の大?退', to: '残り火の大幅衰退' },
  { from: '現在の残り火: <b>${state.fire} / ${state.maxFire} ?</b>', to: '現在の残り火: <b>${state.fire} / ${state.maxFire} 🔥</b>' },
  { from: '毎ターン終?の変化見込み: ${sign}${netChange} ?', to: '毎ターン終了時の変化見込み: ${sign}${netChange} 🔥' },
  { from: '食料備蓄/維持影響: ${foodBonus >= 0 ? "+" : ""}${foodBonus} ?', to: '食料備蓄/維持影響: ${foodBonus >= 0 ? "+" : ""}${foodBonus} 🔥' },
  { from: '現在備蓄: ?${state.food}', to: '現在備蓄: 🌾${state.food}' },
  { from: '保留ペナル?: -${reservePenalty} ?', to: '保留ペナルティ: -${reservePenalty} 🔥' },
  { from: '保留カード数: ${state.reserve.filter(c => c !== null).length}?', to: '保留カード数: ${state.reserve.filter(c => c !== null).length}枚' },
  { from: '残り火へ??', to: '残り火へ捧ぐ' },
  { from: 'スロ?に捨てる', to: 'スロットに捨てる' },
  { from: '+1 ? を得る', to: '+1 🔥 を得る' },
  { from: 'ことができます?', to: 'ことができます。' },
  { from: '維持コストとして ?-20 が?動消費', to: '維持コストとして 🌾-20 が自動消費' },
  { from: '消費後?残り食料', to: '消費後の残り食料' },
  { from: '応じて??', to: '応じて：' },
  { from: '? 500 以?: +1 ?', to: '🌾 500 以上: +1 🔥' },
  { from: '? 200 以?: 0 ?', to: '🌾 200 以上: 0 🔥' },
  { from: '残り火維?', to: '残り火維持' },
  { from: '? 200 未満: -1 ?', to: '🌾 200 未満: -1 🔥' },
  { from: '開始時に ? 20 未満: -2 ?', to: '開始時に 🌾 20 未満: -2 🔥' },
  { from: '現在の備蓄?: <b>? ${state.food}</b>', to: '現在の備蓄量: <b>🌾 ${state.food}</b>' },
  { from: '現在の毎ターン総生産?: <b>? +${yields.food}</b>', to: '現在の毎ターン総生産量: <b>🌾 +${yields.food}</b>' },
  { from: '生産?:', to: '生産内訳:' },
  { from: '施設の建設?会制度のアンロ?、土地の結合?レベルア???などに消費される重要な??です?', to: '施設の建設や社会制度のアンロック、土地の結合（レベルアップ）などに消費される重要な建築資源です。' },
  { from: '現在の備蓄?: <b>? ${state.materials}</b>', to: '現在の備蓄量: <b>🧱 ${state.materials}</b>' },
  { from: '現在の毎ターン総生産?: <b>? +${yields.materials}</b>', to: '現在の毎ターン総生産量: <b>🧱 +${yields.materials}</b>' },
  { from: '試練?襲来する??から集落を守るための戦闘力?<b>防衛力は?されず、毎ターン開始時に 0 にリセ?されます?</b>', to: '試練（襲来する脅威）から集落を守るための戦闘力。<b>防衛力は蓄積されず、毎ターン開始時に 0 にリセットされます。</b>' },
  { from: '?ーン終?に土地?設から生産される防衛力と、そのターン中に使用した軍事カード?効果?効果?合計値が、そのターンの「総防衛力」となり、試練襲来時?防御判定に使用されます?', to: '毎ターン終了時に土地や施設から生産される防衛力と、そのターン中に使用した軍事カードの効果の合計値が、そのターンの「総防衛力」となり、試練襲来時の防御判定に使用されます。' },
  { from: '現在の当ターン防衛力: <b>??? ${state.defense}</b>', to: '現在の当ターン防衛力: <b>🛡️ ${state.defense}</b>' },
  { from: '毎ターン自動で得られる生産?: <b>??? +${yields.defense}</b>', to: '毎ターン自動で得られる生産量: <b>🛡️ +${yields.defense}</b>' },
  { from: '現在の備蓄?: <b>✨ ${state.mystic}</b>', to: '現在の備蓄量: <b>✨ ${state.mystic}</b>' },
  { from: '現在の毎ターン総生産?: <b>✨ +${yields.mystic}</b>', to: '現在の毎ターン総生産量: <b>✨ +${yields.mystic}</b>' },
  { from: 'スロ? ${index}', to: 'スロット ${index}' },

  // Legacies & Disasters
  { from: '? ${getLegacyDisplayName(k)}', to: '📜 ${getLegacyDisplayName(k)}' },
  { from: '災害な?', to: '災害なし' },
  { from: '? ${getTerrainDisplayName', to: '⚠️ ${getTerrainDisplayName' },
  { from: 'の荒?</span>', to: 'の荒れ地</span>' },
  { from: '大地震教?', to: '大地震の教訓' },
  { from: '疫?策?教?', to: '疫病対策の教訓' },
  { from: '飢饉対策?教?', to: '飢饉対策の教訓' },
  { from: '不屈?精?', to: '不屈の精神' },
  { from: '??凱?', to: '将軍の凱旋' },
  { from: '預言??叡智', to: '預言者の叡智' },
  { from: '開拓??適?', to: '開拓者の適応' },

  // Terrain names
  { from: "return '?';", to: "return '湖';" },
  { from: "return '砂?';", to: "return '砂漠';" },
  { from: "return '森?';", to: "return '森林';" },
  { from: "return '砂?山岳';", to: "return '砂漠山岳';" },
  { from: "case ATTRIBUTES.JUNGLE: return '森?';", to: "case ATTRIBUTES.JUNGLE: return '森林';" },
  { from: "case ATTRIBUTES.DESERT: return '砂?';", to: "case ATTRIBUTES.DESERT: return '砂漠';" },
  { from: "case ATTRIBUTES.RIVER: return '?';", to: "case ATTRIBUTES.RIVER: return '川';" },
  { from: "case BONUSES.FRUIT: return '果?';", to: "case BONUSES.FRUIT: return '果物';" },
  { from: "case BONUSES.LIVESTOCK: return '家?';", to: "case BONUSES.LIVESTOCK: return '家畜';" },
  { from: "case BONUSES.VEIN: return '鉱?';", to: "case BONUSES.VEIN: return '鉱石';" },
  { from: "case BONUSES.PRECIOUS: return '貴金?';", to: "case BONUSES.PRECIOUS: return '貴金属';" },
  { from: "case BONUSES.TIMBER: return '高級木?';", to: "case BONUSES.TIMBER: return '高級木材';" },

  // Trial Approaching Modal
  { from: '? 警告：第', to: '⚠️ 警告：第' },
  { from: 'の試練襲来?', to: 'の試練襲来！' },
  { from: '??? 亜人軍勢の襲来が検知されました ???', to: '🚨 亜人軍勢の襲来が検知されました 🚨' },
  { from: '今ターン終??落の防衛?力を問う', to: '今ターン終了時、集落の防衛能力を問う' },
  { from: '準備を?れ???土の崩壊を招きます?', to: '準備を怠れば、領土の崩壊を招きます。' },
  { from: '⚔? 襲来??:', to: '⚔️ 襲来情報:' },
  { from: '予測敵勢?:', to: '予測敵勢力:' },
  { from: '敵戦? (Tactic):', to: '敵戦術 (Tactic):' },
  { from: '?効?:', to: '効果:' },
  { from: 'tactic.desc}??', to: 'tactic.desc}' },
  { from: '施設建設?体?変更を行い?衛力を極限まで高めてください??', to: '施設建設や政体の変更を行い、防衛力を極限まで高めてください！' },
  { from: '専制君主制」が選択可能になりました??', to: '専制君主制」が選択可能になりました！' },
  { from: '神聖君主制」が選択可能になりました??', to: '神聖君主制」が選択可能になりました！' },
  { from: '開拓民主制」が選択可能になりました??', to: '開拓民主制」が選択可能になりました！' },

  // Polity locks
  { from: '有効化コス?: ? ${displayCost}', to: '有効化コスト: 🔥 ${displayCost}' },
  { from: '? ${data.req}', to: '条件: ${data.req}' },

  // Bribe buttons
  { from: '🌾 食料-20 で買収する', to: '🌾 食料-20 で買収する' },
  { from: '🧱 資材-20 で買収する', to: '🧱 資材-20 で買収する' }
];

// 3. Apply replacements
replacements.forEach(r => {
  code = code.split(r.from).join(r.to);
});

// Write to final game/src/main.js
const targetFilePath = path.join(__dirname, 'game', 'src', 'main.js');
fs.writeFileSync(targetFilePath, code, 'utf8');
console.log('Successfully wrote the final clean main.js!');
