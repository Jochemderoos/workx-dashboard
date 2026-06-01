const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--window-size=1400,1200']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1200 });
  await page.goto('https://workx-dashboard.vercel.app/login', { waitUntil: 'networkidle2', timeout: 20000 });

  // Find and fill the login form
  await page.waitForSelector('input', { timeout: 5000 });
  const inputs = await page.$$('input');
  if (inputs.length >= 2) {
    await inputs[0].type('jochem@workxadvocaten.nl');
    await inputs[1].type('Amsterdam2!');
  }

  // Click submit - don't wait for navigation, just wait for time
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.toLowerCase().includes('inlog')) {
      await btn.click();
      break;
    }
  }

  // Wait for redirect and dashboard to load
  await new Promise(r => setTimeout(r, 8000));

  // Scroll to show the widget
  await page.evaluate(() => window.scrollBy(0, 450));
  await new Promise(r => setTimeout(r, 1000));

  await page.screenshot({ path: 'C:/Users/quiri/dashboard-whatsnew.png' });
  console.log('Screenshot saved! URL:', page.url());
  await browser.close();
})().catch(e => console.error(e));
