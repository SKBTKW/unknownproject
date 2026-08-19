const fs = require('fs');
const vm = require('vm');

let code = fs.readFileSync('game/src/clean_main.js', 'utf8');

// 1. Fix line 150: insert function initGame() {
code = code.replace(
`// Drag and Drop state variables
  startTurn();
  initGlobalDragAndDropListeners();
}`,
`// Drag and Drop state variables
function initGame() {
  startTurn();
  initGlobalDragAndDropListeners();
}`
);

// 2. Fix dragstart listener around line 248: add the missing closing brackets
// Let's locate the exact text in clean_main.js
const dragstartTarget = 
`    cardEl.addEventListener('dragstart', (e) => {
      draggedCard = card;
      draggedSourceType = 'offering';
      draggedSourceIndex = index;
      cardEl.classList.add('dragging');
  checkRiverExpeditionEvents();`;

const dragstartReplacement = 
`    cardEl.addEventListener('dragstart', (e) => {
      draggedCard = card;
      draggedSourceType = 'offering';
      draggedSourceIndex = index;
      cardEl.classList.add('dragging');
    });
  checkRiverExpeditionEvents();`;

if (code.includes(dragstartTarget)) {
  code = code.split(dragstartTarget).join(dragstartReplacement);
  console.log('Fixed dragstart syntax!');
} else {
  console.log('Target dragstart not found exactly, let us inspect it.');
}

fs.writeFileSync('game/src/clean_main_fixed_test.js', code, 'utf8');

// Parse test
let testCode = code;
testCode = testCode.replace(/import\s+[\s\S]*?from\s+['"].*?['"];/g, (match) => {
  return '/* ' + match.replace(/\*\//g, '* /') + ' */';
});
testCode = testCode.replace(/\bexport\s+/g, '');

try {
  new vm.Script(testCode, { filename: 'clean_main_fixed_test.js' });
  console.log('Parsed clean_main_fixed_test.js successfully!');
} catch (err) {
  console.error('Error line:', err.stack);
}
