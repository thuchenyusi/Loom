import { test, expect } from '@playwright/test';

for (const [name, url] of [['ESM', '/examples/01-basic-decision.html'], ['IIFE', '/examples/02-sample-highlight.html']] as const) {
  test(`${name} artifact renders on a static page and supports lifecycle`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await expect(page.locator('canvas').first()).toBeVisible();
    await expect(page.locator('.loom-status')).toContainText('完整决策图');
    await expect(page.locator('#error')).toBeEmpty();
    await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { demo?: unknown }).demo))).toBe(true);
    expect(await page.locator('canvas').evaluateAll(canvases => {
      let visible = 0;
      for (const element of canvases) {
        const canvas = element as HTMLCanvasElement;
        const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) visible++;
      }
      return visible;
    })).toBeGreaterThan(1000);
    const initial = await page.locator('.loom-canvas').screenshot();
    await page.screenshot({ path: `test-results/${name}-full.png` });
    if (name === 'IIFE') {
      const selector = page.getByRole('combobox');
      await selector.selectOption({ label: 'Alice · 内部管理员' });
      await expect(page.locator('.loom-status')).toContainText('允许：管理员访问');
      const alice = await page.locator('.loom-canvas').screenshot();
      await page.screenshot({ path: 'test-results/IIFE-alice.png' });
      expect(alice.equals(initial)).toBe(false);
      await selector.selectOption({ label: 'Bob · VPN 成员' });
      await expect(page.locator('.loom-status')).toContainText('允许：成员访问');
      const bob = await page.locator('.loom-canvas').screenshot();
      await page.screenshot({ path: 'test-results/IIFE-bob.png' });
      expect(bob.equals(alice)).toBe(false);
      await selector.selectOption('');
      await expect(page.locator('.loom-status')).toContainText('完整决策图');
      await page.screenshot({ path: 'test-results/IIFE-cleared.png' });
      expect((await page.locator('.loom-canvas').screenshot()).equals(initial)).toBe(true);
    }
    const canvas = page.locator('.loom-canvas');
    const box = (await canvas.boundingBox())!;
    const beforePan = await canvas.screenshot();
    await page.mouse.move(box.x + 30, box.y + 30);
    await page.mouse.down();
    // G6 starts dragging only after its 100 ms gesture threshold.
    await page.waitForTimeout(120);
    await page.mouse.move(box.x + 90, box.y + 60, { steps: 6 });
    await page.mouse.up();
    await page.screenshot({ path: `test-results/${name}-panned.png` });
    await expect.poll(async () => (await canvas.screenshot()).equals(beforePan)).toBe(false);
    const panned = await canvas.screenshot();
    await page.mouse.wheel(0, -180);
    await expect.poll(async () => (await canvas.screenshot()).equals(panned)).toBe(false);
    await page.evaluate(async () => {
      const instance = (window as unknown as { demo: { resize(): Promise<void>; destroy(): void } }).demo;
      await instance.resize();
      instance.destroy(); instance.destroy();
    });
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
