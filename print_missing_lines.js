const fs = require('fs');
const readline = require('readline');

async function run() {
  const logPath = 'C:\\Users\\mam07\\.gemini\\antigravity\\brain\\45b557a8-3b14-4211-a20d-41770b2d0000\\.system_generated\\logs\\transcript_full.jsonl';
  
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const reconstructedLines = [];
  for await (const line of rl) {
    if (!line.trim()) continue;
    const step = JSON.parse(line);
    
    if (step.type === 'VIEW_FILE' && step.status === 'DONE') {
      const content = step.content;
      const contentLines = content.split('\n');
      const filePathLine = contentLines.find(l => l.startsWith('File Path:'));
      
      if (filePathLine && filePathLine.includes('game/src/main.js')) {
        let codeStarted = false;
        contentLines.forEach(cl => {
          if (cl.includes('The following code has been modified to include a line number before every line')) {
            codeStarted = true;
            return;
          }
          if (codeStarted) {
            const match = cl.match(/^(\d+):\s(.*)/);
            if (match) {
              const lineNum = parseInt(match[1]);
              const lineContent = match[2];
              reconstructedLines[lineNum] = lineContent;
            }
          }
        });
      }
    }
  }

  const missingRanges = [];
  let inRange = false;
  let start = null;
  
  // We know the max line is around 3313
  for (let i = 1; i <= 3313; i++) {
    if (reconstructedLines[i] === undefined) {
      if (!inRange) {
        inRange = true;
        start = i;
      }
    } else {
      if (inRange) {
        missingRanges.push([start, i - 1]);
        inRange = false;
      }
    }
  }
  if (inRange) {
    missingRanges.push([start, 3313]);
  }

  console.log(`Missing line ranges (total missing lines):`);
  console.log(missingRanges);
}

run().catch(err => console.error(err));
