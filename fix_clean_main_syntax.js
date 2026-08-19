const fs = require('fs');
const vm = require('vm');

let code = fs.readFileSync('game/src/clean_main.js', 'utf8');
const lines = code.split('\n');

// Print original around line 150
console.log('Original around line 150:');
console.log(lines.slice(144, 156).join('\n'));

// Insert function initGame() {
lines.splice(150, 0, 'function initGame() {');

const newCode = lines.join('\n');
fs.writeFileSync('game/src/clean_main_fixed.js', newCode, 'utf8');

// Parse test
let testCode = newCode;
testCode = testCode.replace(/import\s+[\s\S]*?from\s+['"].*?['"];/g, (match) => {
  return '/* ' + match.replace(/\*\//g, '* /') + ' */';
});
testCode = testCode.replace(/\bexport\s+/g, '');

try {
  new vm.Script(testCode, { filename: 'clean_main_fixed.js' });
  console.log('Parsed clean_main_fixed.js successfully!');
} catch (err) {
  console.error('Error line:', err.stack);
}
