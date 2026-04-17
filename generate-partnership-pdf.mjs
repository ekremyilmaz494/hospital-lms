import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import path from 'path';

const htmlPath = path.resolve('C:/Users/pc/Desktop/Yeni klasör/hospital-lms-partnership.html');
const pdfPath  = path.resolve('C:/Users/pc/Desktop/Yeni klasör/hospital-lms-partnership.pdf');

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
await page.evaluate(async () => { await document.fonts.ready; });
await page.waitForTimeout(500);

await page.pdf({
  path: pdfPath,
  format: 'A4',
  landscape: true,
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
});

await browser.close();
console.log('PDF yazıldı:', pdfPath);
