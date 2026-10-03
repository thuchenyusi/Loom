export { renderDiagram } from './browser/render';
export { parseDecisionDSL } from './core/parser';
export { validateDecisionDSL, DiagramValidationError } from './core/validator';
export type { DecisionDSL, DecisionNodeDSL, ResultNodeDSL } from './dsl/decision';
export type { DiagramIR, GraphIR, GraphNodeIR, GraphEdgeIR, GraphSampleIR, DiagramInstance, GraphDiagramInstance, DiagramRenderer, RenderOptions, ValidationIssue, ValidationResult } from './core/types';
