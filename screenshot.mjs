// Usage : node screenshot.mjs <url> [libellé] [largeur] [hauteur] [défilement%]
// Sans défilement% : capture pleine page. Avec : fait défiler à ce pourcentage
// et capture uniquement l'écran visible (indispensable pour les scènes fixes / canvas).
// Enregistre dans "temporary screenshots/screenshot-N[-libellé].png" (jamais écrasé)
import puppeteer from 'puppeteer-core';
import { mkdir, readdir } from 'node:fs/promises';

const [url = 'http://localhost:3000', label, w = '1440', h = '900', scroll] = process.argv.slice(2);
const DIR = 'temporary screenshots';
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

await mkdir(DIR, { recursive: true });
const n = (await readdir(DIR)).map(f => +(f.match(/^screenshot-(\d+)/)?.[1] ?? 0)).reduce((a, b) => Math.max(a, b), 0) + 1;
const out = `${DIR}/screenshot-${n}${label ? '-' + label : ''}.png`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', e => console.error('Erreur page :', e.message));
await page.setViewport({ width: +w, height: +h, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise(r => setTimeout(r, 1500));

if (scroll !== undefined) {
  const target = await page.evaluate(pct => {
    const max = document.documentElement.scrollHeight - innerHeight;
    return Math.round(max * pct / 100);
  }, +scroll);
  // Défilement progressif pour déclencher les animations comme un visiteur
  for (let i = 1; i <= 10; i++) {
    await page.evaluate(y => window.scrollTo(0, y), Math.round(target * i / 10));
    await new Promise(r => setTimeout(r, 120));
  }
  await new Promise(r => setTimeout(r, 2200));
}
await page.screenshot({ path: out, fullPage: scroll === undefined });
await browser.close();
console.log(out);
