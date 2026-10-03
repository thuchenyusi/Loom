import { describe, expect, it } from 'vitest';
import combo from '../examples/combo.json';
import { parseDecisionDSL } from '../src/core/parser';
import { validateDecisionDSL } from '../src/core/validator';

describe('Group IR and semantic validation', () => {
  it('preserves nested memberships and initial collapse flags', () => {
    const ir = parseDecisionDSL(combo);
    expect(ir.groups).toContainEqual({ id: 'verification', label: 'Verification · 二次验证', parent: 'authentication', collapsed: true });
    expect(ir.nodes.find(node => node.id === 'mfa')?.group).toBe('verification');
  });
  it('rejects unknown memberships and parents', () => {
    const spec = structuredClone(combo);
    spec.nodes.mfa.group = 'missing';
    spec.groups.verification.parent = 'missing';
    const result = validateDecisionDSL(spec);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'UNKNOWN_GROUP', path: '/nodes/mfa/group' }),
      expect.objectContaining({ code: 'UNKNOWN_GROUP', path: '/groups/verification/parent' }),
    ]));
  });
  it('rejects cycles and node/group collisions', () => {
    const spec = { ...combo, groups: {
      authentication: { label: 'Auth', parent: 'verification' }, verification: { label: 'Verify', parent: 'authentication' },
      entry: { label: 'Collision' },
    } };
    expect(validateDecisionDSL(spec).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CYCLIC_GROUP' }),
      expect.objectContaining({ code: 'DUPLICATE_ELEMENT_ID' }),
    ]));
  });
});
