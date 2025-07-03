import { describe, it, expect, beforeEach } from 'vitest';
import { Expression } from '../models/Expression';
import { ExpressionElement, ExpressionElementType } from '../models/ExpressionElement';
import { Variable } from '../models/Variable';
import { ValuedVariable } from '../models/ValuedVariable';

// Helper utilities
let idCounter = 0;
const freshId = () => `elem-${idCounter++}`;
beforeEach(() => { idCounter = 0; });

const createElement = (
  type: ExpressionElementType,
  value: string,
  variableOrNested?: Variable | Expression
): ExpressionElement => new ExpressionElement(freshId(), type, value, variableOrNested);

const createLiteral = (value: any) => createElement('literal', String(value));
const createVariableEl = (variable: Variable) => createElement('variable', variable.name, variable);
const createOperator = (op: string) => createElement('operator', op);
const createFunctionEl = (fn: string, nested: Expression) => createElement('function', fn, nested);

// Base array variable "arr" : integer[3]
const arrVar = new Variable('var-arr', 'array', 'arr', 'node-1', 'integer', 3);
// Index variable "i" : integer
const idxVar = new Variable('var-idx', 'integer', 'i', 'node-1');

// Valued variables providing runtime context
const valuedArr = new ValuedVariable('var-arr', 'array', 'arr', 'node-1', [0, 1, 2], 'integer', 3);
const valuedIdx = new ValuedVariable('var-idx', 'integer', 'i', 'node-1', 1);

const defaultContext = [valuedArr.clone(), valuedIdx.clone()];

const makeArrayVariableWithIndex = (indexElements: ExpressionElement[]) => {
  const v = arrVar.clone();
  v.indexExpression = indexElements;
  return v;
};

describe('Array expressions – evaluation and assignment', () => {

  describe('Reading array elements', () => {
    it('should evaluate arr[i] correctly using a variable index', () => {
      const arrIdxVar = makeArrayVariableWithIndex([createVariableEl(idxVar)]);
      const exprElements = [createVariableEl(arrIdxVar)];
      const expr = new Expression(undefined, exprElements);
      expect(expr.calculateValue(exprElements, 'integer', defaultContext)).toBe(1); // arr[1] == 1
    });

    it('should evaluate arr[2] correctly using a literal index', () => {
      const arrIdxVar = makeArrayVariableWithIndex([createLiteral(2)]);
      const exprElements = [createVariableEl(arrIdxVar)];
      const expr = new Expression(undefined, exprElements);
      expect(expr.calculateValue(exprElements, 'integer', defaultContext)).toBe(2);
    });

    it('should throw on out-of-bounds access', () => {
      const arrIdxVar = makeArrayVariableWithIndex([createLiteral(3)]); // size is 3 ⇒ max idx 2
      const expr = new Expression(undefined, [createVariableEl(arrIdxVar)]);
      expect(() => expr.calculateValue(expr.rightSide, 'integer', defaultContext))
        .toThrow('out of bounds');
    });

    it('should throw when index is not an integer', () => {
      const arrIdxVar = makeArrayVariableWithIndex([createLiteral("'a'")]);
      const expr = new Expression(undefined, [createVariableEl(arrIdxVar)]);
      expect(() => expr.calculateValue(expr.rightSide, 'integer', defaultContext))
        .toThrow('must be an integer');
    });
  });

  describe('Writing array elements', () => {
    it('should assign to arr[0] = 10', () => {
      const arrIdxVar = makeArrayVariableWithIndex([createLiteral(0)]);
      const assignExpr = new Expression(arrIdxVar, [createLiteral(10)]);
      const updated = assignExpr.assignValue([valuedArr.clone()]);
      expect(updated.value).toEqual([10, 1, 2]);
    });

    it('should assign to arr[i] using variable index', () => {
      const arrIdxVar = makeArrayVariableWithIndex([createVariableEl(idxVar)]);
      const assignExpr = new Expression(arrIdxVar, [createLiteral(42)]);
      const updated = assignExpr.assignValue(defaultContext);
      const expected = [0, 42, 2]; // i == 1
      expect(updated.value).toEqual(expected);
    });

    it('should throw on type mismatch when assigning string into integer array', () => {
      const arrIdxVar = makeArrayVariableWithIndex([createLiteral(1)]);
      const assignExpr = new Expression(arrIdxVar, [createLiteral("'hello'")]);
      expect(() => assignExpr.assignValue(defaultContext))
        .toThrow('Type mismatch');
    });

    it('should assign using arithmetic index expression arr[i + 1] = 7', () => {
      const complexIdx = [createVariableEl(idxVar), createOperator('+'), createLiteral(1)];
      const arrIdxVar = makeArrayVariableWithIndex(complexIdx);
      const assignExpr = new Expression(arrIdxVar, [createLiteral(7)]);
      const ctx = [
        new ValuedVariable('var-arr', 'array', 'arr', 'node-1', [0,1,2], 'integer', 3),
        valuedIdx.clone(),
      ];
      const updated = assignExpr.assignValue(ctx);
      expect(updated.value).toEqual([0,1,7]); // i==1 so index 2
    });

    it('should assign using function & arithmetic in index arr[int((i*2)-1)] = 9', () => {
      const innerExpr = new Expression(undefined, [
        createVariableEl(idxVar), createOperator('*'), createLiteral(2), createOperator('-'), createLiteral(1)
      ]);
      const funcEl = createFunctionEl('integer', innerExpr);
      const arrIdxVar = makeArrayVariableWithIndex([funcEl]);
      const assignExpr = new Expression(arrIdxVar, [createLiteral(9)]);

      const ctx = [
        new ValuedVariable('var-arr', 'array', 'arr', 'node-1', [0,1,2], 'integer', 3),
        valuedIdx.clone(),
      ];
      const updated = assignExpr.assignValue(ctx);
      // i=1 -> (1*2)-1 =1 => int(1)=1
      expect(updated.value).toEqual([0,9,2]);
    });

    it('should throw when assigning to whole array variable without index', () => {
      const assignExpr = new Expression(arrVar.clone(), [createLiteral(5)]);
      expect(() => assignExpr.assignValue(defaultContext))
        .toThrow('Cannot assign directly to array variable');
    });
  });
}); 