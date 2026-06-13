import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(15000);

await page.goto('http://localhost:3000');
await page.waitForLoadState('networkidle');
await page.fill('input[type=text]', 'kabuto');
await page.fill('input[type=password]', 'kabuto2024');
await page.click('button[type=submit]');
await page.waitForURL('http://localhost:3000/');

await page.goto('http://localhost:3000/purchases');
await page.waitForLoadState('networkidle');
await new Promise(r => setTimeout(r, 1500));
await page.screenshot({ path: 'screenshots/purchases_csv.png', fullPage: true });

await page.click('button:has-text("インフォマートCSV")');
await new Promise(r => setTimeout(r, 500));
await page.screenshot({ path: 'screenshots/csv_modal.png', fullPage: true });

await browser.close();
console.log('done');
