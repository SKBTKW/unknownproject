const fs = require('fs');
const path = require('path');

// 1. Read main_hybrid.js as template
const templatePath = path.join(__dirname, 'game', 'src', 'main_hybrid.js');
let code = fs.readFileSync(templatePath, 'utf8');

// Helper to replace a function by its signature
function replaceFunction(signature, body) {
  const startIdx = code.indexOf(signature);
  if (startIdx === -1) {
    console.error(`Failed to locate signature: ${signature}`);
    process.exit(1);
  }
  
  let openBraces = 0;
  let endIdx = -1;
  let codeStarted = false;
  
  for (let i = startIdx; i < code.length; i++) {
    if (code[i] === '{') {
      openBraces++;
      codeStarted = true;
    } else if (code[i] === '}') {
      openBraces--;
      if (codeStarted && openBraces === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }
  
  if (endIdx === -1) {
    console.error(`Failed to find closing brace for signature: ${signature}`);
    process.exit(1);
  }
  
  code = code.slice(0, startIdx) + body + code.slice(endIdx);
  console.log(`Replaced function: ${signature.split('\n')[0]}`);
}

// 2. Replacements for the remaining corrupted functions
// A. showResourceDetail
replaceFunction('function showResourceDetail(key) {', `function showResourceDetail(key) {
  const modal = el.modalGenericEvent;
  modal.style.display = 'flex';

  const imgEl = document.getElementById('generic-event-image');
  if (imgEl) {
    imgEl.style.backgroundImage = "none";
  }

  document.getElementById('generic-event-icon').style.display = 'block';

  const titleEl = document.getElementById('generic-event-title');
  const descEl = document.getElementById('generic-event-text');
  const breakdownEl = document.getElementById('generic-event-options');

  let title = "";
  let desc = "";
  let breakdown = "";

  if (key === 'fire') {
    title = "🔥 残り火 (Fire)";
    desc = "集落の生命活動を維持するための残り火。毎ターン終了時に一定量減少し、0 になるとゲームオーバーになります。<br><br>" +
           "・最大上限: 30 🔥<br>" +
           "・基本減衰: -1 🔥/ターン (保留エリアにカードが残っている場合、さらに -1 🔥 のペナルティがあります)。<br>" +
           "・食料備蓄による維持コストと影響:<br>" +
           "  - 毎ターン終了時に食料 🌾-20 が自動的に維持コストとして消費されます。<br>" +
           "  - 🌾-20 を支払った後の残量に応じて、残り火の減衰が変化します！<br>" +
           "    - 支払後の残量が 🌾 500 以上: +1 🔥 (大豊作による残り火の自然増加)<br>" +
           "    - 支払後の残量が 🌾 200 以上: 0 🔥 (十分な食料による残り火の維持)<br>" +
           "    - 支払後の残量が 🌾 200 未満: -1 🔥 (通常の残り火減衰)<br>" +
           "    - 開始時の食料が 🌾 20 未満 (維持コスト不足): -2 🔥 (深刻な飢餓による残り火の大幅衰退)";
    
    const yields = state.calculateTotalProduction();
    const reservePenalty = state.reserve.filter(c => c !== null).length;
    const foodBonus = state.food >= 500 ? 1 : (state.food >= 200 ? 0 : (state.food >= 20 ? -1 : -2));
    const netChange = -1 - reservePenalty + foodBonus;
    const sign = netChange >= 0 ? "+" : "";

    breakdown = \`現在の残り火: <b>\${state.fire} / \${state.maxFire} 🔥</b><br><br>\` +
                \`<b>毎ターン終了時の変化見込み: \${sign}\${netChange} 🔥</b><br>\` +
                \`・食料備蓄/維持影響: \${foodBonus >= 0 ? "+" : ""}\${foodBonus} 🔥 (現在備蓄: 🌾\${state.food})<br>\` +
                \`・保留ペナルティ: -\${reservePenalty} 🔥 (保留カード数: \${state.reserve.filter(c => c !== null).length}枚)<br><br>\` +
                \`<span style="color: #f87171; font-size: 0.72rem;">※不要なカードを「残り火へ捧ぐ」スロットに捨てることで、いつでも +1 🔥 を得ることができます。</span>\`;
  }
  else if (key === 'food') {
    title = "🌾 食料 (Food)";
    desc = "集落の生存維持に必要な食料。毎ターン終了時に<b>維持コストとして 🌾-20 が自動消費</b>されます。<br><br>" +
           "・消費後の残り食料に応じて：<br>" +
           "  - 🌾 500 以上: 残り火が毎ターン +1 自然回復<br>" +
           "  - 🌾 200 以上: 残り火の減衰を 0 に維持<br>" +
           "  - 🌾 200 未満: -1 🔥 (通常減衰)<br>" +
           "  - 開始時に 🌾 20 未満: -2 🔥 (飢餓による衰退)";
    
    const yields = state.calculateTotalProduction();
    breakdown = \`現在の備蓄量: <b>🌾 \${state.food}</b><br>\` +
                \`現在の毎ターン総生産量: <b>🌾 +\${yields.food}</b><br><br>\` +
                \`<b>生産内訳:</b><br>\` +
                getResourceBreakdownList('food');
  }
  else if (key === 'materials') {
    title = "🧱 資材 (Materials)";
    desc = "施設の建設や社会制度のアンロック、土地の結合（レベルアップ）などに消費される重要な建築資源です。";
    
    const yields = state.calculateTotalProduction();
    breakdown = \`現在の備蓄量: <b>🧱 \${state.materials}</b><br>\` +
                \`現在の毎ターン総生産量: <b>🧱 +\${yields.materials}</b><br><br>\` +
                \`<b>生産内訳:</b><br>\` +
                getResourceBreakdownList('materials');
  }
  else if (key === 'defense') {
    title = "🛡️ 防衛力 (Defense)";
    desc = "試練（襲来する脅威）から集落を守るための戦闘力。<b>防衛力は蓄積されず、毎ターン開始時に 0 にリセットされます。</b><br><br>" +
           "毎ターン終了時に土地や施設から生産される防衛力と、そのターン中に使用した軍事カードの効果の合計値が、そのターンの「総防衛力」となり、試練襲来時の防御判定に使用されます。";
    
    const yields = state.calculateTotalProduction();
    breakdown = \`現在の当ターン防衛力: <b>🛡️ \${state.defense}</b><br>\` +
                \`毎ターン自動で得られる生産量: <b>🛡️ +\${yields.defense}</b><br><br>\` +
                \`<b>生産内訳:</b><br>\` +
                getResourceBreakdownList('defense');
  }
  else if (key === 'mystic') {
    title = "✨ 神秘 (Mystic)";
    desc = "精霊との交信や奇跡の発動に必要な信仰力。一定値まで貯めることで、いつでも「神秘の奇跡」ボタンから強力なグローバル奇跡（予知、豊穣、神罰など）を発動できます。";
    
    const yields = state.calculateTotalProduction();
    breakdown = \`現在の備蓄量: <b>✨ \${state.mystic}</b><br>\` +
                \`現在の毎ターン総生産量: <b>✨ +\${yields.mystic}</b><br><br>\` +
                \`<b>生産内訳:</b><br>\` +
                getResourceBreakdownList('mystic');
  }

  titleEl.innerHTML = title;
  descEl.innerHTML = desc;
  breakdownEl.innerHTML = breakdown;
}`);

// B. getResourceBreakdownList
replaceFunction('function getResourceBreakdownList(resourceKey) {', `function getResourceBreakdownList(resourceKey) {
  let listHtml = "";
  state.board.forEach((slot, index) => {
    if (!slot || !slot.terrain) return;
    const landYield = state.calculateLandYield(slot);
    const val = landYield[resourceKey];
    if (val > 0) {
      const terrainName = index === 0 ? state.getPalaceName() : getTerrainDisplayName(slot.terrain, slot.attribute);
      listHtml += \`・スロット \${index} (\${terrainName}): +\${val}<br>\`;
    }
  });

  if (resourceKey === 'defense') {
    if (state.legacies.hardship_experience) {
      listHtml += \`・レガシー「不屈の精神」: +50<br>\`;
    }
    if (state.legacies.general_triumph) {
      listHtml += \`・レガシー「将軍の凱旋」: +30<br>\`;
    }
  }

  return listHtml || "・生産源なし (毎ターンの生産はありません)<br>";
}`);

// C. showTrialApproachingModal
replaceFunction('function showTrialApproachingModal() {', `function showTrialApproachingModal() {
  const modal = el.modalGenericEvent;
  modal.style.display = 'flex';

  const imgEl = document.getElementById('generic-event-image');
  if (imgEl) {
    imgEl.style.backgroundImage = "url('images/crisis.png')";
  }

  document.getElementById('generic-event-icon').style.display = 'none';

  const title = \`⚠️ 警告：第 \${state.upcomingTrial.index} の試練襲来！\`;
  const text = \`
    <div style="text-align: center; color: #f87171; font-weight: 800; font-size: 1.1rem; margin-bottom: 12px; animation: pulse 1s infinite;">
      🚨 亜人軍勢の襲来が検知されました 🚨
    </div>
    今ターン終了時、集落の防衛能力を問う「試練」が発生します！準備を怠れば、領土の崩壊を招きます。<br><br>
    <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.3); font-size: 0.8rem; line-height: 1.6;">
      <b>⚔️ 襲来情報:</b><br>
      ・予測敵勢力: <span style="color: #ef4444; font-weight: bold;">\${state.upcomingTrial.power}</span><br>
      ・敵戦術 (Tactic): <span style="color: #fca5a5; font-weight: bold;">\${state.upcomingTrial.tactic.name}</span><br>
      <span style="font-size: 0.72rem; color: #d1d5db;">効果: \${state.upcomingTrial.tactic.desc}</span>
    </div>
    <br>
    ※ドローカードから軍事防御カードをプレイするか、残り火を消費して施設建設や政体の変更を行い、防衛力を極限まで高めてください！
  \`;

  document.getElementById('generic-event-title').innerText = title;
  document.getElementById('generic-event-text').innerHTML = text;

  const optionsDiv = document.getElementById('generic-event-options');
  optionsDiv.innerHTML = \`
    <button class="event-option-btn" id="btn-close-generic-event" style="background: linear-gradient(135deg, #ef4444 0%, #991b1b 100%); border-color: #f87171; box-shadow: 0 0 15px rgba(239, 68, 68, 0.4);">
      防衛体制を整える
    </button>
  \`;

  document.getElementById('btn-close-generic-event').onclick = () => {
    modal.style.display = 'none';
  };
}`);

// D. checkPolityUnlocks
replaceFunction('function checkPolityUnlocks(policyId) {', `function checkPolityUnlocks(policyId) {
  if (policyId === 'tactics') {
    state.polities.autocracy = true;
    state.addLog('新たな政体「専制君主制」が選択可能になりました！', 'system');
  } else if (policyId === 'mysticism') {
    state.polities.theocracy = true;
    state.addLog('新たな政体「神聖君主制」が選択可能になりました！', 'system');
  } else if (policyId === 'agriculture') {
    state.polities.pioneer_democracy = true;
    state.addLog('新たな政体「開拓民主制」が選択可能になりました！', 'system');
  }
}`);

// Write to final game/src/main.js
const targetFilePath = path.join(__dirname, 'game', 'src', 'main.js');
fs.writeFileSync(targetFilePath, code, 'utf8');
console.log('Successfully wrote the final clean main.js!');
