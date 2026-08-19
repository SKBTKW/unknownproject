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

  const reconstructedLines = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    const step = JSON.parse(line);
    
    if (step.step_index < 4600 && step.type === 'VIEW_FILE' && step.status === 'DONE') {
      const content = step.content;
      const contentLines = content.split('\n');
      const filePathLine = contentLines.find(l => l.startsWith('File Path:'));
      
      if (filePathLine && filePathLine.includes('game/src/main.js')) {
        console.log(`Step ${step.step_index}: Reconstructing main.js lines`);
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

  console.log(`Reconstructed ${reconstructedLines.length} lines.`);
  
  // Save to clean_main.js
  const fileContent = reconstructedLines.slice(1).join('\n');
  fs.writeFileSync('game/src/clean_main.js', fileContent, 'utf8');
  console.log('Saved to game/src/clean_main.js');
}

run().catch(err => console.error(err));
