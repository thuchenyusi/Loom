import Ajv from 'ajv';
import schema from '../../schemas/decision.schema.json';
import type { DecisionDSL } from '../dsl/decision';
import type { GraphIR, ValidationIssue, ValidationResult } from './types';

const validateShape = new Ajv({ allErrors: true }).compile<DecisionDSL>(schema);
const pointer = (key: string) => key.replaceAll('~', '~0').replaceAll('/', '~1');

export class DiagramValidationError extends Error {
  readonly errors: ValidationIssue[];
  constructor(errors: ValidationIssue[]) {
    super(errors.map(error => `${error.code}: ${error.message} (${error.path ?? '/'})`).join('\n'));
    this.name = 'DiagramValidationError';
    this.errors = errors;
  }
}

export function validateDecisionDSL(input: unknown): ValidationResult {
  if (!validateShape(input)) {
    return { valid: false, errors: (validateShape.errors ?? []).map(error => ({
      code: 'SCHEMA_VALIDATION_ERROR', message: error.message ?? 'Invalid decision diagram', path: error.instancePath || '/',
    })) };
  }
  const errors: ValidationIssue[] = [];
  const exists = (id: string) => Object.hasOwn(input.nodes, id);
  const groups = input.groups ?? {};
  const groupExists = (id: string) => Object.hasOwn(groups, id);
  for (const [id, group] of Object.entries(groups)) {
    const path = `/groups/${pointer(id)}`;
    if (exists(id)) errors.push({ code: 'DUPLICATE_ELEMENT_ID', message: `Group "${id}" conflicts with a node ID`, path });
    if (group.parent && !groupExists(group.parent)) errors.push({ code: 'UNKNOWN_GROUP', message: `Unknown parent group "${group.parent}"`, path: `${path}/parent` });
    const visited = new Set<string>([id]);
    let parent = group.parent;
    while (parent && groupExists(parent)) {
      if (visited.has(parent)) { errors.push({ code: 'CYCLIC_GROUP', message: 'Group hierarchy must not contain a cycle', path: `${path}/parent` }); break; }
      visited.add(parent);
      parent = groups[parent].parent;
    }
  }
  if (!exists(input.start)) errors.push({ code: 'START_NODE_NOT_FOUND', message: `Start node "${input.start}" does not exist`, path: '/start' });
  for (const [id, node] of Object.entries(input.nodes)) {
    if (node.group && !groupExists(node.group)) errors.push({ code: 'UNKNOWN_GROUP', message: `Unknown group "${node.group}"`, path: `/nodes/${pointer(id)}/group` });
    if (node.type !== 'decision') continue;
    for (const branch of ['yes', 'no'] as const) {
      if (!exists(node[branch])) errors.push({ code: 'TARGET_NODE_NOT_FOUND', message: `Target "${node[branch]}" does not exist`, path: `/nodes/${pointer(id)}/${branch}` });
    }
  }
  for (const [id, sample] of Object.entries(input.samples ?? {})) {
    const path = `/samples/${pointer(id)}/path`;
    if (sample.path[0] !== input.start) errors.push({ code: 'INVALID_SAMPLE_PATH', message: 'Sample must begin at the start node', path });
    sample.path.forEach((nodeId, index) => {
      if (!exists(nodeId)) {
        errors.push({ code: 'INVALID_SAMPLE_PATH', message: `Sample node "${nodeId}" does not exist`, path: `${path}/${index}` });
      } else if (index > 0 && exists(sample.path[index - 1])) {
        const previous = input.nodes[sample.path[index - 1]];
        if (previous.type !== 'decision' || (previous.yes !== nodeId && previous.no !== nodeId)) {
          errors.push({ code: 'INVALID_SAMPLE_PATH', message: `No edge from "${sample.path[index - 1]}" to "${nodeId}"`, path: `${path}/${index}` });
        }
      }
    });
    const last = sample.path.at(-1)!;
    if (exists(last) && input.nodes[last].type !== 'result') errors.push({ code: 'INVALID_SAMPLE_PATH', message: 'Sample must end at a result node', path });
  }
  return errors.length ? { valid: false, errors } : { valid: true, errors: [] };
}

/** Shared by the adapter and selector. This checks connectivity without requiring a complete sample. */
export function validateGraphPath(diagram: GraphIR, path: readonly string[]): void {
  const nodes = new Set(diagram.nodes.map(node => node.id));
  const errors: ValidationIssue[] = [];
  if (path.length === 0) errors.push({ code: 'INVALID_SAMPLE_PATH', message: 'Path must contain at least one node', path: '/path' });
  path.forEach((id, index) => {
    if (!nodes.has(id)) errors.push({ code: 'INVALID_SAMPLE_PATH', message: `Unknown node "${id}"`, path: `/path/${index}` });
    if (index > 0 && !diagram.edges.some(edge => edge.source === path[index - 1] && edge.target === id)) {
      errors.push({ code: 'INVALID_SAMPLE_PATH', message: `No edge from "${path[index - 1]}" to "${id}"`, path: `/path/${index}` });
    }
  });
  if (errors.length) throw new DiagramValidationError(errors);
}
