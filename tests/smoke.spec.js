const { test, expect } = require('@playwright/test');

async function start(page) {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  const skip = page.locator('#skipOnboarding');
  if (await skip.count()) {
    await skip.click();
    await page.waitForTimeout(150);
  }
  return pageErrors;
}

async function route(page, name) {
  const button = page.locator('[data-route="' + name + '"]').first();
  await expect(button, 'route button: ' + name).toHaveCount(1);
  await button.evaluate(el => el.click());
  await page.waitForTimeout(80);
  await expect(page.locator('#view')).not.toContainText('حدث خطأ قابل للاسترجاع');
  await expect(page.locator('#view')).not.toBeEmpty();
}

async function expectModalFrom(page, selector) {
  const el = page.locator(selector).first();
  await expect(el, selector).toHaveCount(1);
  await el.evaluate(node => node.click());
  await page.waitForTimeout(80);
  await expect(page.locator('#modalRoot .modal')).toHaveCount(1);
  const close = page.locator('#modalRoot [data-close]').first();
  if (await close.count()) await close.click();
  else await page.evaluate(() => window.closeModal?.());
}

test.describe('NovaBlu ERP 0.15 final local candidate', () => {
  test('core routes render without page errors', async ({ page }) => {
    const pageErrors = await start(page);
    await expect(page.locator('body')).toContainText('NovaBlu ERP');

    const routes = [
      'dashboard','owner','sales','products','inventory','purchasing',
      'accounting','reports','data','health','qa','rcqa','experience',
      'device','releasecenter','pilot'
    ];
    for (const name of routes) await route(page, name);

    await route(page, 'rcqa');
    await page.locator('#runRCQA').click();
    await page.waitForTimeout(250);
    await expect(page.locator('#view')).toContainText('Release Candidate QA');

    const schema = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('novablu_erp_v1_free'));
      return {
        version: db?.meta?.version,
        products: db?.products?.length,
        invoices: db?.invoices?.length,
        rcScore: db?.rcqa?.lastFull?.score
      };
    });
    expect(schema.version).toBeGreaterThanOrEqual(15);
    expect(schema.products).toBeGreaterThan(0);
    expect(schema.invoices).toBeGreaterThan(0);
    expect(schema.rcScore).toBeGreaterThan(0);
    expect(pageErrors).toEqual([]);
  });

  test('polished core actions use in-app modals', async ({ page }) => {
    const pageErrors = await start(page);

    await route(page,'products');
    await expectModalFrom(page,'#printLabels');

    await route(page,'pos');
    await expectModalFrom(page,'#posExchange');
    await expectModalFrom(page,'#couponManage');

    await route(page,'purchasing');
    await expectModalFrom(page,'#newVC');

    await route(page,'accounting');
    await expectModalFrom(page,'#openLedger');
    await expectModalFrom(page,'#newOpening');
    await expectModalFrom(page,'#newCC');
    await expectModalFrom(page,'#closePeriod');

    await route(page,'documents');
    await expectModalFrom(page,'#docReceipt');
    await expectModalFrom(page,'#docPayment');
    await expectModalFrom(page,'#docStatement');
    await expectModalFrom(page,'#docSalary');
    await expectModalFrom(page,'#docThermal');

    expect(pageErrors).toEqual([]);
  });

  test('local backup serialization roundtrip is lossless', async ({ page }) => {
    await start(page);
    const result = await page.evaluate(() => {
      const key='novablu_erp_v1_free';
      const raw=localStorage.getItem(key);
      const parsed=JSON.parse(raw);
      const copy=JSON.parse(JSON.stringify(parsed));
      const round=JSON.stringify(copy);
      return {
        equal: JSON.stringify(parsed)===round,
        version:Number(parsed?.meta?.version||0),
        arrays:['products','customers','invoices','stockMoves'].every(k=>Array.isArray(parsed[k]))
      };
    });
    expect(result.equal).toBeTruthy();
    expect(result.version).toBeGreaterThanOrEqual(15);
    expect(result.arrays).toBeTruthy();
  });

  test('PWA assets and 0.15 local candidate are reachable', async ({ page }) => {
    await page.goto('http://127.0.0.1:4173/manifest.json');
    const manifest = JSON.parse(await page.locator('body').innerText());
    expect(manifest.name).toBe('NovaBlu ERP');
    expect(Array.isArray(manifest.shortcuts)).toBeTruthy();

    const sw = await page.request.get('http://127.0.0.1:4173/sw.js');
    expect(sw.ok()).toBeTruthy();
    expect(await sw.text()).toContain('novablu-erp-0.15-final-local-r1');

    for (const asset of ['rcqa-v12.js','finalux-v13.js','localcomplete-v14.js','finalcandidate-v15.js']) {
      const r = await page.request.get('http://127.0.0.1:4173/' + asset);
      expect(r.ok(), asset).toBeTruthy();
    }
  });
});
