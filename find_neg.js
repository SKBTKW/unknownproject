const fs = require('fs');
const code = fs.readFileSync('game/src/main.js', 'utf8');
let bc = 0;
code.split('\n').forEach((line, idx) => {
  for(let i=0; i<line.length; i++) {
    if(line[i]==='{') bc++;
    else if (line[i]==='}') {
      bc--;
      if(bc < 0) {
        console.log("Negative brace count at line " + (idx+1) + ": " + line.trim());
        bc = 0;
      }
    }
  }
});
