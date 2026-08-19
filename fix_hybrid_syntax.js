const fs = require('fs');
const vm = require('vm');

let code = fs.readFileSync('game/src/main_hybrid.js', 'utf8');
const lines = code.split('\n');

// Replace lines 266-285 with the correct end of startTurn
lines.splice(266, 15, 
`  if (!raidTriggered && state.currentTurn === state.upcomingTrial.turn) {
    showTrialApproachingModal();
  }

  updateUI();
}`
);

const newCode = lines.join('\n');
fs.writeFileSync('game/src/main_hybrid_fixed.js', newCode, 'utf8');

// Parse test
let testCode = newCode;
testCode = testCode.replace(/import\s+[\s\S]*?from\s+['"].*?['"];/g, (match) => {
  return '/* ' + match.replace(/\*\//g, '* /') + ' */';
});
testCode = testCode.replace(/\bexport\s+/g, '');

try {
  new vm.Script(testCode, { filename: 'main_hybrid_fixed.js' });
  console.log('Parsed successfully after line 270 fix!');
} catch (err) {
  console.error('Error line:', err.stack);
}
