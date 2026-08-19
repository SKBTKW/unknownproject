const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

const filePath = path.join(__dirname, 'game', 'src', 'main.js');
let code = fs.readFileSync(filePath, 'utf8');

try {
  // Convert the string to Shift-JIS bytes
  const sjisBuf = iconv.encode(code, 'shift-jis');

  // Decode those bytes as UTF-8
  const restored = sjisBuf.toString('utf8');

  console.log('Restored Japanese preview:');
  console.log(restored.split('\n').slice(240, 255).join('\n'));
} catch (e) {
  console.error(e);
}
