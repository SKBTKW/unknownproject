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

  const cleanLines = [];
  const dirtyLines = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    const step = JSON.parse(line);
    
    if (step.type === 'VIEW_FILE' && step.status === 'DONE') {
      const content = step.content;
      if (content.includes('game/src/main.js')) {
        const isDirty = /[縺隴繧繝隰驛霑貅驕闖髫ｻ縲]/.test(content);
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
              if (!isDirty) {
                cleanLines[lineNum] = lineContent;
              } else {
                dirtyLines[lineNum] = lineContent;
              }
            }
          }
        });
      }
    }
  }

  // Count how many lines have a clean version vs only a dirty version
  let cleanCount = 0;
  let onlyDirtyCount = 0;
  let missingCount = 0;
  const finalLines = [];

  const maxLines = Math.max(cleanLines.length, dirtyLines.length);
  for (let i = 1; i < maxLines; i++) {
    if (cleanLines[i] !== undefined) {
      finalLines[i] = cleanLines[i];
      cleanCount++;
    } else if (dirtyLines[i] !== undefined) {
      finalLines[i] = dirtyLines[i];
      onlyDirtyCount++;
    } else {
      missingCount++;
    }
  }

  console.log(`Smart Reconstruction Stats:`);
  console.log(`- Clean lines: ${cleanCount}`);
  console.log(`- Only dirty lines: ${onlyDirtyCount}`);
  console.log(`- Missing lines: ${missingCount}`);

  // Write to game/src/main_smart.js
  const fileContent = finalLines.slice(1).join('\n');
  fs.writeFileSync('game/src/main_smart.js', fileContent, 'utf8');
  console.log('Saved to game/src/main_smart.js');
}

run().catch(err => console.error(err));
