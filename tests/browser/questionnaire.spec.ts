import { test, expect } from '@playwright/test';
import type { QuestionnaireDiagramInstance } from '../../src/core/types';

declare global {
  interface Window {
    questionnaire: QuestionnaireDiagramInstance;
    questionnairePaint: Record<string, {x:number;y:number}>;
  }
}

for (const format of ['esm','iife']) {
  test(format + ' answers, revisits history and jumps through real flowchart nodes', async ({ page }) => {
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(() => {
      window.questionnairePaint={};
      const original=CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText=function(text,x,y,maxWidth){
        const id=text.startsWith('想读赛博朋克')?'cyberpunk':text.startsWith('更喜欢哪种风格')?'style':text.startsWith('想读与外星文明')?'space':undefined;
        if(id){const p=this.getTransform().transformPoint({x,y});window.questionnairePaint[id]={x:p.x/devicePixelRatio,y:p.y/devicePixelRatio};}
        if(maxWidth===undefined)original.call(this,text,x,y);else original.call(this,text,x,y,maxWidth);
      };
    });
    await page.goto('/examples/07-questionnaire.html?format='+format);
    await expect(page.locator('[data-diagram]')).toHaveAttribute('data-diagram-state','ready');
    await expect(page.locator('.loom-questionnaire-heading')).toHaveText('想读赛博朋克吗？');
    await expect(page.getByRole('button',{name:'上一题'})).toBeDisabled();
    await page.screenshot({path:'test-results/questionnaire-'+format+'-start.png'});
    await page.locator('[data-branch=yes]').click();
    await expect(page.locator('.loom-questionnaire-heading')).toHaveText('更喜欢哪种风格？');
    await page.locator('[data-branch=noir]').click();
    await expect(page.locator('.loom-questionnaire-result')).toContainText('Neuromancer');
    await page.getByRole('button',{name:'上一题'}).click();
    await expect(page.locator('[data-branch=noir]')).toHaveAttribute('aria-pressed','true');
    await page.getByRole('button',{name:'流程图',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'作答流程图'});
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('canvas').first()).toBeVisible();
    await expect(dialog.locator('.loom-questionnaire-flow-step')).toHaveCount(3);
    await expect(dialog.locator('[aria-current=step]')).toContainText('更喜欢哪种风格');
    await dialog.screenshot({path:'test-results/questionnaire-'+format+'-flow.png'});
    const canvas=dialog.locator('.loom-canvas');
    const bounds=(await canvas.boundingBox())!;
    const points=await page.evaluate(()=>window.questionnairePaint);
    expect(points.cyberpunk).toBeDefined();expect(points.space).toBeDefined();
    await page.mouse.click(bounds.x+points.space.x,bounds.y+points.space.y);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('status').first()).toContainText('尚未访问');
    expect(await page.evaluate(()=>window.questionnaire.getState().position)).toBe(1);
    await page.mouse.click(bounds.x+points.cyberpunk.x,bounds.y+points.cyberpunk.y);
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('.loom-questionnaire-heading')).toHaveText('想读赛博朋克吗？');
    await expect(page.locator('[data-branch=yes]')).toHaveAttribute('aria-pressed','true');
    await page.getByRole('button',{name:'流程图',exact:true}).click();
    await dialog.locator('[data-position="2"]').click();
    await expect(page.locator('.loom-questionnaire-result')).toContainText('Neuromancer');
    await page.getByRole('button',{name:'流程图',exact:true}).click();
    await dialog.locator('[data-position="0"]').click();
    await page.locator('[data-branch=maybe]').click();
    await expect(page.locator('.loom-questionnaire-result')).toContainText('Cryptonomicon');
    expect(await page.evaluate(()=>window.questionnaire.getState().path)).toEqual(['cyberpunk','cryptonomicon']);
    await page.screenshot({path:'test-results/questionnaire-'+format+'-result.png'});
    await page.getByRole('button',{name:'流程图',exact:true}).click();
    await expect(dialog.locator('.loom-questionnaire-flow-step')).toHaveCount(2);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button',{name:'流程图',exact:true})).toBeFocused();
    await page.getByRole('button',{name:'重新开始'}).click();
    await expect(page.locator('.loom-questionnaire-heading')).toHaveText('想读赛博朋克吗？');
    await page.evaluate(()=>window.questionnaire.destroy());
    await expect(page.locator('.loom-questionnaire')).toHaveCount(0);
    await expect(page.locator('[data-diagram]')).not.toHaveAttribute('data-diagram-state','ready');
    expect(errors).toEqual([]);
  });
}

test('questionnaire works on a phone with keyboard choices and a responsive flowchart dialog', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/examples/07-questionnaire.html');
  const choice=page.locator('[data-branch=no]');await choice.focus();await choice.press('Enter');
  await expect(page.locator('.loom-questionnaire-heading')).toHaveText('想读与外星文明接触的故事？');
  await page.locator('[data-branch=yes]').focus();await page.locator('[data-branch=yes]').press('Enter');
  await expect(page.locator('.loom-questionnaire-result')).toContainText('Contact');
  await page.screenshot({path:'test-results/questionnaire-mobile-result.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button',{name:'流程图',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  await expect(dialog.locator('canvas').first()).toBeVisible();
  const box=(await dialog.boundingBox())!;expect(box.width).toBeLessThanOrEqual(390);expect(box.height).toBeLessThanOrEqual(844);
  await dialog.screenshot({path:'test-results/questionnaire-mobile-flow.png'});
  await dialog.locator('[data-position="0"]').click();
  await expect(page.locator('.loom-questionnaire-heading')).toHaveText('想读赛博朋克吗？');
});

test('loop visits and nested collapsed groups remain navigable', async ({ page }) => {
  await page.route('**/multi-branch.json',route=>route.fulfill({json:{type:'decision',start:'q',groups:{outer:{label:'Outer',collapsed:true},inner:{label:'Inner',parent:'outer',collapsed:true}},nodes:{q:{type:'decision',label:'再看一个选项？',yes:'q',no:'done',group:'inner'},done:{type:'result',label:'完成',group:'inner'}}}}));
  await page.goto('/examples/07-questionnaire.html');
  await page.locator('[data-branch=yes]').click();await page.locator('[data-branch=yes]').click();await page.locator('[data-branch=no]').click();
  await expect(page.locator('.loom-questionnaire-result')).toContainText('完成');
  await page.getByRole('button',{name:'流程图',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog.locator('canvas').first()).toBeVisible();
  await expect(dialog.locator('[data-group=outer]')).toHaveAttribute('aria-expanded','true');
  await expect(dialog.locator('[data-group=inner]')).toHaveAttribute('aria-expanded','true');
  await expect(dialog.locator('.loom-questionnaire-flow-step')).toHaveCount(4);
  await dialog.locator('[data-position="1"]').click();
  expect(await page.evaluate(()=>window.questionnaire.getState().position)).toBe(1);
  await page.locator('[data-branch=no]').click();
  expect(await page.evaluate(()=>window.questionnaire.getState().path)).toEqual(['q','q','done']);
});
