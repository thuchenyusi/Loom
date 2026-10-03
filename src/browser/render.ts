import { parseDecisionDSL } from '../core/parser';
import type { GraphDiagramInstance, RenderOptions } from '../core/types';
import { G6Renderer } from '../renderers/g6/renderer';

/** Render a decision specification, or fetch it from a JSON URL. */
export async function renderDiagram(container: HTMLElement, spec: unknown, options?: RenderOptions): Promise<GraphDiagramInstance> {
  if (!container || container.nodeType !== 1 || typeof container.append !== 'function') throw new TypeError('renderDiagram requires an HTML container element');
  let input = spec;
  if (typeof spec === 'string') {
    const response = await fetch(spec);
    if (!response.ok) throw new Error(`Failed to load diagram: ${response.status} ${response.statusText}`);
    input = await response.json();
  }
  const diagram = parseDecisionDSL(input);
  return new G6Renderer().mount(container, diagram, options);
}
