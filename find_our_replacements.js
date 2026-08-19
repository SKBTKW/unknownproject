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

  const edits = [];
  for await (const line of rl) {
    if (!line.trim()) continue;
    const step = JSON.parse(line);
    
    if (step.step_index >= 4600 && step.type === 'PLANNER_RESPONSE') {
      const toolCalls = step.tool_calls;
      if (toolCalls) {
        toolCalls.forEach(tc => {
          if ((tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content') && tc.args.TargetFile.includes('main.js')) {
            edits.push({
              step: step.step_index,
              name: tc.name,
              args: tc.args
            });
          }
        });
      }
    }
  }
  
  fs.writeFileSync('our_edits.json', JSON.stringify(edits, null, 2), 'utf8');
  console.log(`Saved ${edits.length} edits to our_edits.json`);
}

run().catch(err => console.error(err));
