const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function run() {
  const logPath = 'C:\\Users\\mam07\\.gemini\\antigravity\\brain\\45b557a8-3b14-4211-a20d-41770b2d0000\\.system_generated\\logs\\transcript_full.jsonl';
  
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let viewCount = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    const step = JSON.parse(line);
    
    if (step.type === 'VIEW_FILE' && step.status === 'DONE') {
      const content = step.content;
      if (content.includes('game/src/main.js')) {
        const linesMatch = content.match(/Showing lines (\d+) to (\d+)/);
        if (linesMatch) {
          console.log(`Step ${step.step_index}: viewed lines ${linesMatch[1]} to ${linesMatch[2]}`);
          viewCount++;
        }
      }
    }
  }
  console.log(`Total view_file calls for main.js: ${viewCount}`);
}

run().catch(err => console.error(err));
