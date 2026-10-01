const { test, expect } = require('@playwright/test');

test.describe('NovaBlu ERP 0.14 local smoke', () => {
  test('core routes render without page errors', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });

    const skip = page.locator('#skipOnboarding');
    if (await skip.count()) {
      await skip.click();
      await page.waitForTimeout(150);
    }

    await expect(page.locator('body')).toContainText('NovaBlu ERP');

    const routes = [
      'dashboard','owner','sales','products','inventory','purchasing',
      'accounting','reports','data','health','qa','rcqa','experience',
      'device','releasecenter'
    ];

    for (const route of routes) {
      const button = page.locator('[data-route="' + route + '"]').first();
      await expect(button, 'route button: ' + route).toHaveCount(1);
      await button.evaluate(el => el.click());
      await page.waitForTimeout(80);
      await expect(page.locator('#view')).not.toContainText('حدث خطأ قابل للاسترجاع');
      await expect(page.locator('#view')).not.toBeEmpty();
    }

    await page.locator('[data-route="rcqa"]').first().evaluate(el => el.click());
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

    expect(schema.version).toBeGreaterThanOrEqual(14);
    expect(schema.products).toBeGreaterThan(0);
    expect(schema.invoices).toBeGreaterThan(0);
    expect(schema.rcScore).toBeGreaterThan(0);

    await page.locator('[data-route="sales"]').first().evaluate(el => el.click());
    const newInvoice = page.locator('[data-q="invoice"]').first();
    if (await newInvoice.count()) {
      await newInvoice.evaluate(el => el.click());
      await page.waitForTimeout(100);
      await expect(page.locator('#modalRoot .modal')).toHaveCount(1);
      await page.locator('#modalRoot [data-close]').first().click();
    }

    expect(pageErrors).toEqual([]);
  });

  test('PWA assets and local release center are reachable', async ({ page }) => {
    await page.goto('http://127.0.0.1:4173/manifest.json');
    const manifest = JSON.parse(await page.locator('body').innerText());
    expect(manifest.name).toBe('NovaBlu ERP');
    expect(Array.isArray(manifest.shortcuts)).toBeTruthy();

    const sw = await page.request.get('http://127.0.0.1:4173/sw.js');
    expect(sw.ok()).toBeTruthy();
    expect(await sw.text()).toContain('novablu-erp-0.14-local-complete-r2');

    for (const asset of ['rcqa-v12.js','finalux-v13.js','localcomplete-v14.js']) {
      const r = await page.request.get('http://127.0.0.1:4173/' + asset);
      expect(r.ok(), asset).toBeTruthy();
    }
  });
});
