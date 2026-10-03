import { describe, expect, it } from 'vitest';
import spec from '../examples/function.json';
import { compileExpression } from '../src/core/expression';
import { parseFunctionDSL, validateFunctionDSL } from '../src/core/function';
import { DiagramValidationError } from '../src/core/validator';

describe('Bounded math expressions', () => {
  it.each([
    ['x * x / 10', 2, 0.4], ['-2^2', 0, -4], ['2^3^2', 0, 512],
    ['2 ** -2', 0, 0.25], ['sin(pi / 2) + cos(0)', 0, 2],
    ['max(abs(x), pow(2, 3))', -9, 9], ['sqrt(4) + 1e-2', 0, 2.01],
  ] as const)('evaluates %s', (expression, x, value) => {
    expect(compileExpression(expression)(x)).toBeCloseTo(value);
  });
  it.each(['alert(1)', 'x.constructor', 'Math.sin(x)', 'x; fetch("x")', 'constructor(x)', 'sin(x, 2)', 'pow(2)', '(x', '1 2', 'x = 1', '1e999', ''])('rejects %s', expression => {
    expect(() => compileExpression(expression)).toThrow(SyntaxError);
  });
  it('bounds nesting and total work', () => {
    expect(() => compileExpression('('.repeat(70) + 'x' + ')'.repeat(70))).toThrow('deeply');
    expect(() => compileExpression('x'.repeat(513))).toThrow('long');
  });
});
describe('Function DSL', () => {
  it('parses math coordinates independently of renderer details', () => {
    const ir = parseFunctionDSL(spec);
    expect(ir.kind).toBe('function');
    expect(ir.pointX).toBe(2);
    expect(ir.evaluate(2)).toBeCloseTo(0.4);
    ir.domain.x[0] = 100;
    expect(spec.domain.x[0]).toBe(-5);
  });
  it.each([
    [{ ...spec, domain: { x: [5, -5], y: [-2, 5] } }, 'INVALID_DOMAIN'],
    [{ ...spec, interactive: { point: { x: 6 } } }, 'INVALID_POINT'],
    [{ ...spec, expression: '1 / (x - 2)' }, 'INVALID_POINT'],
    [{ ...spec, expression: 'eval(x)' }, 'INVALID_EXPRESSION'],
    [{ ...spec, domain: { x: [0, Infinity], y: [-2, 5] } }, 'SCHEMA_VALIDATION_ERROR'],
  ])('reports invalid function input', (input, code) => {
    expect(validateFunctionDSL(input)).toMatchObject({ valid: false, errors: expect.arrayContaining([expect.objectContaining({ code })]) });
    expect(() => parseFunctionDSL(input)).toThrow(DiagramValidationError);
  });
  it('chooses a default point inside the domain', () => {
    expect(parseFunctionDSL({ ...spec, domain: { x: [3, 5], y: [0, 5] }, interactive: {} }).pointX).toBe(3);
  });
});
