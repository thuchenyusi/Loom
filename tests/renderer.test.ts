import { beforeEach, describe, expect, it, vi } from 'vitest';
import example from '../examples/decision.json';
import { parseDecisionDSL } from '../src/core/parser';
import { G6Renderer } from '../src/renderers/g6/renderer';
import { renderDiagram } from '../src/browser/render';

const mock = vi.hoisted(() => ({
  render: vi.fn(), destroy: vi.fn(), setElementState: vi.fn(), setSize: vi.fn(), fitView: vi.fn(), options: {} as Record<string, unknown>,
}));
vi.mock('@antv/g6', () => ({ Graph: class {
  constructor(options: Record<string, unknown>) { mock.options = options; }
  render = mock.render;
  destroy = mock.destroy;
  setElementState = mock.setElementState;
  setSize = mock.setSize;
  fitView = mock.fitView;
} }));

beforeEach(() => {
  vi.clearAllMocks();
  mock.render.mockResolvedValue(undefined);
  mock.setElementState.mockResolvedValue(undefined);
  mock.fitView.mockResolvedValue(undefined);
  document.body.innerHTML = '<div id="graph"><p>Existing content</p></div>';
});
const container = () => document.querySelector<HTMLElement>('#graph')!;

describe('G6 adapter lifecycle and sample paths', () => {
  it('mounts IR, highlights only connected edges, switches samples and restores all states', async () => {
    const ir = parseDecisionDSL(example);
    const instance = await new G6Renderer().mount(container(), ir);
    expect(mock.render).toHaveBeenCalledOnce();
    const select = container().querySelector('select')!;
    expect(select.options).toHaveLength(4);
    await instance.highlightPath(example.samples.alice.path);
    const states = mock.setElementState.mock.calls.at(-1)![0];
    expect(states.network).toEqual(['highlight']);
    expect(states.vpn).toEqual(['dim']);
    expect(states[ir.edges.find(edge => edge.source === 'network' && edge.branch === 'yes')!.id]).toEqual(['highlight']);
    expect(states[ir.edges.find(edge => edge.source === 'network' && edge.branch === 'no')!.id]).toEqual(['dim']);
    await instance.highlightPath(example.samples.bob.path);
    expect(mock.setElementState.mock.calls.at(-1)![0].vpn).toEqual(['highlight']);
    expect(select.value).toBe('1');
    await instance.clearHighlight();
    expect(Object.values(mock.setElementState.mock.calls.at(-1)![0]).every(value => Array.isArray(value) && value.length === 0)).toBe(true);
    expect(select.value).toBe('');
    await instance.resize();
    expect(mock.setSize).toHaveBeenCalledWith(800, 560);
    instance.destroy(); instance.destroy();
    expect(mock.destroy).toHaveBeenCalledOnce();
    expect(container().textContent).toBe('Existing content');
    await expect(instance.clearHighlight()).rejects.toThrow('destroyed');
  });
  it('rejects an invalid path before changing any state', async () => {
    const instance = await renderDiagram(container(), example);
    await expect(instance.highlightPath(['network', 'allow-admin'])).rejects.toThrow('INVALID_SAMPLE_PATH');
    expect(mock.setElementState).not.toHaveBeenCalled();
    instance.destroy();
  });
  it('serializes rapid updates and copies the input path', async () => {
    const instance = await renderDiagram(container(), example);
    const path = [...example.samples.alice.path];
    const first = instance.highlightPath(path);
    path.splice(0);
    const second = instance.highlightPath(example.samples.guest.path);
    await Promise.all([first, second]);
    expect(mock.setElementState.mock.calls[0][0]['allow-admin']).toEqual(['highlight']);
    expect(mock.setElementState.mock.calls[1][0]['deny-network']).toEqual(['highlight']);
    instance.destroy();
  });
  it('does not show a selector when disabled', async () => {
    const instance = await renderDiagram(container(), example, { showSampleSelector: false });
    expect(container().querySelector('select')).toBeNull();
    instance.destroy();
  });
  it('cleans up after render failure', async () => {
    mock.render.mockRejectedValueOnce(new Error('Canvas unavailable'));
    await expect(renderDiagram(container(), example)).rejects.toThrow('Canvas unavailable');
    expect(mock.destroy).toHaveBeenCalledOnce();
    expect(container().querySelector('.loom-diagram')).toBeNull();
  });
  it('loads URL specifications and reports HTTP failures before mounting', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => example }).mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' });
    vi.stubGlobal('fetch', fetch);
    try {
      const instance = await renderDiagram(container(), '/decision.json');
      expect(fetch).toHaveBeenCalledWith('/decision.json');
      instance.destroy();
      await expect(renderDiagram(container(), '/missing.json')).rejects.toThrow('404');
    } finally { vi.unstubAllGlobals(); }
  });
  it('rejects invalid container, DSL and height without leaving UI', async () => {
    await expect(renderDiagram(null as unknown as HTMLElement, example)).rejects.toThrow('container');
    await expect(renderDiagram(container(), {})).rejects.toThrow('SCHEMA_VALIDATION_ERROR');
    await expect(renderDiagram(container(), example, { height: -1 })).rejects.toThrow('height');
    expect(container().querySelector('.loom-diagram')).toBeNull();
  });
});
