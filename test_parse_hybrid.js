const fs = require('fs');
const vm = require('vm');
let code = fs.readFileSync('game/src/main_hybrid.js', 'utf8');

// Replace import statements with comments
code = code.replace(/import\s+[\s\S]*?from\s+['"].*?['"];/g, (match) => {
  return '/* ' + match.replace(/\*\//g, '* /') + ' */';
});

// Replace export keyword
code = code.replace(/\bexport\s+/g, '');

try {
  new vm.Script(code, { filename: 'main_hybrid.js' });
  console.log('Parsed main_hybrid.js successfully!');
} catch (err) {
  console.error('Error line:', err.stack);
}
