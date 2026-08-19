const fs = require('fs');
const path = require('path');
const vm = require('vm');

const srcDir = path.join(__dirname, 'game', 'src');
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.js'));

let allOk = true;

files.forEach(f => {
  const filePath = path.join(srcDir, f);
  let code = fs.readFileSync(filePath, 'utf8');
  
  // Strip ES6 imports and exports for simple VM check
  code = code.replace(/import\s+[\s\S]*?from\s+['"].*?['"];/g, (match) => {
    return '/* ' + match.replace(/\*\//g, '* /') + ' */';
  });
  code = code.replace(/\bexport\s+/g, '');
  
  try {
    new vm.Script(code, { filename: f });
    console.log(`PASS: ${f} parsed successfully!`);
  } catch (err) {
    console.error(`FAIL: ${f} failed to parse:`);
    console.error(err.stack);
    allOk = false;
  }
});

if (allOk) {
  console.log('ALL JS FILES PARSED SUCCESSFULLY!');
} else {
  process.exit(1);
}
