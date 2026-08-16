const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const html = fs.readFileSync('./game/index_v2.html', 'utf-8');
const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable" });

dom.window.addEventListener('load', () => {
    console.log("JSDOM Loaded!");
});

setTimeout(() => {
    try {
        const landCardsCode = fs.readFileSync('./game/src/data/land_cards.js', 'utf-8');
        const mainCode = fs.readFileSync('./game/src/v2_unity_ready_main.js', 'utf-8');
        dom.window.eval(landCardsCode);
        dom.window.eval(mainCode);
        console.log("Scripts loaded. Evaluating GameEngine initialization...");
        dom.window.eval("window.state = new GameState(); window.engine = new GameEngine(window.state); window.engine.initGame();");
        console.log("Hand offering length:", dom.window.state.handOffering.length);
        console.log("Grid HTML length:", dom.window.document.getElementById('gridArea').innerHTML.length);
    } catch(e) {
        console.error("DOM Execution Error:", e);
    }
}, 1000);
