const fs = require('fs');
const readline = require('readline');

async function run() {
  const logPath = 'C:\\Users\\mam07\\.gemini\\antigravity\\brain\\45b557a8-3b14-4211-a20d-41770b2d0000\\.system_generated\\logs\\transcript_full.jsonl';
  
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    const step = JSON.parse(line);
    
    if (step.type === 'VIEW_FILE' && step.status === 'DONE') {
      const content = step.content;
      if (content.includes('function selectRole')) {
        console.log(`Step ${step.step_index}: found selectRole`);
        const contentLines = content.split('\n');
        const startIdx = contentLines.findIndex(l => l.includes('function selectRole'));
        console.log(contentLines.slice(startIdx, startIdx + 30).join('\n'));
        console.log('---');
      }
    }
  }
}

run().catch(err => console.error(err));
