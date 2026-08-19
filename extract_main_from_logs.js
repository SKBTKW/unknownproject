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
    
    if (step.type === 'VIEW_FILE' && step.status === 'DONE') {
      const content = step.content;
      if (content.includes('game/src/main.js')) {
        const linesMatch = content.match(/Showing lines (\d+) to (\d+)/);
        if (linesMatch) {
          const startLine = parseInt(linesMatch[1]);
          const endLine = parseInt(linesMatch[2]);
          
          const contentLines = content.split('\n');
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
  }

  console.log(`Reconstructed ${reconstructedLines.length} lines.`);
  
  // We need to write the file, starting from line 1
  // (index 0 is empty, so we slice from 1)
  const fileContent = reconstructedLines.slice(1).join('\n');
  fs.writeFileSync('game/src/main_reconstructed.js', fileContent, 'utf8');
  console.log('Saved to game/src/main_reconstructed.js');
}

run().catch(err => console.error(err));
