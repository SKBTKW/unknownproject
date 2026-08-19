const fs = require('fs');
const iconv = require('iconv-lite');

const code = fs.readFileSync('game/src/main.js', 'utf8');
const decoded = iconv.encode(code, 'shift-jis').toString('utf8');

const lines = decoded.split('\n');
let count = 0;
lines.forEach((line, idx) => {
  if (line.includes('\uFFFD') || (line.includes('?') && /[\u3040-\u30ff\u4e00-\u9fff]/.test(line))) {
    console.log(`Line ${idx+1}: ${line.trim()}`);
    count++;
  }
});
console.log(`Total corrupted lines in decoded string: ${count}`);
