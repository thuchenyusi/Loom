export interface DiagramIR { id?: string; kind: 'graph' | 'function' }
export interface GraphNodeIR {
  id: string;
  kind: 'decision' | 'result';
  label: string;
  metadata?: Record<string, unknown>;
}
export interface GraphEdgeIR { id: string; source: string; target: string; branch: 'yes' | 'no'; label: string }
export interface GraphSampleIR { id: string; label: string; path: string[] }
export interface GraphIR extends DiagramIR {
  kind: 'graph';
  start: string;
  nodes: GraphNodeIR[];
  edges: GraphEdgeIR[];
  samples: GraphSampleIR[];
}
export interface ValidationIssue { code: string; message: string; path?: string }
export type ValidationResult = { valid: true; errors: [] } | { valid: false; errors: ValidationIssue[] };
export interface RenderOptions {
  /** Canvas height in CSS pixels. Default: 560. */
  height?: number;
  /** Show sample selector when samples are present. Default: true. */
  showSampleSelector?: boolean;
}
export interface DiagramInstance { destroy(): void; resize(): Promise<void> }
export interface GraphDiagramInstance extends DiagramInstance {
  /** A nonempty, connected path; partial paths are allowed. */
  highlightPath(path: readonly string[]): Promise<void>;
  clearHighlight(): Promise<void>;
}
export interface DiagramRenderer<T extends DiagramIR> {
  mount(container: HTMLElement, diagram: T, options?: RenderOptions): Promise<GraphDiagramInstance>;
}
