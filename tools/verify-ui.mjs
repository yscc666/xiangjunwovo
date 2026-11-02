import { chromium } from 'playwright-core';

const B = 'http://127.0.0.1:8123/';
const OUT = 'C:\\Users\\ccai\\AppData\\Local\\Temp\\puffer-debug\\shots\\';
import { mkdirSync } from 'node:fs';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = [], bad = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
page.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });

const views = [
  ['home', '#home', 'home'],
  ['species', '#species', 'species'],
  ['detail', '#species/MOL-05', 'detail'],
  ['detail2', '#species/MOL-03', 'detail2'],
  ['sequence', '#sequence', 'sequence'],
  ['taxonomy', '#taxonomy', 'taxonomy'],
  ['about', '#about', 'about'],
];

for (const [name, hash, file] of views) {
  await page.goto(B + hash, { waitUntil: 'load' });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: OUT + file + '.png', fullPage: false });
  const info = await page.evaluate(() => ({
    visible: [...document.querySelectorAll('main > div')].filter(d => !d.hidden).map(d => d.id),
    dashes: [...document.querySelectorAll('body *')].filter(e => e.children.length === 0 && e.textContent.trim() === '—' ).length,
    canvases: document.querySelectorAll('canvas').length,
    cards: document.querySelectorAll('.card').length,
    rows: document.querySelectorAll('tbody tr').length,
  }));
  console.log(name.padEnd(9), JSON.stringify(info));
}

// 深色模式截一张
await page.goto(B + '#home', { waitUntil: 'load' });
await page.click('#themeBtn');
await page.waitForTimeout(1500);
await page.screenshot({ path: OUT + 'home-dark.png' });

console.log('BAD:', [...new Set(bad)].join(' | ') || '(none)');
console.log('ERRS:', [...new Set(errs)].slice(0, 6).join(' | ') || '(none)');
await browser.close();
