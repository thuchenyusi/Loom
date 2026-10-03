import { test, expect } from '@playwright/test';
import type { GraphDiagramInstance, FunctionDiagramInstance, InitDiagramResult } from '../../src/index';

declare global {
  interface Window {
    demo: GraphDiagramInstance | FunctionDiagramInstance;
    Diagram: typeof import('../../src/index');
    initResults: InitDiagramResult[];
    lastChange: { value: { x: number; y: number } };
  }
}

test('nested combos collapse, restore, focus and preserve sample paths', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/examples/03-collapsible-groups.html');
  const auth = page.locator('button[data-group="authentication"]');
  const verify = page.locator('button[data-group="verification"]');
  await expect(auth).toHaveAttribute('aria-expanded', 'true');
  await expect(verify).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(() => page.evaluate(() => Boolean(window.demo))).toBe(true);
  await page.screenshot({ path: 'test-results/combo-initial.png' });
  const initial = await page.locator('.loom-canvas').screenshot();
  await auth.click();
  await expect(auth).toHaveAttribute('aria-expanded', 'false');
  await page.screenshot({ path: 'test-results/combo-collapsed.png' });
  expect((await page.locator('.loom-canvas').screenshot()).equals(initial)).toBe(false);
  await page.getByRole('combobox').selectOption('0');
  await expect(page.locator('.loom-status')).toContainText('允许访问');
  await page.screenshot({ path: 'test-results/combo-highlight.png' });
  // Changing a hidden child's flag must survive parent expansion.
  await verify.click();
  await expect(verify).toHaveAttribute('aria-expanded', 'true');
  await auth.click();
  await expect(auth).toHaveAttribute('aria-expanded', 'true');
  await page.screenshot({ path: 'test-results/combo-expanded.png' });
  await page.evaluate(async () => {
    const graph = window.demo as GraphDiagramInstance;
    await graph.collapse('authentication');
    await graph.focus('mfa');
    await graph.clearHighlight();
  });
  await expect(auth).toHaveAttribute('aria-expanded', 'true');
  await expect(verify).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#error')).toBeEmpty();
  expect(errors).toEqual([]);
});

test('function glider reports mathematical coordinates and change events after dragging', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/examples/04-interactive-function.html');
  const point = page.getByRole('slider', { name: 'Point P' });
  await expect(point).toBeVisible();
  await expect(page.locator('.loom-coordinate')).toContainText('P(2.000, 0.400)');
  const position = (await point.boundingBox())!;
  await page.mouse.move(position.x + position.width / 2, position.y + position.height / 2);
  await page.mouse.down();
  await page.mouse.move(position.x + 150, position.y - 30, { steps: 15 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.lastChange?.value.x)).not.toBe(2);
  const value = await page.evaluate(() => (window.demo as FunctionDiagramInstance).getValue());
  expect(value.x).toBeGreaterThan(-5);
  expect(value.x).toBeLessThanOrEqual(5);
  expect(value.y).toBeCloseTo(value.x * value.x / 10, 6);
  await point.focus();
  await point.press('ArrowLeft');
  const keyboardValue = await page.evaluate(() => (window.demo as FunctionDiagramInstance).getValue());
  expect(keyboardValue.x).toBeLessThan(value.x);
  await page.screenshot({ path: 'test-results/function-dragged.png' });
  await page.evaluate(async () => { await window.demo.resize(); window.demo.destroy(); });
  await expect(page.locator('.loom-function')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('auto init isolates errors, reuses instances, resizes and supports clean reinitialization', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/invalid.json', route => route.fulfill({ json: { type: 'decision', start: 'missing', nodes: { end: { type: 'result', label: 'Done' } } } }));
  await page.goto('/tests/browser/auto-init.html');
  await expect(page.locator('[data-diagram-state="ready"]')).toHaveCount(2);
  await expect(page.locator('[data-diagram-state="error"]')).toHaveCount(2);
  await expect(page.locator('#invalid')).toContainText('START_NODE_NOT_FOUND');
  await expect(page.locator('#missing')).toContainText('404');
  expect(await page.evaluate(async () => {
    const again = await window.Diagram.init();
    return again.every((result, index) => result.instance === window.initResults[index].instance);
  })).toBe(true);
  await expect(page.locator('.loom-diagram')).toHaveCount(2);
  await page.setViewportSize({ width: 800, height: 960 });
  await expect.poll(() => page.locator('#graph canvas').first().evaluate(canvas => (canvas as HTMLCanvasElement).width)).toBeLessThan(800);
  await page.evaluate(() => window.Diagram.destroyDiagrams());
  await expect(page.locator('.loom-diagram')).toHaveCount(0);
  await expect(page.locator('.loom-error')).toHaveCount(0);
  await page.evaluate(() => window.Diagram.init());
  await expect(page.locator('[data-diagram-state="ready"]')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('Jekyll Markdown includes produce an interactive static page under a baseurl', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/jekyll/');
  await expect(page.getByRole('heading', { name: 'Loom · Jekyll 用户手册' })).toBeVisible();
  await expect(page.locator('[data-diagram-state="ready"]')).toHaveCount(2);
  await expect(page.locator('[data-src="/jekyll/assets/diagrams/combo.json"]')).toBeVisible();
  await page.getByRole('combobox').selectOption('0');
  await expect(page.locator('.loom-status')).toContainText('允许访问');
  await expect(page.locator('.loom-coordinate')).toContainText('P(2.000, 0.400)');
  await page.screenshot({ path: 'test-results/jekyll.png', fullPage: true });
  expect(errors).toEqual([]);
});
