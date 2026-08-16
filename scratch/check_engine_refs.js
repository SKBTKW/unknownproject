const fs = require('fs');

const mainCode = fs.readFileSync('./game/src/v2_unity_ready_main.js', 'utf-8');

// 簡易モック
global.window = global;
global.I18n = { t: (k) => k };

try {
    eval(mainCode);
    console.log("Evaluating GameState and GameEngine...");
    const state = new GameState();
    const engine = new GameEngine(state);
    
    console.log("Master cards count:", engine.getLandCardMaster().length);
    engine.generateOfferingCards();
    console.log("Hand offering count:", state.handOffering.length);
    console.log("First card in offering:", JSON.stringify(state.handOffering[0]));

} catch(e) {
    console.error("Execution Error trace:", e.stack);
}
