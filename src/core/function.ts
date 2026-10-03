import Ajv from 'ajv';
import schema from '../../schemas/function.schema.json';
import type { FunctionDSL } from '../dsl/function';
import type { FunctionIR, ValidationIssue, ValidationResult } from './types';
import { compileExpression } from './expression';
import { DiagramValidationError } from './validator';

const validateShape = new Ajv({ allErrors: true }).compile<FunctionDSL>(schema);
export function validateFunctionDSL(input: unknown): ValidationResult {
  if (!validateShape(input)) return { valid: false, errors: (validateShape.errors ?? []).map(error => ({
    code: 'SCHEMA_VALIDATION_ERROR', message: error.message ?? 'Invalid function diagram', path: error.instancePath || '/',
  })) };
  const errors: ValidationIssue[] = [];
  for (const axis of ['x', 'y'] as const) if (input.domain[axis][0] >= input.domain[axis][1]) {
    errors.push({ code: 'INVALID_DOMAIN', message: `${axis} bounds must be increasing`, path: `/domain/${axis}` });
  }
  const x = input.interactive?.point?.x ?? Math.min(input.domain.x[1], Math.max(input.domain.x[0], 0));
  if (x < input.domain.x[0] || x > input.domain.x[1]) errors.push({ code: 'INVALID_POINT', message: 'Point x must be within the x domain', path: '/interactive/point/x' });
  try {
    const evaluate = compileExpression(input.expression);
    if (!Number.isFinite(evaluate(x))) errors.push({ code: 'INVALID_POINT', message: 'Function must be finite at the initial point', path: '/interactive/point/x' });
  } catch (error) {
    errors.push({ code: 'INVALID_EXPRESSION', message: error instanceof Error ? error.message : String(error), path: '/expression' });
  }
  return errors.length ? { valid: false, errors } : { valid: true, errors: [] };
}
export function parseFunctionDSL(input: unknown): FunctionIR {
  const result = validateFunctionDSL(input);
  if (!result.valid) throw new DiagramValidationError(result.errors);
  const spec = input as FunctionDSL;
  return {
    id: spec.id, kind: 'function', expression: spec.expression,
    domain: { x: [...spec.domain.x], y: [...spec.domain.y] },
    pointX: spec.interactive?.point?.x ?? Math.min(spec.domain.x[1], Math.max(spec.domain.x[0], 0)),
    showCoordinate: spec.interactive?.showCoordinate ?? true,
    evaluate: compileExpression(spec.expression),
  };
}
