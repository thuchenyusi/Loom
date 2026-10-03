import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initDiagrams, destroyDiagrams } from '../src/browser/auto-init';
import { renderDiagram } from '../src/browser/render';
import type { GraphDiagramInstance } from '../src/core/types';

vi.mock('../src/browser/render', () => ({ renderDiagram: vi.fn() }));
const render = vi.mocked(renderDiagram);
const makeInstance = (): GraphDiagramInstance => ({
  kind: 'graph', destroy: vi.fn(), resize: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(() => () => {}), highlightPath: vi.fn(), clearHighlight: vi.fn(), collapse: vi.fn(), expand: vi.fn(), focus: vi.fn(),
});
beforeEach(() => {
  render.mockReset();
  render.mockImplementation(async () => makeInstance());
  document.body.innerHTML = '<div data-diagram data-src="/graph.json"></div><div data-diagram data-src="/function.json"></div>';
});
afterEach(() => { destroyDiagrams(); document.body.innerHTML = ''; });
describe('Automatic initialization', () => {
  it('deduplicates concurrent calls and individual destruction allows remount', async () => {
    const [first, second] = await Promise.all([initDiagrams(), initDiagrams()]);
    expect(render).toHaveBeenCalledTimes(2);
    expect(first[0].instance).toBe(second[0].instance);
    first[0].instance!.destroy();
    const next = await initDiagrams();
    expect(render).toHaveBeenCalledTimes(3);
    expect(next[0].instance).not.toBe(first[0].instance);
    expect(next[1].instance).toBe(first[1].instance);
  });
  it('isolates loading/validation errors and cleans them before retry', async () => {
    render.mockRejectedValueOnce(new Error('Invalid DSL <script>'));
    const results = await initDiagrams();
    expect(results[0].error).toBeInstanceOf(Error);
    expect(results[1].instance).toBeDefined();
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('.loom-error')?.textContent).toContain('<script>');
    destroyDiagrams();
    expect(document.querySelector('.loom-error')).toBeNull();
    expect(document.querySelector('[data-diagram-state]')).toBeNull();
    await initDiagrams();
    expect(render).toHaveBeenCalledTimes(4);
  });
  it('includes a supplied root container and validates data-src / data-height', async () => {
    const root = document.querySelector<HTMLElement>('[data-diagram]')!;
    root.dataset.height = '360';
    await initDiagrams(root);
    expect(render).toHaveBeenCalledWith(root, '/graph.json', expect.objectContaining({ height: 360 }));
    destroyDiagrams(root);
    root.removeAttribute('data-src');
    expect((await initDiagrams(root))[0].error).toBeInstanceOf(Error);
  });
  it('cancels pending mounts and never leaves a late instance or error behind', async () => {
    let resolve!: (instance: GraphDiagramInstance) => void;
    render.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const root = document.querySelector<HTMLElement>('[data-diagram]')!;
    const pending = initDiagrams(root);
    const signal = render.mock.calls[0][2]!.signal!;
    destroyDiagrams(root);
    expect(signal.aborted).toBe(true);
    const late = makeInstance();
    resolve(late);
    expect((await pending)[0].error).toBeInstanceOf(DOMException);
    expect(late.destroy).toHaveBeenCalledOnce();
    expect(root.children).toHaveLength(0);
    expect(root.dataset.diagramState).toBeUndefined();
  });
});
