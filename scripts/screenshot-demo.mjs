// Runs the built app in demo mode at iPhone size, adds one sheet using a sample photo,
// and saves screenshots. Usage: node scripts/screenshot-demo.mjs <sample-image>
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';

const sample = process.argv[2];
const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
// PW_CHROMIUM lets the script use a pre-installed browser (e.g. /opt/pw-browsers/chromium).
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await browser.newPage({ ...devices['iPhone 13'] });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto('http://localhost:4173/');
  await page.getByText('Demo mode').waitFor();
  await page.screenshot({ path: 'docs/test-evidence/plan1-1-empty.png' });
  await page.getByRole('link', { name: 'Add', exact: true }).click();
  await page.getByLabel('Currency').selectOption('KRW');
  await page.getByLabel('Shipping / fees (KRW)').fill('3000');
  await page.getByLabel('Order total (KRW)').fill('15000');
  await page.getByLabel('SGD actually paid (from your bank / card)').fill('15.60');
  await page.getByText('📷 Add a sheet').click();
  await page.setInputFiles('input[type=file]', sample);
  await page.getByText('Drag across the sheet').waitFor();
  await page.getByLabel('Title').fill('계란이 좋아');
  await page.getByLabel('Artist').fill('JUIMJUIM');
  await page.getByLabel('Copies').fill('4');
  await page.getByLabel('Price each (KRW)').fill('3000');
  await page.screenshot({ path: 'docs/test-evidence/plan1-2-add.png', fullPage: true });
  await page.getByText('Add to list').click();
  await page.getByText('Rate from your payment').waitFor();
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByLabel('4 copies').waitFor();
  await page.screenshot({ path: 'docs/test-evidence/plan1-3-collection.png' });
  await page.getByRole('link', { name: 'Spending' }).click();
  await page.getByTestId('total').waitFor();
  const total = await page.getByTestId('total').textContent();
  await page.screenshot({ path: 'docs/test-evidence/plan1-4-spending.png', fullPage: true });
  console.log('Spending total shown:', total);
  console.log('Page errors:', errors.length ? errors : 'none');
} finally {
  await browser.close();
  server.kill();
}
