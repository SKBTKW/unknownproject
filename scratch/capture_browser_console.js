<<<<<<< HEAD
const { chromium } = require('playwright');
const path = require('path');

(async () => {
    try {
        const browser = await chromium.launch();
        const page = await browser.newPage();

        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', err => console.error('PAGE ERROR:', err.stack));

        const htmlPath = 'file:///' + path.resolve('./game/index_v2.html').replace(/\\/g, '/');
        await page.goto(htmlPath);
        await page.waitForTimeout(2000);

        await browser.close();
    } catch(e) {
        console.error("Test Error:", e);
=======
import puppeteer from 'puppeteer';

(async () => {
    try {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        
        const errors = [];
        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
        page.on('pageerror', err => {
            console.error('PAGE ERROR:', err.toString());
            errors.push(err.toString());
        });

        await page.goto('http://localhost:8000/game/', { waitUntil: 'networkidle0' });
        await new Promise(r => setTimeout(r, 1000));
        
        const boardCells = await page.$$eval('.cell', cells => cells.length);
        console.log('Placed Cells on Board:', boardCells);
        
        const offeringCards = await page.$$eval('.card-item-modern', cards => cards.length);
        console.log('Offering Cards count:', offeringCards);

        await page.screenshot({ path: 'scratch/actual_rendered_page.png' });
        console.log('Screenshot saved to scratch/actual_rendered_page.png');
        
        await browser.close();
        if (errors.length > 0) process.exit(1);
    } catch (e) {
        console.error('Test execution error:', e);
        process.exit(1);
>>>>>>> dd8b7ce (chore: track tools and config in scratch)
    }
})();
