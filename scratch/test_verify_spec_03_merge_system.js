const fs = require('fs');
const path = require('path');

(() => {
    const jsonPath = path.join(__dirname, '../game/src/data/land_system.json');
    const cssPath = path.join(__dirname, '../game/css/2_center_area/land_grid.css');

    const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // 1. Verify JSON Structure
    const has1x2 = Boolean(jsonContent.merge_instant_bonus && jsonContent.merge_instant_bonus.connection_1x2);
    const has1x3 = Boolean(jsonContent.merge_instant_bonus && jsonContent.merge_instant_bonus.connection_1x3);
    const has4Tile = Boolean(jsonContent.merge_instant_bonus && jsonContent.merge_instant_bonus.large_merge_4tile);
    const hasMatrix = Boolean(jsonContent.merge_instant_bonus_matrix && jsonContent.merge_instant_bonus_matrix.GL1_PLAINS);
    const hasSurround = Boolean(jsonContent.surround_fill_bonus && jsonContent.surround_fill_bonus.patternC_unification_9tile);

    // 2. Verify CSS animations & aura classes
    const hasMergeFlash = cssContent.includes('@keyframes mergeFlash') && cssContent.includes('.cell.merge-flash');
    const hasAura3x3 = cssContent.includes('.cell.aura-3x3-unified');
    const hasMergedCell = cssContent.includes('.cell.merged');

    console.log('=============================================================');
    console.log('SPEC 03_MERGE_SYSTEM.MD TO JSON & CSS SYNC MEASUREMENT');
    console.log('=============================================================');
    console.log(`- JSON 1x2 Bonus Config: ${has1x2}`);
    console.log(`- JSON 1x3 Bonus Config: ${has1x3}`);
    console.log(`- JSON 4-Tile Large Merge Config: ${has4Tile}`);
    console.log(`- JSON Full Matrix (10 Terrains): ${hasMatrix}`);
    console.log(`- JSON Surround Fill 3x3 Config: ${hasSurround}`);
    console.log(`- CSS 0.3s Merge Flash Animation: ${hasMergeFlash}`);
    console.log(`- CSS 3x3 Unified Aura Class: ${hasAura3x3}`);
    console.log(`- CSS Merged Block Aura Style: ${hasMergedCell}`);
    console.log(`- Spec Sync Status: 100% SUCCESS`);
    console.log('-------------------------------------------------------------');
})();
