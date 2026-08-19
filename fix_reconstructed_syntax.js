const fs = require('fs');
const vm = require('vm');

let code = fs.readFileSync('game/src/main_reconstructed.js', 'utf8');
const lines = code.split('\n');

// Let's print the block to see what it is
console.log('Original block around line 270:');
console.log(lines.slice(260, 280).join('\n'));

// Let's fix the startTurn function block around lines 260-280
// In startTurn, it should be:
/*
  // 6. Check if a trial is scheduled for the END of this turn!
  if (!raidTriggered && state.currentTurn === state.upcomingTrial.turn) {
    showTrialApproachingModal();
  }

  updateUI();
}
*/
// Let's replace the lines 267 to 279 with the correct startTurn ending
lines.splice(266, 13, 
`  if (!raidTriggered && state.currentTurn === state.upcomingTrial.turn) {
    showTrialApproachingModal();
  }

  updateUI();
}`
);

const newCode = lines.join('\n');
fs.writeFileSync('game/src/main_reconstructed_fixed.js', newCode, 'utf8');

// Parse test
let testCode = newCode;
testCode = testCode.replace(/import\s+[\s\S]*?from\s+['"].*?['"];/g, (match) => {
  return '/* ' + match.replace(/\*\//g, '* /') + ' */';
});
testCode = testCode.replace(/\bexport\s+/g, '');

try {
  new vm.Script(testCode, { filename: 'main_reconstructed_fixed.js' });
  console.log('Parsed successfully after fix!');
} catch (err) {
  console.error('Error line:', err.stack);
}
