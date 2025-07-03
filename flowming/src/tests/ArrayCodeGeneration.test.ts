import { describe, it, expect } from 'vitest';
import { generatePythonCode } from '../utils/codeGeneration';
import { FlowNode } from '../components/Flow/FlowTypes';
import { Edge } from '@xyflow/react';
import { Expression } from '../models/Expression';
import { ExpressionElement } from '../models/ExpressionElement';
import { Variable } from '../models/Variable';

// Helper functions
const createNode = (
  id: string,
  type: string,
  data: object = {},
  position = { x: 0, y: 0 }
): FlowNode => ({
  id,
  type,
  position,
  data: { label: `Node ${id}`, ...data },
  selected: false,
  dragging: false,
  width: 100,
  height: 50,
});

const createEdge = (
  source: string,
  target: string,
  label?: 'yes' | 'no'
): Edge => {
    const edge: Edge = {
        id: `e${source}-${target}`,
        source,
        target,
    };
    if (label) {
        edge.data = { conditionalLabel: label };
    }
    return edge;
};

const cleanCode = (code: string) => {
  // Removes comments and empty lines for easier assertions
  return code
    .split('\n')
    .filter(line => !line.trim().startsWith('#'))
    .join('\n')
    .trim();
};

// arr : integer[5]
const arrVar = new Variable('var-arr', 'array', 'arr', 'n1', 'integer', 5);
// i : integer
const idxVar = new Variable('var-i', 'integer', 'i', 'n1');

const createLiteralEl = (value: any) => new ExpressionElement('lit', 'literal', String(value));
const createVarEl = (v: Variable) => new ExpressionElement('v', 'variable', v.name, v);
const createOpEl = (op: string) => new ExpressionElement('op', 'operator', op);

describe('codeGeneration – arrays', () => {
  it('should generate an assignment to an array element arr[i] = 5', () => {
    const arrIdxVar = arrVar.clone();
    arrIdxVar.indexExpression = [createVarEl(idxVar)];

    const nodes: FlowNode[] = [
      createNode('1', 'Start'),
      createNode('2', 'AssignVariable', {
        expression: new Expression(arrIdxVar, [createLiteralEl(5)]).toObject(),
      }),
      createNode('3', 'End'),
    ];

    const edges: Edge[] = [
      createEdge('1', '2'),
      createEdge('2', '3'),
    ];

    const code = generatePythonCode(nodes, edges);
    expect(cleanCode(code)).toBe('arr[i] = 5');
  });

  it('should generate input into an array element', () => {
    const arrIdxVar = arrVar.clone();
    arrIdxVar.indexExpression = [createVarEl(idxVar)];

    const nodes: FlowNode[] = [
      createNode('1', 'Start'),
      createNode('2', 'Input', { variable: arrIdxVar }),
      createNode('3', 'End'),
    ];
    const edges: Edge[] = [createEdge('1', '2'), createEdge('2', '3')];

    const code = generatePythonCode(nodes, edges);
    const expected = "arr[i] = int(input(\"Enter the value of 'arr' by keyboard\"))";
    expect(cleanCode(code)).toBe(expected);
  });

  it('should generate output of an array element', () => {
    const arrIdxVar = arrVar.clone();
    arrIdxVar.indexExpression = [createVarEl(idxVar)];
    const expr = new Expression(undefined, [createVarEl(arrIdxVar)]);

    const nodes: FlowNode[] = [
      createNode('1', 'Start'),
      createNode('2', 'Output', { expression: expr.toObject() }),
      createNode('3', 'End'),
    ];
    const edges: Edge[] = [createEdge('1', '2'), createEdge('2', '3')];

    const code = generatePythonCode(nodes, edges);
    expect(cleanCode(code)).toBe('print(arr[i])');
  });

  it('should generate a conditional based on an array element', () => {
    const arrIdxVar = arrVar.clone();
    arrIdxVar.indexExpression = [createVarEl(idxVar)];
    const condExpr = new Expression([createVarEl(arrIdxVar)], [createLiteralEl(0)], '>');

    const nodes: FlowNode[] = [
      createNode('1', 'Start'),
      createNode('2', 'Conditional', { expression: condExpr.toObject() }),
      createNode('3', 'End'),
    ];
    const edges: Edge[] = [
      createEdge('1', '2'),
      createEdge('2', '3', 'yes'),
      createEdge('2', '3', 'no'),
    ];

    const code = generatePythonCode(nodes, edges);
    expect(cleanCode(code)).toContain('if (arr[i] > 0):');
  });

  it('should ignore DeclareVariable for array variable in generated code', () => {
    const nodes: FlowNode[] = [
      createNode('1', 'Start'),
      createNode('2', 'DeclareVariable', { variable: arrVar.toObject() }),
      createNode('3', 'End'),
    ];
    const edges: Edge[] = [createEdge('1', '2'), createEdge('2', '3')];

    const code = generatePythonCode(nodes, edges);
    expect(cleanCode(code)).toBe('');
  });

  // Complex index expression scenarios
  
  it('should generate assignment with arithmetic index arr[i + 1] = 0', () => {
    const arrIdxVar = arrVar.clone();
    arrIdxVar.indexExpression = [createVarEl(idxVar), createOpEl('+'), createLiteralEl(1)];

    const nodes: FlowNode[] = [
      createNode('1', 'Start'),
      createNode('2', 'AssignVariable', {
        expression: new Expression(arrIdxVar, [createLiteralEl(0)]).toObject(),
      }),
      createNode('3', 'End'),
    ];
    const edges: Edge[] = [createEdge('1', '2'), createEdge('2', '3')];

    const code = generatePythonCode(nodes, edges);
    expect(cleanCode(code)).toBe('arr[(i + 1)] = 0');
  });

  it('should generate assignment with function and arithmetic in index', () => {
    // arr[int((i * 2) - 1)] = 3
    const arrIdxVar = arrVar.clone();
    const innerExpr = new Expression(undefined, [
      createVarEl(idxVar), createOpEl('*'), createLiteralEl(2), createOpEl('-'), createLiteralEl(1)
    ]);
    const funcEl = new ExpressionElement('fn', 'function', 'integer', innerExpr);
    arrIdxVar.indexExpression = [funcEl];

    const nodes: FlowNode[] = [
      createNode('1', 'Start'),
      createNode('2', 'AssignVariable', {
        expression: new Expression(arrIdxVar, [createLiteralEl(3)]).toObject(),
      }),
      createNode('3', 'End'),
    ];
    const edges: Edge[] = [createEdge('1', '2'), createEdge('2', '3')];

    const code = generatePythonCode(nodes, edges);
    const expected = 'arr[int(((i * 2) - 1))] = 3';
    expect(cleanCode(code)).toBe(expected);
  });
}); 