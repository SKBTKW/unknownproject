const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

const filePath = path.join(__dirname, 'game', 'src', 'main.js');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Reverse the recent fixes to restore original corrupted character sequences
code = code.replace(/。`;/g, '。;');
code = code.replace(/谿ｵ髫`;/g, '谿ｵ髫;');

code = code.replace(/。`/g, '。Ａ');
code = code.replace(/！`/g, '！～');
code = code.replace(/た`/g, 'た兪');
code = code.replace(/階`/g, '階餐');
code = code.replace(/」`/g, '」宿');

try {
  const sjisBuf = iconv.encode(code, 'shift-jis');
  const restored = sjisBuf.toString('utf8');

  console.log('Restored Japanese preview:');
  console.log(restored.split('\n').slice(240, 255).join('\n'));
} catch (e) {
  console.error(e);
}
