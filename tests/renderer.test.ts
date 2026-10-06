import { beforeEach, describe, expect, it, vi } from 'vitest';
import example from '../examples/decision.json';
import combo from '../examples/combo.json';
import multiBranch from '../examples/multi-branch.json';
import { parseDecisionDSL } from '../src/core/parser';
import { G6Renderer } from '../src/renderers/g6/renderer';
import { renderDiagram } from '../src/browser/render';
import type { DecisionDSL } from '../src/dsl/decision';
const graphSpec = example as DecisionDSL;

const mock = vi.hoisted(() => ({
  getZoom: vi.fn(), zoomTo: vi.fn(), fitCenter: vi.fn(),
  collapseElement: vi.fn(), expandElement: vi.fn(), updateComboData: vi.fn(), focusElement: vi.fn(),
  render: vi.fn(), destroy: vi.fn(), setElementState: vi.fn(), setSize: vi.fn(), fitView: vi.fn(), options: {} as Record<string, unknown>,
}));
vi.mock('@antv/g6', () => ({ Graph: class {
  constructor(options: Record<string, unknown>) { mock.options = options; }
  on = vi.fn(); off = vi.fn();
  collapseElement = mock.collapseElement; expandElement = mock.expandElement; updateComboData = mock.updateComboData; focusElement = mock.focusElement;
  render = mock.render;
  destroy = mock.destroy;
  setElementState = mock.setElementState;
  setSize = mock.setSize;
  fitView = mock.fitView;
  getZoom = mock.getZoom; zoomTo = mock.zoomTo; fitCenter = mock.fitCenter;
} }));

beforeEach(() => {
  vi.clearAllMocks();
  mock.getZoom.mockReturnValue(1);
  mock.render.mockResolvedValue(undefined);
  mock.setElementState.mockResolvedValue(undefined);
  mock.fitView.mockResolvedValue(undefined);
  document.body.innerHTML = '<div id="graph"><p>Existing content</p></div>';
});
const container = () => document.querySelector<HTMLElement>('#graph')!;

