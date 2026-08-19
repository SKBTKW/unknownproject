const fs = require('fs');

const code = fs.readFileSync('game/src/main.js', 'utf8');
const lines = code.split('\n');

let braceCount = 0;
let inString = false;
let stringChar = null;
let inComment = false;

lines.forEach((line, index) => {
  let lineBraceCountStart = braceCount;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (inComment) {
      continue; // only single-line comments in line-by-line processing here
    }
    
    if (line.slice(i, i+2) === '//') {
      break;
    }
    
    if (inString) {
      if (char === '\\') {
        i++;
      } else if (char === stringChar) {
        inString = false;
      }
      continue;
    }
    
    if (char === "'" || char === '"' || char === '`') {
      inString = true;
      stringChar = char;
      continue;
    }
    
    if (char === '{') braceCount++;
    else if (char === '}') braceCount--;
  }
  
  if (line.match(/^\s*function\s+\w+\(/) || line.match(/^\s*const\s+\w+\s*=\s*\(/)) {
    console.log(`Line ${index + 1}: ${line.trim()} (Brace level at start of line: ${lineBraceCountStart}, end of line: ${braceCount})`);
  }
});
console.log(`Final brace count: ${braceCount}`);
