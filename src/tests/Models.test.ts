import { describe, it, expect } from 'vitest';
import { ExpressionElement } from '../models/ExpressionElement';
import { Variable } from '../models/Variable';
import { ValuedVariable } from '../models/ValuedVariable';

// Tests for ExpressionElement
describe('ExpressionElement', () => {
  it('correctly identifies literal, operator, and variable types', () => {
    const lit = new ExpressionElement('1', 'literal', 'foo');
    expect(lit.isLiteral()).toBe(true);
    expect(lit.isOperator()).toBe(false);
    expect(lit.isVariable()).toBe(false);
    expect(lit.toString()).toBe('foo');

    const op = new ExpressionElement('2', 'operator', '+');
    expect(op.isOperator()).toBe(true);
    expect(op.toString()).toBe('+');

    const v = new Variable('v1', 'string', 'bar', 'node');
    const varElem = new ExpressionElement('3', 'variable', 'ignored', v);
    expect(varElem.isVariable()).toBe(true);
    expect(varElem.toString()).toBe('bar');
  });

  it('throws when setting variable on non-variable element', () => {
    const el = new ExpressionElement('x', 'literal', '1');
    expect(() => el.setVariable(new Variable('v', 'integer', 'num', 'n')))
      .toThrowError('Cannot set variable on non-variable element');
  });

  it('supports clone and round-trip via toObject/fromObject', () => {
    const v = new Variable('vv', 'float', 'f', 'n');
    const elem = new ExpressionElement('eid', 'variable', '', v);
    const clone = elem.clone();
    expect(clone).not.toBe(elem);
    expect(clone.id).toBe(elem.id);
    expect(clone.type).toBe(elem.type);
    expect(clone.value).toBe(elem.value);
    expect(clone.variable?.toString()).toBe(elem.variable?.toString());

    const obj = elem.toObject();
    const fromObj = ExpressionElement.fromObject(obj);
    expect(fromObj.id).toBe(elem.id);
    expect(fromObj.type).toBe(elem.type);
    expect(fromObj.value).toBe(elem.value);
  });
});

// Tests for Variable
describe('Variable', () => {
  const base = new Variable('id1', 'boolean', 'flag', 'nodeA');

  it('returns correct strings', () => {
    expect(base.toString()).toBe('flag');
    expect(base.toDeclarationString()).toBe('boolean flag');
  });

  it('clone and isEqual work properly', () => {
    const c = base.clone();
    expect(c).not.toBe(base);
    expect(c.isEqual(base)).toBe(true);
    const other = new Variable('id2', 'boolean', 'flag', 'nodeA');
    expect(other.isEqual(base)).toBe(false);
  });

  it('update and round-trip via toObject/fromObject', () => {
    const updated = base.update({ name: 'newFlag', type: 'string' });
    expect(updated.name).toBe('newFlag');
    expect(updated.type).toBe('string');

    const obj = base.toObject();
    const fromObj = Variable.fromObject(obj);
    expect(fromObj.id).toBe(base.id);
    expect(fromObj.name).toBe(base.name);
  });
});

// Tests for ValuedVariable
describe('ValuedVariable', () => {
  const v = new Variable('vid', 'integer', 'num', 'nodeB');

  it('toString and toObject work', () => {
    const vv = new ValuedVariable(v.id, v.type, v.name, v.nodeId, 42);
    expect(vv.toString()).toBe('num: 42');
    const obj = vv.toObject();
    expect(obj.value).toBe(42);
    const fromObj = ValuedVariable.fromObject(obj);
    expect(fromObj.value).toBe(42);
  });

  it('fromVariable uses provided value or default initialization', () => {
    // with explicit value
    const vv1 = ValuedVariable.fromVariable<"integer">(v, 7);
    expect(vv1.value).toBe(7);

    // without value (null) ==> default 0 for integer
    const vv2 = ValuedVariable.fromVariable<"integer">(v, null);
    expect(vv2.value).toBe(0);

    // test default for boolean
    const bv = new Variable('b1', 'boolean', 'flag', 'node');
    const vb = ValuedVariable.fromVariable<"boolean">(bv, null);
    expect(vb.value).toBe(false);

    // test default for string
    const sv = new Variable('s1', 'string', 'text', 'node');
    const vs = ValuedVariable.fromVariable<"string">(sv, null);
    expect(vs.value).toBe('');
  });
}); 