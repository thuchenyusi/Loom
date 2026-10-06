import { test, expect } from '@playwright/test';

for (const format of ['esm', 'iife']) {
  test(format + ' renders labeled multi-branch choices and highlights each sample', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const labels: string[] = [];
      (window as unknown as { branchLabels: string[] }).branchLabels = labels;
      const original = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (...args: Parameters<typeof original>) {
        labels.push(args[0]);
        return original.apply(this, args);
      };
    });
    await page.goto('/examples/06-multi-branch.html?format=' + format);
    await expect(page.locator('canvas').first()).toBeVisible();
    await expect(page.locator('#error')).toBeEmpty();
    await expect.poll(() => page.evaluate(() => (window as unknown as { branchLabels: string[] }).branchLabels.join(' '))).toContain('Maybe');
    await expect.poll(() => page.evaluate(() => (window as unknown as { branchLabels: string[] }).branchLabels.join(' '))).toContain('Noir');
    const canvas = page.locator('.loom-canvas');
    const full = await canvas.screenshot();
    const selector = page.getByRole('combobox');
    await selector.selectOption({label:'Maybe · 技术与密码'});
    await expect(page.locator('.loom-status')).toContainText('Cryptonomicon');
    expect((await canvas.screenshot()).equals(full)).toBe(false);
    await selector.selectOption({label:'Yes · 黑色赛博朋克'});
    await expect(page.locator('.loom-status')).toContainText('Neuromancer');
    await selector.selectOption({label:'No · 外星文明'});
    await expect(page.locator('.loom-status')).toContainText('Contact');
    await selector.selectOption('');
    await expect(page.locator('.loom-status')).toContainText('完整决策图');
    expect((await canvas.screenshot()).equals(full)).toBe(true);
    await page.screenshot({path:'test-results/multi-branch-' + format + '.png'});
    expect(errors).toEqual([]);
  });
}
