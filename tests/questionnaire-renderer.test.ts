import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import example from '../examples/multi-branch.json';
import { renderDiagram } from '../src/browser/render';
import type { DecisionDSL } from '../src/dsl/decision';

const mock = vi.hoisted(() => ({
  mount: vi.fn(), highlightPath: vi.fn(), expand: vi.fn(), resize: vi.fn(), destroy: vi.fn(),
  listeners: new Map<string, (event: {nodeId:string}) => void>(), unsubscribe: vi.fn(),
}));
vi.mock('../src/renderers/g6/renderer', () => ({G6Renderer:class { mount = mock.mount; }}));
const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
const spec = example as DecisionDSL;
const container = () => document.querySelector<HTMLElement>('#questionnaire')!;
beforeEach(() => {
  vi.clearAllMocks(); mock.listeners.clear();
  mock.highlightPath.mockResolvedValue(undefined); mock.expand.mockResolvedValue(undefined); mock.resize.mockResolvedValue(undefined);
  mock.mount.mockImplementation(async () => ({kind:'graph',highlightPath:mock.highlightPath,expand:mock.expand,resize:mock.resize,destroy:mock.destroy,
    on:(event:string,listener:(event:{nodeId:string})=>void) => {mock.listeners.set(event,listener);return mock.unsubscribe;},
  }));
  Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}});
  Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.open=false;this.dispatchEvent(new Event('close'));}});
  document.body.innerHTML='<div id="questionnaire"><p>Existing content</p></div>';
});
afterEach(() => {
  if(originalShow) Object.defineProperty(HTMLDialogElement.prototype,'showModal',originalShow); else Reflect.deleteProperty(HTMLDialogElement.prototype,'showModal');
  if(originalClose) Object.defineProperty(HTMLDialogElement.prototype,'close',originalClose); else Reflect.deleteProperty(HTMLDialogElement.prototype,'close');
});

describe('Questionnaire rendering and lifecycle', () => {
  it('shows choices, results and reviewed selections, emits copied state and allows restart', async () => {
    const instance=await renderDiagram(container(),spec,{view:'questionnaire'});
    expect(instance.kind).toBe('questionnaire');
    expect(container().querySelector('h2')?.textContent).toBe('想读赛博朋克吗？');
    expect(container().querySelectorAll('.loom-questionnaire-choice')).toHaveLength(3);
    expect(container().querySelector<HTMLButtonElement>('.loom-questionnaire-back')!.disabled).toBe(true);
    const listener=vi.fn(); const off=instance.on('change',listener);
    await instance.choose('yes'); await instance.choose('noir');
    expect(container().querySelector('.loom-questionnaire-result')?.textContent).toContain('Neuromancer');
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({kind:'questionnaire',value:expect.objectContaining({completed:true})}));
    listener.mock.calls[1][0].value.path.push('fake');
    expect(instance.getState().path).not.toContain('fake');
    await instance.back();
    expect(container().querySelector('[data-branch=noir]')?.getAttribute('aria-pressed')).toBe('true');
    await instance.choose('samurai');
    expect(instance.getState().result?.id).toBe('snow-crash');
    off(); await instance.restart(); expect(listener).toHaveBeenCalledTimes(4);
    expect(instance.getState().path).toEqual(['cyberpunk']);
    instance.destroy(); instance.destroy();
    expect(container().textContent).toBe('Existing content');
    await expect(instance.back()).rejects.toThrow('destroyed');
    await expect(instance.showFlowchart()).rejects.toThrow('destroyed');
    expect(() => instance.getState()).toThrow('destroyed');
  });
  it('lazily opens one graph, highlights exact branches and jumps only to visited nodes', async () => {
    const instance=await renderDiagram(container(),spec,{view:'questionnaire'});
    expect(mock.mount).not.toHaveBeenCalled();
    await instance.choose('yes'); await instance.choose('noir');
    await Promise.all([instance.showFlowchart(),instance.showFlowchart()]);
    expect(mock.mount).toHaveBeenCalledOnce();
    expect(mock.highlightPath).toHaveBeenLastCalledWith(['cyberpunk','style','neuromancer'],{branches:['yes','noir'],currentNodeId:'neuromancer'});
    expect(container().querySelectorAll('.loom-questionnaire-flow-step')).toHaveLength(3);
    mock.listeners.get('nodeclick')!({nodeId:'space'});
    expect(container().querySelector('dialog')!.open).toBe(true);
    expect(instance.getState().position).toBe(2);
    expect(container().querySelector('.loom-questionnaire-flow .loom-questionnaire-feedback')?.textContent).toContain('尚未访问');
    mock.listeners.get('nodeclick')!({nodeId:'cyberpunk'});
    await vi.waitFor(() => expect(instance.getState().position).toBe(0));
    await vi.waitFor(() => expect(container().querySelector('dialog')!.open).toBe(false));
    expect(instance.getState().path).toHaveLength(3);
    await instance.showFlowchart();
    expect(mock.mount).toHaveBeenCalledOnce();
    instance.destroy();
    expect(mock.unsubscribe).toHaveBeenCalledOnce(); expect(mock.destroy).toHaveBeenCalledOnce();
  });
  it('cleans up a graph that finishes mounting after destruction and can retry a failed mount', async () => {
    const instance=await renderDiagram(container(),spec,{view:'questionnaire'});
    mock.mount.mockRejectedValueOnce(new Error('Canvas unavailable'));
    await expect(instance.showFlowchart()).rejects.toThrow('Canvas unavailable');
    let finish!: (graph:unknown)=>void;
    mock.mount.mockReturnValueOnce(new Promise(resolve=>{finish=resolve;}));
    const pending=instance.showFlowchart(); instance.destroy();
    finish({destroy:mock.destroy});
    await expect(pending).rejects.toThrow('destroyed');
    expect(mock.destroy).toHaveBeenCalledOnce();
    expect(container().querySelector('.loom-questionnaire')).toBeNull();
  });
  it('loads a URL and rejects unsupported views, function input and invalid heights without leaving UI', async () => {
    vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>example})));
    try {
      const instance=await renderDiagram(container(),'/books.json',{view:'questionnaire'});
      expect(instance.kind).toBe('questionnaire'); instance.destroy();
      await expect(renderDiagram(container(),{type:'function'},{view:'questionnaire'})).rejects.toThrow('decision diagram');
      await expect(renderDiagram(container(),spec,{view:'questionnaire',height:0})).rejects.toThrow('height');
      await expect(renderDiagram(container(),spec,{view:'unknown' as 'diagram'})).rejects.toThrow('Unknown diagram view');
      expect(container().querySelector('.loom-questionnaire')).toBeNull();
    } finally {vi.unstubAllGlobals();}
  });
  it('honors abort signals and keeps separate questionnaires independent', async () => {
    const controller=new AbortController();
    const first=await renderDiagram(container(),spec,{view:'questionnaire',signal:controller.signal});
    const other=document.createElement('div');document.body.append(other);
    const second=await renderDiagram(other,spec,{view:'questionnaire'});
    await first.choose('maybe');expect(second.getState().position).toBe(0);
    expect(container().querySelector('dialog h2')!.id).not.toBe(other.querySelector('dialog h2')!.id);
    controller.abort();expect(container().querySelector('.loom-questionnaire')).toBeNull();
    expect(() => first.getState()).toThrow('destroyed');
    second.destroy();
  });
});
