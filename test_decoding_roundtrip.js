const iconv = require('iconv-lite');

const corrupted = '隴ｦ蜻奇ｼ'; // from disk/logs

// Try Roundtrip A: UTF-8 bytes -> Shift-JIS string
const bufA = Buffer.from(corrupted, 'utf8');
const restoredA = iconv.decode(bufA, 'shift-jis');
console.log('Restored A (UTF8 bytes -> ShiftJIS decode):', restoredA);

// Try Roundtrip B: Shift-JIS bytes -> UTF-8 string
const bufB = iconv.encode(corrupted, 'shift-jis');
const restoredB = bufB.toString('utf8');
console.log('Restored B (ShiftJIS bytes -> UTF8 decode):', restoredB);
