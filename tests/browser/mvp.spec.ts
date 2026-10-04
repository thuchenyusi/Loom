import { test, expect } from '@playwright/test';
import type { GraphDiagramInstance, FunctionDiagramInstance, InitDiagramResult } from '../../src/index';

declare global {
  interface Window {
    demo: GraphDiagramInstance | FunctionDiagramInstance;
    Diagram: typeof import('../../src/index');
    initResults: InitDiagramResult[];
    lastChange: { value: { x: number; y: number } };
    groupPaint: Record<string, { x: number; y: number; size: number }>;
    groupActions: Record<string, { x: number; y: number; font: string }>;
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

test('collapsed groups keep node proportions, centered titles and stable label scale', async ({ page }) => {
  await page.addInitScript(() => {
    window.groupPaint = {};
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
      const key = text.startsWith('Authentication') ? 'auth'
        : text.startsWith('Verification') ? 'verify'
        : text.startsWith('访问受保护资源') ? 'entry' : undefined;
      if (key) {
        const transform = this.getTransform();
        const position = transform.transformPoint({ x, y });
        const font = Number(this.font.match(/([\d.]+)px/)?.[1]);
        window.groupPaint[key] = { x: position.x, y: position.y,
          size: font * Math.hypot(transform.a, transform.b) / devicePixelRatio };
      }
      if (maxWidth === undefined) original.call(this, text, x, y);
      else original.call(this, text, x, y, maxWidth);
    };
  });
  const collapsedBox = () => page.locator('.loom-canvas canvas:not([style*="pointer-events: none"])').evaluate(element => {
    const canvas = element as HTMLCanvasElement;
    const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
    const matchesFill = (x: number, y: number) => {
      const index = (y * canvas.width + x) * 4;
      return data[index] === 241 && data[index + 1] === 245 && data[index + 2] === 249 && data[index + 3] === 255;
    };
    // Ignore antialiased strokes that happen to share the collapsed fill color.
    for (let y = 2; y < canvas.height - 2; y++) for (let x = 2; x < canvas.width - 2; x++) {
      if (matchesFill(x, y) && matchesFill(x - 2, y) && matchesFill(x + 2, y)
        && matchesFill(x, y - 2) && matchesFill(x, y + 2)) {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
    // Add back the two-pixel sampling radius and one-pixel stroke on each side.
    return { minX, minY, maxX, maxY, ratio: maxX >= minX && maxY >= minY ? (maxX - minX + 7) / (maxY - minY + 7) : 0 };
  });
  for (const url of ['/examples/03-collapsible-groups.html', '/jekyll/']) {
    await page.goto(url);
    const auth = page.locator('button[data-group="authentication"]');
    await expect(auth).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(() => page.evaluate(() => Boolean(window.demo) || document.querySelectorAll('[data-diagram-state="ready"]').length === 2)).toBe(true);
    await page.locator('.loom-canvas').screenshot();
    let box = await collapsedBox();
    expect(box.ratio).toBeGreaterThan(3.1);
    expect(box.ratio).toBeLessThan(3.5);
    const initial = await page.evaluate(() => window.groupPaint);
    expect(initial.verify.y).toBeGreaterThan(box.minY);
    expect(initial.verify.y).toBeLessThan(box.maxY);
    await auth.click();
    await expect(auth).toHaveAttribute('aria-expanded', 'false');
    await page.locator('.loom-canvas').screenshot();
    box = await collapsedBox();
    expect(box.ratio).toBeGreaterThan(3.1);
    expect(box.ratio).toBeLessThan(3.5);
    const folded = await page.evaluate(() => window.groupPaint);
    expect(folded.auth.y).toBeGreaterThan(box.minY);
    expect(folded.auth.y).toBeLessThan(box.maxY);
    expect(folded.entry.size).toBeCloseTo(initial.entry.size, 2);
    await auth.click();
    await expect(auth).toHaveAttribute('aria-expanded', 'true');
    await page.locator('.loom-canvas').screenshot();
    expect(await page.evaluate(() => window.groupPaint.entry.size)).toBeCloseTo(initial.entry.size, 2);
  }
});

test('disclosure arrows and action labels work as canvas controls in HTML and Jekyll', async ({ page }) => {
  await page.addInitScript(() => {
    window.groupActions = {};
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
      const action = text.includes('▸ 展开') ? 'expand' : text.includes('▾ 收起') ? 'collapse' : undefined;
      if (action) {
        const point = this.getTransform().transformPoint({ x, y });
        window.groupActions[action] = { x: point.x / devicePixelRatio, y: point.y / devicePixelRatio, font: this.font };
      }
      if (maxWidth === undefined) original.call(this, text, x, y);
      else original.call(this, text, x, y, maxWidth);
    };
  });
  for (const url of ['/examples/03-collapsible-groups.html', '/jekyll/']) {
    await page.goto(url);
    await expect.poll(() => page.evaluate(() => Boolean(window.demo) || document.querySelectorAll('[data-diagram-state="ready"]').length === 2)).toBe(true);
    await page.locator('.loom-canvas').screenshot();
    const actions = await page.evaluate(() => window.groupActions);
    expect(actions.expand).toBeDefined();
    expect(actions.collapse).toBeDefined();
    expect(actions.expand.font).not.toMatch(/bold|[6-9]00/);
    const canvas = page.locator('.loom-canvas canvas:not([style*="pointer-events: none"])');
    const bounds = (await canvas.boundingBox())!;
    await page.mouse.move(bounds.x + actions.expand.x, bounds.y + actions.expand.y);
    await expect(canvas).toHaveCSS('cursor', 'pointer');
    await page.evaluate(() => { window.groupActions = {}; });
    await page.mouse.click(bounds.x + actions.expand.x, bounds.y + actions.expand.y);
    await expect(page.locator('button[data-group="verification"]')).toHaveAttribute('aria-expanded', 'true');
    await page.locator('.loom-canvas').screenshot();
    const opened = await page.evaluate(() => window.groupActions);
    expect(opened.expand).toBeUndefined();
    expect(opened.collapse).toBeDefined();
    // Both groups are now expanded; the nested title remains a direct collapse control.
    await page.mouse.click(bounds.x + opened.collapse.x, bounds.y + opened.collapse.y);
    await expect(page.locator('button[data-group="verification"]')).toHaveAttribute('aria-expanded', 'false');
  }
});
