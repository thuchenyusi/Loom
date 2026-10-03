import { describe, expect, it } from 'vitest';
import example from '../examples/decision.json';
import { parseDecisionDSL } from '../src/core/parser';
import { DiagramValidationError, validateDecisionDSL, validateGraphPath } from '../src/core/validator';

describe('Decision DSL validation and parsing', () => {
  it('converts a complete 14-node diagram into semantic IR', () => {
    const ir = parseDecisionDSL(example);
    expect(ir.kind).toBe('graph');
    expect(ir.nodes).toHaveLength(14);
    expect(ir.edges).toHaveLength(14);
    expect(ir.edges).toContainEqual(expect.objectContaining({ source: 'network', target: 'vpn', branch: 'no' }));
    expect(ir.samples.map(sample => sample.id)).toEqual(['alice', 'bob', 'guest']);
    expect(ir.nodes[0]).not.toHaveProperty('yes');
    ir.samples[0].path.pop();
    expect(example.samples.alice.path).toHaveLength(5);
  });
  it.each([null, {}, { ...example, type: 'function' }, { ...example, nodes: {} }, { ...example, unsupported: {} }])('rejects malformed or unsupported DSL: %j', input => {
    expect(validateDecisionDSL(input)).toMatchObject({ valid: false, errors: expect.arrayContaining([expect.objectContaining({ code: 'SCHEMA_VALIDATION_ERROR' })]) });
    expect(() => parseDecisionDSL(input)).toThrow(DiagramValidationError);
  });
  it('reports missing start and targets with JSON pointer locations', () => {
    const spec = structuredClone(example);
    spec.start = 'missing';
    spec.nodes.network.yes = 'missing-target';
    const result = validateDecisionDSL(spec);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'START_NODE_NOT_FOUND', path: '/start' }),
      expect.objectContaining({ code: 'TARGET_NODE_NOT_FOUND', path: '/nodes/network/yes' }),
    ]));
  });
  it.each([
    ['network', 'missing'], ['network', 'allow-admin'], ['account', 'role', 'mfa', 'allow-admin'], ['network', 'account'],
  ].map(path => [path] as const))('rejects invalid sample path %j', path => {
    const spec = structuredClone(example);
    spec.samples.alice.path = path;
    expect(validateDecisionDSL(spec)).toMatchObject({ valid: false, errors: expect.arrayContaining([expect.objectContaining({ code: 'INVALID_SAMPLE_PATH' })]) });
  });
  it('allows partial API paths but rejects empty and disconnected paths', () => {
    const ir = parseDecisionDSL(example);
    expect(() => validateGraphPath(ir, ['role', 'mfa'])).not.toThrow();
    expect(() => validateGraphPath(ir, [])).toThrow(DiagramValidationError);
    expect(() => validateGraphPath(ir, ['role', 'vpn'])).toThrow(DiagramValidationError);
  });
  it('handles prototype-like IDs as own keys and avoids node/edge collisions', () => {
    const spec = JSON.parse('{"type":"decision","start":"__proto__","nodes":{"__proto__":{"type":"decision","label":"Start","yes":"edge:[\\"__proto__\\",\\"yes\\"]","no":"constructor"},"constructor":{"type":"result","label":"No"},"edge:[\\"__proto__\\",\\"yes\\"]":{"type":"result","label":"Yes"}}}');
    const ir = parseDecisionDSL(spec);
    expect(new Set([...ir.nodes, ...ir.edges].map(item => item.id)).size).toBe(5);
    expect(validateDecisionDSL({ ...spec, start: 'toString' }).valid).toBe(false);
  });
});
