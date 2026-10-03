export interface DiagramIR { id?: string; kind: 'graph' | 'function' }
export interface GraphNodeIR { id: string; kind: 'decision' | 'result'; label: string; group?: string; metadata?: Record<string, unknown> }
export interface GraphEdgeIR { id: string; source: string; target: string; branch: 'yes' | 'no'; label: string }
export interface GraphSampleIR { id: string; label: string; path: string[] }
export interface GraphGroupIR { id: string; label: string; collapsed: boolean; parent?: string }
export interface GraphIR extends DiagramIR {
  kind: 'graph';
  start: string;
  nodes: GraphNodeIR[];
  edges: GraphEdgeIR[];
  groups: GraphGroupIR[];
  samples: GraphSampleIR[];
}
export interface Coordinates { x: number; y: number }
export interface FunctionIR extends DiagramIR {
  kind: 'function';
  expression: string;
  domain: { x: [number, number]; y: [number, number] };
  pointX: number;
  showCoordinate: boolean;
  evaluate(x: number): number;
}
export interface ValidationIssue { code: string; message: string; path?: string }
export type ValidationResult = { valid: true; errors: [] } | { valid: false; errors: ValidationIssue[] };
export interface RenderOptions {
  /** Canvas height in CSS pixels. Default: 560. */
  height?: number;
  /** Abort fetching/mounting or destroy the rendered instance. */
  signal?: AbortSignal;
  /** Show sample selector when samples are present. Default: true. */
  showSampleSelector?: boolean;
}
export interface DiagramEvents {
  change: { kind: 'function'; value: Coordinates } | { kind: 'graph'; value: { path: string[] | null } };
  nodeclick: { nodeId: string };
}
export interface DiagramInstance {
  readonly kind: 'graph' | 'function';
  destroy(): void;
  resize(): Promise<void>;
  /** Returns an unsubscribe function. */
  on<K extends keyof DiagramEvents>(event: K, listener: (event: DiagramEvents[K]) => void): () => void;
}
export interface GraphDiagramInstance extends DiagramInstance {
  readonly kind: 'graph';
  /** A nonempty, connected path; partial paths are allowed. */
  highlightPath(path: readonly string[]): Promise<void>;
  clearHighlight(): Promise<void>;
  collapse(groupId: string): Promise<void>;
  expand(groupId: string): Promise<void>;
  focus(nodeId: string): Promise<void>;
}
export interface FunctionDiagramInstance extends DiagramInstance {
  readonly kind: 'function';
  getValue(): Coordinates;
}
export type RenderedDiagramInstance = GraphDiagramInstance | FunctionDiagramInstance;
export interface DiagramRenderer<T extends DiagramIR, I extends DiagramInstance = DiagramInstance> {
  mount(container: HTMLElement, diagram: T, options?: RenderOptions): Promise<I>;
}
