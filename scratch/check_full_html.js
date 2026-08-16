const fs = require('fs');

const html = fs.readFileSync('./game/index_v2.html', 'utf-8');
const i18nCode = fs.readFileSync('./game/src/i18n.js', 'utf-8');
const dataCode = fs.readFileSync('./game/src/data/land_cards.js', 'utf-8');
const mainCode = fs.readFileSync('./game/src/v2_unity_ready_main.js', 'utf-8');

// DOM モック
global.exports = undefined;
global.window = global;
global.document = {
    addEventListener: () => {},
    getElementById: (id) => {
        return {
            style: {},
            classList: { add: () => {}, remove: () => {} },
            appendChild: () => {},
            innerHTML: "",
            innerText: ""
        };
    },
    querySelectorAll: () => [],
    createElement: () => ({
        style: {},
        classList: { add: () => {}, remove: () => {} },
        appendChild: () => {},
        addEventListener: () => {}
    })
};

try {
    eval(i18nCode);
    eval(dataCode);
    eval(mainCode);
    console.log("All scripts evaluated successfully!");
    
    // HTML 内のインラインスクリプトをシミュレート
    const state = new GameState();
    const engine = new GameEngine(state);
    engine.initGame();
    console.log("Engine initGame() executed successfully!");
    console.log("Hand offering length:", state.handOffering.length);

} catch(e) {
    console.error("FULL EVAL ERROR:", e.stack);
}
