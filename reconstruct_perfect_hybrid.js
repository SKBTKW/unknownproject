const fs = require('fs');
const readline = require('readline');
const path = require('path');
const iconv = require('iconv-lite');

async function run() {
  const logPath = 'C:\\Users\\mam07\\.gemini\\antigravity\\brain\\45b557a8-3b14-4211-a20d-41770b2d0000\\.system_generated\\logs\\transcript_full.jsonl';
  
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const cleanLines = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    const step = JSON.parse(line);
    
    if (step.type === 'VIEW_FILE' && step.status === 'DONE') {
      const content = step.content;
      if (content.includes('game/src/main.js')) {
        const isDirty = /[縺隴繧繝隰驛霑貅驕闖髫ｻ縲]/.test(content);
        if (!isDirty) {
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
                cleanLines[lineNum] = lineContent;
              }
            }
          });
        }
      }
    }
  }

  // Load current main.js on disk
  const diskPath = path.join(__dirname, 'game', 'src', 'main.js');
  const diskCode = fs.readFileSync(diskPath, 'utf8');
  const diskLines = diskCode.split('\n');

  const finalLines = [];
  let logCleanUsed = 0;
  let decodedUsed = 0;

  for (let i = 1; i <= diskLines.length; i++) {
    if (cleanLines[i] !== undefined) {
      finalLines.push(cleanLines[i]);
      logCleanUsed++;
    } else {
      // Decode from disk
      const lineOnDisk = diskLines[i - 1];
      const sjisBuf = iconv.encode(lineOnDisk, 'shift-jis');
      const decodedLine = sjisBuf.toString('utf8');
      finalLines.push(decodedLine);
      decodedUsed++;
    }
  }

  console.log(`Hybrid Reconstruction Stats:`);
  console.log(`- Clean lines from logs used: ${logCleanUsed}`);
  console.log(`- Decoded lines from disk used: ${decodedUsed}`);

  // Write to game/src/main_hybrid.js
  fs.writeFileSync('game/src/main_hybrid.js', finalLines.join('\n'), 'utf8');
  console.log('Saved to game/src/main_hybrid.js');
}

run().catch(err => console.error(err));
