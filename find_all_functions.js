const fs = require('fs');

const code = fs.readFileSync('game/src/main_hybrid.js', 'utf8');
const lines = code.split('\n');

lines.forEach((line, index) => {
  if (line.match(/^\s*function\s+\w+\(/) || line.match(/^\s*const\s+\w+\s*=\s*\(/) || line.match(/^\s*el\.\w+\.addEventListener/)) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
