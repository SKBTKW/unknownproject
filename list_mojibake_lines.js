const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'game', 'src', 'main.js');
const code = fs.readFileSync(filePath, 'utf8');

const lines = code.split('\n');
let count = 0;
lines.forEach((line, idx) => {
  // Match any non-ASCII characters that are typical of mojibake
  // (e.g. 縺, 隴, 繧, 繝, 隰, 驛, 霑, 貅, 驕, 驕)
  if (/[縺隴繧繝隰驛霑貅驕闖髫ｻ縲]/.test(line)) {
    console.log(`Line ${idx+1}: ${line.trim()}`);
    count++;
  }
});
console.log(`Total mojibake lines: ${count}`);
