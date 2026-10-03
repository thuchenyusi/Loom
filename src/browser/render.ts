import type { DecisionDSL } from '../dsl/decision';
import type { FunctionDSL } from '../dsl/function';
import { parseDecisionDSL } from '../core/parser';
import { parseFunctionDSL } from '../core/function';
import type { FunctionDiagramInstance, GraphDiagramInstance, RenderedDiagramInstance, RenderOptions } from '../core/types';
import { G6Renderer } from '../renderers/g6/renderer';
import { JSXGraphRenderer } from '../renderers/jsxgraph/renderer';

export function renderDiagram(container: HTMLElement, spec: DecisionDSL, options?: RenderOptions): Promise<GraphDiagramInstance>;
export function renderDiagram(container: HTMLElement, spec: FunctionDSL, options?: RenderOptions): Promise<FunctionDiagramInstance>;
export function renderDiagram(container: HTMLElement, spec: unknown, options?: RenderOptions): Promise<RenderedDiagramInstance>;
/** Render a decision/function specification, or fetch it from a JSON URL. */
export async function renderDiagram(container: HTMLElement, spec: unknown, options: RenderOptions = {}): Promise<RenderedDiagramInstance> {
  if (!container || container.nodeType !== 1 || typeof container.append !== 'function') throw new TypeError('renderDiagram requires an HTML container element');
  options.signal?.throwIfAborted();
  let input = spec;
  if (typeof spec === 'string') {
    const response = await (options.signal ? fetch(spec, { signal: options.signal }) : fetch(spec));
    if (!response.ok) throw new Error(`Failed to load diagram: ${response.status} ${response.statusText}`);
    input = await response.json();
  }
  options.signal?.throwIfAborted();
  const instance = input && typeof input === 'object' && 'type' in input && input.type === 'function'
    ? await new JSXGraphRenderer().mount(container, parseFunctionDSL(input), options)
    : await new G6Renderer().mount(container, parseDecisionDSL(input), options);
  if (options.signal?.aborted) { instance.destroy(); options.signal.throwIfAborted(); }
  let destroyed = false;
  let frame: number | undefined;
  const onResize = () => {
    if (destroyed || frame !== undefined) return;
    frame = window.requestAnimationFrame(() => {
      frame = undefined;
      if (!destroyed) void instance.resize().catch(error => {
        if (!destroyed) container.dispatchEvent(new CustomEvent('diagram:error', { detail: error }));
      });
    });
  };
  const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(onResize);
  observer?.observe(container);
  window.addEventListener('resize', onResize);
  const originalDestroy = instance.destroy.bind(instance);
  instance.destroy = () => {
    if (destroyed) return;
    destroyed = true;
    observer?.disconnect();
    window.removeEventListener('resize', onResize);
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    options.signal?.removeEventListener('abort', onAbort);
    originalDestroy();
  };
  const onAbort = () => instance.destroy();
  options.signal?.addEventListener('abort', onAbort, { once: true });
  return instance;
}
