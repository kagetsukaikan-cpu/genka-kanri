import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(15000);

await page.goto('http://localhost:3000');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: 'screenshots/dashboard.png', fullPage: true });

await page.goto('http://localhost:3000/ingredients');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: 'screenshots/ingredients.png', fullPage: true });

await page.goto('http://localhost:3000/menus');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: 'screenshots/menus.png', fullPage: true });

await page.goto('http://localhost:3000/suppliers');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: 'screenshots/suppliers.png', fullPage: true });

await page.goto('http://localhost:3000/purchases');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: 'screenshots/purchases.png', fullPage: true });

await browser.close();
console.log('Done!');