describe('G6 adapter lifecycle and sample paths', () => {
  it('highlights selected branch identities and keeps the current marker through group changes', async () => {
    const spec = structuredClone(combo);
    const check = spec.nodes.entry;
    const multi = { ...spec, nodes: { ...spec.nodes, entry: { type:'decision', label:check.label, branches:{yes:{target:check.yes,label:'A'},maybe:{target:check.yes,label:'B'},no:{target:check.no,label:'C'}} } } };
    const ir = parseDecisionDSL(multi);
    const instance = await new G6Renderer().mount(container(), ir);
    const path = spec.samples.alice.path;
    const branches = path.slice(1).map((target,index) => ir.edges.find(edge=>edge.source===path[index] && edge.target===target)!.branch);
    branches[0] = 'maybe';
    await instance.highlightPath(path, {branches, currentNodeId:'mfa'});
    const states = mock.setElementState.mock.calls.at(-1)![0];
    expect(states[ir.edges.find(edge=>edge.source==='entry' && edge.branch==='maybe')!.id]).toEqual(['highlight']);
    expect(states[ir.edges.find(edge=>edge.source==='entry' && edge.branch==='yes')!.id]).toEqual(['dim']);
    expect(states.mfa).toEqual(['highlight','current']);
    await instance.collapse('authentication');
    expect(mock.setElementState.mock.calls.at(-1)![0].mfa).toEqual(['highlight','current']);
    const calls = mock.setElementState.mock.calls.length;
    await expect(instance.highlightPath(path,{branches:['missing']})).rejects.toThrow('INVALID_SAMPLE_PATH');
    await expect(instance.highlightPath(path,{currentNodeId:'missing'})).rejects.toThrow('INVALID_SAMPLE_PATH');
    expect(mock.setElementState).toHaveBeenCalledTimes(calls);
    await instance.clearHighlight();
    await instance.highlightPath(path);
    expect(mock.setElementState.mock.calls.at(-1)![0].mfa).toEqual(['highlight']);
    instance.destroy();
  });
  it('renders custom branch labels and highlights a third branch with shared targets', async () => {
    const spec = structuredClone(multiBranch);
    spec.nodes.cyberpunk.branches.yes.target = 'cryptonomicon';
    delete (spec.samples as Partial<typeof spec.samples>).noir;
    const ir = parseDecisionDSL(spec);
    const instance = await new G6Renderer().mount(container(), ir);
    const data = mock.options.data as { edges: {id:string;data:{label:string}}[] };
    const maybe = ir.edges.find(edge => edge.branch === 'maybe')!;
    expect(data.edges.find(edge => edge.id === maybe.id)?.data.label).toBe('Maybe · 技术多一点，压抑少一点');
    await instance.highlightPath(spec.samples.maybe.path);
    const states = mock.setElementState.mock.calls.at(-1)![0];
    for (const edge of ir.edges.filter(edge => edge.source === 'cyberpunk')) {
      expect(states[edge.id]).toEqual([edge.target === 'cryptonomicon' ? 'highlight' : 'dim']);
    }
    expect(container().querySelector('select')!.value).toBe('0');
    await instance.clearHighlight();
    expect(Object.values(mock.setElementState.mock.calls.at(-1)![0]).every(value => Array.isArray(value) && !value.length)).toBe(true);
    instance.destroy();
  });
  it('maps nested combos, collapses hidden children and expands ancestors on focus', async () => {
    const ir = parseDecisionDSL(combo);
    const instance = await new G6Renderer().mount(container(), ir);
    const data = mock.options.data as { nodes: {id:string;combo?:string}[]; combos: {id:string;combo?:string}[] };
    expect(data.nodes.find(node => node.id === 'mfa')?.combo).toBe('verification');
    expect(data.combos.find(group => group.id === 'verification')?.combo).toBe('authentication');
    expect(mock.collapseElement).toHaveBeenCalledWith('verification', false);
    await instance.collapse('authentication');
    await instance.expand('verification');
    expect(mock.updateComboData).toHaveBeenCalledWith([{ id: 'verification', style: expect.objectContaining({ collapsed: false, labelPlacement: 'top' }) }]);
    await instance.highlightPath(combo.samples.alice.path);
    expect(mock.setElementState.mock.calls.at(-1)![0].verification).toEqual(['highlight']);
    expect(mock.setElementState.mock.calls.at(-1)![0].authentication).toEqual(['highlight']);
    await instance.focus('mfa');
    expect(mock.expandElement).toHaveBeenCalledWith('authentication', false);
    expect(mock.focusElement).toHaveBeenCalledWith('mfa', false);
    await expect(instance.collapse('missing')).rejects.toThrow('Unknown group');
    await expect(instance.focus('missing')).rejects.toThrow('Unknown node');
    instance.destroy();
  });
  it('keeps the current zoom when folding and only shrinks to fit expanded content', async () => {
    const instance = await new G6Renderer().mount(container(), parseDecisionDSL(combo));
    mock.getZoom.mockReturnValueOnce(0.8).mockReturnValueOnce(1.1);
    await instance.collapse('authentication');
    expect(mock.zoomTo).toHaveBeenCalledWith(0.8, false);
    expect(mock.fitCenter).toHaveBeenCalledWith(false);
    mock.zoomTo.mockClear();
    mock.getZoom.mockReturnValueOnce(0.8).mockReturnValueOnce(0.7);
    await instance.expand('authentication');
    expect(mock.zoomTo).not.toHaveBeenCalled();
    instance.destroy();
  });
  it('emits path change events and supports unsubscribe', async () => {
    const instance = await new G6Renderer().mount(container(), parseDecisionDSL(example));
    const listener = vi.fn();
    const unsubscribe = instance.on('change', listener);
    await instance.highlightPath(example.samples.alice.path);
    expect(listener).toHaveBeenCalledWith({ kind:'graph', value:{path:example.samples.alice.path} });
    unsubscribe();
    await instance.clearHighlight();
    expect(listener).toHaveBeenCalledOnce();
    instance.destroy();
    expect(() => instance.on('change', listener)).toThrow('destroyed');
  });
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
    expect(mock.setSize).not.toHaveBeenCalled();
    Object.defineProperty(container(), 'clientWidth', { value: 900 });
    await instance.resize();
    expect(mock.setSize).toHaveBeenCalledWith(900, 560);
    instance.destroy(); instance.destroy();
    expect(mock.destroy).toHaveBeenCalledOnce();
    expect(container().textContent).toBe('Existing content');
    await expect(instance.clearHighlight()).rejects.toThrow('destroyed');
  });
  it('rejects an invalid path before changing any state', async () => {
    const instance = await renderDiagram(container(), graphSpec);
    await expect(instance.highlightPath(['network', 'allow-admin'])).rejects.toThrow('INVALID_SAMPLE_PATH');
    expect(mock.setElementState).not.toHaveBeenCalled();
    instance.destroy();
  });
  it('serializes rapid updates and copies the input path', async () => {
    const instance = await renderDiagram(container(), graphSpec);
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
    const instance = await renderDiagram(container(), graphSpec, { showSampleSelector: false });
    expect(container().querySelector('select')).toBeNull();
    instance.destroy();
  });
  it('cleans up after render failure', async () => {
    mock.render.mockRejectedValueOnce(new Error('Canvas unavailable'));
    await expect(renderDiagram(container(), graphSpec)).rejects.toThrow('Canvas unavailable');
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
    await expect(renderDiagram(container(), graphSpec, { height: -1 })).rejects.toThrow('height');
    expect(container().querySelector('.loom-diagram')).toBeNull();
  });
});
