import { describe, it, expect, beforeEach } from 'vitest';
import { generatePythonCode } from '../utils/codeGeneration';
import { FlowNode } from '../components/Flow/FlowTypes';
import { Edge } from '@xyflow/react';
import { Expression } from '../models/Expression';
import { ExpressionElement } from '../models/ExpressionElement';
import { Variable } from '../models/Variable';

// --- Test Helpers ---

let nodeIdCounter = 0;
const freshNodeId = () => `${++nodeIdCounter}`;

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

const varInt = (name: string) => new Variable(`var-${name}`, 'integer', name, 'node-1');
const createLiteralEl = (value: any) => new ExpressionElement('el-lit', 'literal', String(value));
const createVarEl = (v: Variable) => new ExpressionElement('el-var', 'variable', v.name, v);
const createOpEl = (op: string) => new ExpressionElement('el-op', 'operator', op);

// --- Test Suite ---

describe('codeGeneration', () => {

  beforeEach(() => {
    nodeIdCounter = 0;
  });
  
  const cleanCode = (code: string) => {
    // Removes comments and empty lines
    return code
      .split('\n')
      .filter(line => !line.trim().startsWith('#'))
      .join('\n')
      .trim();
  };

  it('should handle an empty diagram', () => {
    const code = generatePythonCode([], []);
    expect(code).toContain('No nodes in diagram');
  });

  it('should handle a diagram with only Start and End nodes', () => {
    const nodes = [createNode('1', 'Start'), createNode('2', 'End')];
    const edges = [createEdge('1', '2')];
    const code = generatePythonCode(nodes, edges);
    expect(cleanCode(code)).toBe('');
  });

  it('should generate a simple assignment', () => {
    const x = varInt('x');
    const nodes: FlowNode[] = [
      createNode('1', 'Start'),
      createNode('2', 'AssignVariable', {
        expression: new Expression(x, [createLiteralEl(10)]).toObject(),
      }),
      createNode('3', 'End'),
    ];
    const edges: Edge[] = [createEdge('1', '2'), createEdge('2', '3')];
    const code = generatePythonCode(nodes, edges);
    expect(cleanCode(code)).toBe('x = 10');
  });

  it('should generate an if-else statement', () => {
    const x = varInt('x');
    const nodes: FlowNode[] = [
      createNode('1', 'Start'),
      createNode('2', 'Conditional', {
        expression: new Expression([createVarEl(x)], [createLiteralEl(0)], '>').toObject()
      }),
      createNode('3', 'AssignVariable', { expression: new Expression(varInt('y'), [createLiteralEl(1)]).toObject() }),
      createNode('4', 'AssignVariable', { expression: new Expression(varInt('y'), [createLiteralEl(-1)]).toObject() }),
      createNode('5', 'End'),
    ];
    const edges: Edge[] = [
      createEdge('1', '2'),
      createEdge('2', '3', 'yes'),
      createEdge('2', '4', 'no'),
      createEdge('3', '5'),
      createEdge('4', '5'),
    ];

    const code = generatePythonCode(nodes, edges);
    const expected = `if (x > 0):\n  y = 1\nelse:\n  y = -1`;
    expect(cleanCode(code)).toBe(expected);
  });

  it('should handle complex boolean logic in conditions', () => {
    const a = new Variable('a-id', 'boolean', 'a', 'n1');
    const b = new Variable('b-id', 'boolean', 'b', 'n1');
    const c = new Variable('c-id', 'boolean', 'c', 'n1');
    const y = varInt('y');

    const nodes: FlowNode[] = [
        createNode('1', 'Start'),
        createNode('2', 'Conditional', {
            expression: new Expression(
                [createVarEl(a), createOpEl('&&'), createVarEl(b), createOpEl('||'), createVarEl(c)],
                [createLiteralEl(true)],
                '=='
            ).toObject()
        }),
        createNode('3', 'AssignVariable', { expression: new Expression(y, [createLiteralEl(1)]).toObject() }),
        createNode('4', 'AssignVariable', { expression: new Expression(y, [createLiteralEl(0)]).toObject() }),
        createNode('5', 'End'),
    ];
    const edges: Edge[] = [
        createEdge('1', '2'),
        createEdge('2', '3', 'yes'),
        createEdge('2', '4', 'no'),
        createEdge('3', '5'),
        createEdge('4', '5'),
    ];
    const code = generatePythonCode(nodes, edges);
    const expected = `if (((a and b) or c) == True):\n  y = 1\nelse:\n  y = 0`;
    expect(cleanCode(code)).toBe(expected);
  });

  it('should handle function calls within expressions', () => {
    const s = new Variable('s-id', 'string', 's', 'n1');
    const x = varInt('x');
    const nodes: FlowNode[] = [
        createNode('1', 'Start'),
        createNode('2', 'AssignVariable', {
            expression: new Expression(
                x,
                [
                    createOpEl('('),
                    new ExpressionElement('fn1', 'function', 'integer', new Expression(undefined, [createVarEl(s)])),
                    createOpEl('+'),
                    createLiteralEl(10),
                    createOpEl(')'),
                    createOpEl('*'),
                    createLiteralEl(2)
                ]
            ).toObject()
        }),
        createNode('3', 'End'),
    ];
    const edges: Edge[] = [ createEdge('1', '2'), createEdge('2', '3') ];
    const code = generatePythonCode(nodes, edges);
    const expected = 'x = ((int(s) + 10) * 2)';
    expect(cleanCode(code)).toBe(expected);
  });

  describe('Loop Generation', () => {
    it('should generate a simple while loop (loop on YES)', () => {
      const i = varInt('i');
      const nodes: FlowNode[] = [
        createNode('1', 'Start'),
        createNode('2', 'AssignVariable', { expression: new Expression(i, [createLiteralEl(5)]).toObject() }),
        createNode('3', 'Conditional', { 
          expression: new Expression([createVarEl(i)], [createLiteralEl(0)], '>').toObject() 
        }),
        createNode('4', 'AssignVariable', { 
          expression: new Expression(i, [createVarEl(i), createOpEl('-'), createLiteralEl(1)]).toObject() 
        }),
        createNode('5', 'End'),
      ];
      const edges: Edge[] = [
        createEdge('1', '2'),
        createEdge('2', '3'),
        createEdge('3', '4', 'yes'),
        createEdge('4', '3'), // Loop back
        createEdge('3', '5', 'no'),
      ];

      const code = generatePythonCode(nodes, edges);
      const expected = `i = 5\nwhile (i > 0):\n  i = (i - 1)`;
      expect(cleanCode(code)).toBe(expected);
    });

    it('should generate a while loop with a NOT condition (loop on NO)', () => {
        const x = varInt('x');
        const nodes: FlowNode[] = [
            createNode('1', 'Start'),
            createNode('2', 'Conditional', { expression: new Expression([createVarEl(x)], [createLiteralEl(10)], '==').toObject() }),
            createNode('3', 'AssignVariable', { expression: new Expression(x, [createVarEl(x), createOpEl('+'), createLiteralEl(1)]).toObject() }),
            createNode('4', 'End')
        ];
        const edges: Edge[] = [
            createEdge('1', '2'),
            createEdge('2', '4', 'yes'),
            createEdge('2', '3', 'no'),
            createEdge('3', '2') // loop back
        ];
        const code = generatePythonCode(nodes, edges);
        const expected = "while ((x == 10) == False):\n  x = (x + 1)";
        expect(cleanCode(code)).toBe(expected);
    });

    it('should generate a while True with an if/else inside (loop on both branches)', () => {
        const x = varInt('x');
        const y = varInt('y');
        const nodes: FlowNode[] = [
            createNode('1', 'Start'),
            createNode('2', 'Conditional', { expression: new Expression([createVarEl(x)], [createLiteralEl(0)], '>').toObject() }),
            createNode('3', 'AssignVariable', { expression: new Expression(y, [createLiteralEl(1)]).toObject() }),
            createNode('4', 'AssignVariable', { expression: new Expression(y, [createLiteralEl(-1)]).toObject() }),
        ];
        const edges: Edge[] = [
            createEdge('1', '2'),
            createEdge('2', '3', 'yes'),
            createEdge('2', '4', 'no'),
            createEdge('3', '2'), // loop back
            createEdge('4', '2'), // loop back
        ];
        const code = generatePythonCode(nodes, edges);
        const expected = "while True:\n  if (x > 0):\n    y = 1\n  else:\n    y = -1";
        expect(cleanCode(code)).toBe(expected);
    });

    it('should generate an unconditional while True loop', () => {
      const x = varInt('x');
      const nodes: FlowNode[] = [
        createNode('1', 'Start'),
        createNode('2', 'AssignVariable', { expression: new Expression(x, [createLiteralEl(1)]).toObject() }),
        createNode('3', 'AssignVariable', { expression: new Expression(x, [createVarEl(x), createOpEl('+'), createLiteralEl(1)]).toObject() }),
        createNode('4', 'End'),
      ];
      const edges: Edge[] = [
        createEdge('1', '2'),
        createEdge('2', '3'),
        createEdge('3', '2'), // loop back to previous node
        createEdge('3', '4'),
      ];
      const code = generatePythonCode(nodes, edges);
      const expected = "while True:\n  x = 1\n  x = (x + 1)";
      expect(cleanCode(code)).toBe(expected);
    });

    it('should generate nested loops correctly', () => {
      const i = varInt('i');
      const j = varInt('j');
      const nodes: FlowNode[] = [
        createNode('1', 'Start'),
        createNode('2', 'AssignVariable', { expression: new Expression(i, [createLiteralEl(3)]).toObject() }),
        createNode('3', 'Conditional', { expression: new Expression([createVarEl(i)], [createLiteralEl(0)], '>').toObject() }), // Outer loop
        createNode('4', 'AssignVariable', { expression: new Expression(j, [createLiteralEl(2)]).toObject() }),
        createNode('5', 'Conditional', { expression: new Expression([createVarEl(j)], [createLiteralEl(0)], '>').toObject() }), // Inner loop
        createNode('6', 'AssignVariable', { expression: new Expression(j, [createVarEl(j), createOpEl('-'), createLiteralEl(1)]).toObject() }),
        createNode('7', 'AssignVariable', { expression: new Expression(i, [createVarEl(i), createOpEl('-'), createLiteralEl(1)]).toObject() }),
        createNode('8', 'End'),
      ];
      const edges: Edge[] = [
        createEdge('1', '2'), createEdge('2', '3'),
        createEdge('3', '4', 'yes'), // Enter outer loop
        createEdge('3', '8', 'no'),  // Exit outer loop
        createEdge('4', '5'),
        createEdge('5', '6', 'yes'), // Enter inner loop
        createEdge('6', '5'),         // Back edge for inner loop
        createEdge('5', '7', 'no'),  // Exit inner loop
        createEdge('7', '3'),         // Back edge for outer loop
      ];
      const code = generatePythonCode(nodes, edges);
      const expected = "i = 3\nwhile (i > 0):\n  j = 2\n  while (j > 0):\n    j = (j - 1)\n  i = (i - 1)";
      expect(cleanCode(code)).toBe(expected);
    });

    it('should generate a while loop with multiple body statements', () => {
      const i = varInt('i');
      const nodes: FlowNode[] = [
        createNode('1', 'Start'),
        createNode('2', 'AssignVariable', { expression: new Expression(i, [createLiteralEl(5)]).toObject() }),
        createNode('3', 'Conditional', { expression: new Expression([createVarEl(i)], [createLiteralEl(0)], '>').toObject() }),
        createNode('4', 'Output', { expression: new Expression(undefined, [createVarEl(i)]).toObject() }),
        createNode('5', 'AssignVariable', { expression: new Expression(i, [createVarEl(i), createOpEl('-'), createLiteralEl(1)]).toObject() }),
        createNode('6', 'End'),
      ];
      const edges: Edge[] = [
        createEdge('1', '2'),
        createEdge('2', '3'),
        createEdge('3', '4', 'yes'),
        createEdge('4', '5'),
        createEdge('5', '3'), // loop back
        createEdge('3', '6', 'no'),
      ];

      const code = generatePythonCode(nodes, edges);
      const expected = `i = 5\nwhile (i > 0):\n  print(i)\n  i = (i - 1)`;
      expect(cleanCode(code)).toBe(expected);
    });

    it('should generate a pass for a loop with empty body', () => {
      const x = varInt('x');
      const nodes: FlowNode[] = [
        createNode('1', 'Start'),
        createNode('2', 'Conditional', { expression: new Expression([createVarEl(x)], [createLiteralEl(0)], '<').toObject() }),
        createNode('3', 'End'),
      ];
      const edges: Edge[] = [
        createEdge('1', '2'),
        createEdge('2', '2', 'yes'), // loop back with no body statements
        createEdge('2', '3', 'no'),
      ];

      const code = generatePythonCode(nodes, edges);
      const expected = `while (x < 0):\n  pass`;
      expect(cleanCode(code)).toBe(expected);
    });

    it('should generate a while True loop with an effective break', () => {
      const x = varInt('x');
      const nodes: FlowNode[] = [
        createNode('1', 'Start'),
        createNode('2', 'AssignVariable', { expression: new Expression(x, [createLiteralEl(10)]).toObject() }),
        createNode('3', 'Conditional', { expression: new Expression([createLiteralEl(true)], [createLiteralEl(true)], '==').toObject() }), // while true
        createNode('4', 'AssignVariable', { expression: new Expression(x, [createVarEl(x), createOpEl('-'), createLiteralEl(1)]).toObject() }),
        createNode('5', 'Conditional', { expression: new Expression([createVarEl(x)], [createLiteralEl(0)], '==').toObject() }), // if x == 0
        createNode('6', 'End'), // break
      ];
      const edges: Edge[] = [
        createEdge('1', '2'),
        createEdge('2', '3'),
        createEdge('3', '4', 'yes'),
        createEdge('4', '5'),
        createEdge('5', '6', 'yes'), // break
        createEdge('5', '3', 'no'), // continue
      ];

      const code = generatePythonCode(nodes, edges);
      const expected = `x = 10\nwhile (True == True):\n  x = (x - 1)\n  if (x == 0):\n    break`;
      expect(cleanCode(code)).toBe(expected);
    });

    it('should generate a loop with nested if-else', () => {
      const i = varInt('i');
      const total = varInt('total');
      const nodes: FlowNode[] = [
        createNode('1', 'Start'),
        createNode('2', 'AssignVariable', { expression: new Expression(i, [createLiteralEl(5)]).toObject() }),
        createNode('3', 'AssignVariable', { expression: new Expression(total, [createLiteralEl(0)]).toObject() }),
        createNode('4', 'Conditional', { expression: new Expression([createVarEl(i)], [createLiteralEl(0)], '>').toObject() }), // while i > 0
        createNode('5', 'AssignVariable', { expression: new Expression(i, [createVarEl(i), createOpEl('-'), createLiteralEl(1)]).toObject() }),
        createNode('6', 'Conditional', { expression: new Expression([createVarEl(i), createOpEl('%'), createLiteralEl(2)], [createLiteralEl(0)], '==').toObject() }), // if i % 2 == 0
        createNode('7', 'AssignVariable', { expression: new Expression(total, [createVarEl(total), createOpEl('+'), createVarEl(i)]).toObject() }),
        createNode('8', 'End'),
      ];
      const edges: Edge[] = [
        createEdge('1', '2'), createEdge('2', '3'), createEdge('3', '4'),
        createEdge('4', '5', 'yes'), // enter loop
        createEdge('4', '8', 'no'), // end
        createEdge('5', '6'),
        createEdge('6', '4', 'yes'),
        createEdge('6', '7', 'no'),
        createEdge('7', '4'), // back to loop condition
      ];

      const code = generatePythonCode(nodes, edges);
      const expected = `i = 5\ntotal = 0\nwhile (i > 0):\n  i = (i - 1)\n  if ((i % 2) == 0):\n    pass\n  else:\n    total = (total + i)`;
      expect(cleanCode(code)).toBe(expected);
    });

    it('should generate a loop with a break after process block', () => {
      const i = varInt('i');
      const total = varInt('total');
      const nodes: FlowNode[] = [
        createNode('1', 'Start'),
        createNode('2', 'AssignVariable', { expression: new Expression(i, [createLiteralEl(5)]).toObject() }),
        createNode('3', 'AssignVariable', { expression: new Expression(total, [createLiteralEl(0)]).toObject() }),
        createNode('4', 'Conditional', { expression: new Expression([createVarEl(i)], [createLiteralEl(0)], '>').toObject() }), // while i > 0
        createNode('5', 'AssignVariable', { expression: new Expression(i, [createVarEl(i), createOpEl('-'), createLiteralEl(1)]).toObject() }),
        createNode('6', 'Conditional', { expression: new Expression([createVarEl(i), createOpEl('%'), createLiteralEl(2)], [createLiteralEl(0)], '==').toObject() }), // if i % 2 == 0
        createNode('7', 'AssignVariable', { expression: new Expression(total, [createVarEl(total), createOpEl('+'), createVarEl(i)]).toObject() }),
        createNode('8', 'End'),
      ];
      const edges: Edge[] = [
        createEdge('1', '2'), createEdge('2', '3'), createEdge('3', '4'),
        createEdge('4', '5', 'yes'), // enter loop
        createEdge('4', '8', 'no'), // end
        createEdge('5', '6'),
        createEdge('6', '4', 'yes'),
        createEdge('6', '7', 'no'),
      ];

      const code = generatePythonCode(nodes, edges);
      const expected = `i = 5\ntotal = 0\nwhile (i > 0):\n  i = (i - 1)\n  if ((i % 2) == 0):\n    pass\n  else:\n    total = (total + i)\n    break`;
      expect(cleanCode(code)).toBe(expected);
    });

    it('should correctly generate code for a loop with its entry point before the conditional test', () => {
      const i = varInt('i');
      const nodes: FlowNode[] = [
        createNode('1', 'Start'),
        createNode('2', 'AssignVariable', { expression: new Expression(i, [createLiteralEl(5)]).toObject() }),
        createNode('3', 'Conditional', { expression: new Expression([createVarEl(i)], [createLiteralEl(0)], '>').toObject() }),
        createNode('4', 'AssignVariable', { expression: new Expression(i, [createVarEl(i), createOpEl('-'), createLiteralEl(1)]).toObject() }),
        createNode('5', 'End'),
      ];
      const edges: Edge[] = [
        createEdge('1', '2'),
        createEdge('2', '3'),
        createEdge('3', '4', 'yes'),
        createEdge('4', '2'), // Back-edge to the assignment node before the conditional
        createEdge('3', '5', 'no'), // The actual exit from the loop
      ];

      const code = generatePythonCode(nodes, edges);
      const expected = `while True:\n  i = 5\n  if (i > 0):\n    i = (i - 1)\n  else:\n    break`;
      expect(cleanCode(code)).toBe(expected);
    });

    it('should generate a do-while style loop', () => {
      const i = varInt('i');
      const nodes: FlowNode[] = [
        createNode('1', 'Start'),
        createNode('2', 'AssignVariable', { expression: new Expression(i, [createLiteralEl(0)]) }),
        createNode('3', 'AssignVariable', { expression: new Expression(i, [createVarEl(i), createOpEl('+'), createLiteralEl(1)]) }), // Loop Body
        createNode('4', 'Conditional', { expression: new Expression([createVarEl(i)], [createLiteralEl(5)], '<').toObject() }), // Condition at the end
        createNode('5', 'End'),
      ];
      const edges: Edge[] = [
        createEdge('1', '2'),
        createEdge('2', '3'),
        createEdge('3', '4'),
        createEdge('4', '3', 'yes'), // Back-edge to the loop body
        createEdge('4', '5', 'no'),  // Exit from the loop
      ];
    
      const code = generatePythonCode(nodes, edges);
      const expected = `i = 0\nwhile True:\n  i = (i + 1)\n  if (i < 5):\n    pass\n  else:\n    break`;
      expect(cleanCode(code)).toBe(expected);
    });

    it('should handle a loop with multiple continue paths from an if-else', () => {
      const i = varInt('i');
      const nodes: FlowNode[] = [
        createNode('1', 'Start'),
        createNode('2', 'AssignVariable', { expression: new Expression(i, [createLiteralEl(10)]).toObject() }),
        createNode('3', 'Conditional', { expression: new Expression([createVarEl(i)], [createLiteralEl(0)], '>').toObject() }), // while
        createNode('4', 'AssignVariable', { expression: new Expression(i, [createVarEl(i), createOpEl('-'), createLiteralEl(1)]).toObject() }),
        createNode('5', 'Conditional', { expression: new Expression([createVarEl(i)], [createLiteralEl(5)], '>').toObject() }), // if
        createNode('6', 'Output', { expression: new Expression(undefined, [createLiteralEl("greater")]) }),
        createNode('7', 'Output', { expression: new Expression(undefined, [createLiteralEl("smaller")]) }),
        createNode('8', 'End'),
      ];
      const edges: Edge[] = [
        createEdge('1', '2'),
        createEdge('2', '3'),
        createEdge('3', '4', 'yes'),
        createEdge('3', '8', 'no'),
        createEdge('4', '5'),
        createEdge('5', '6', 'yes'),
        createEdge('5', '7', 'no'),
        createEdge('6', '3'), // back-edge 1
        createEdge('7', '3'), // back-edge 2
      ];

      const code = generatePythonCode(nodes, edges);
      const expected = `i = 10\nwhile (i > 0):\n  i = (i - 1)\n  if (i > 5):\n    print("greater")\n  else:\n    print("smaller")`;
      expect(cleanCode(code)).toBe(expected);
    });

    it('should handle loop with Input node inside', () => {
      // MARKED -> irrelevant?

      const x = varInt('x');
      const i = varInt('i');
      const nodes: FlowNode[] = [
        createNode('1', 'Start'),
        createNode('2', 'AssignVariable', { expression: new Expression(i, [createLiteralEl(3)]).toObject() }),
        createNode('3', 'Conditional', { expression: new Expression([createVarEl(i)], [createLiteralEl(0)], '>').toObject() }),
        createNode('4', 'Input', { variable: x.toObject() }),
        createNode('5', 'AssignVariable', { expression: new Expression(i, [createVarEl(i), createOpEl('-'), createLiteralEl(1)]).toObject() }),
        createNode('6', 'End'),
      ];
      const edges: Edge[] = [
        createEdge('1', '2'),
        createEdge('2', '3'),
        createEdge('3', '4', 'yes'),
        createEdge('4', '5'),
        createEdge('5', '3'),
        createEdge('3', '6', 'no'),
      ];

      const code = generatePythonCode(nodes, edges);
      const expected = `i = 3\nwhile (i > 0):\n  x = int(input("Enter the value of 'x' by keyboard"))\n  i = (i - 1)`;
      expect(cleanCode(code)).toBe(expected);
    });

    it('should handle loops with complex nested conditions', () => {
      const i = varInt('i');
      const j = varInt('j');
      const flag = new Variable('flag-id', 'boolean', 'flag', 'n1');
      const nodes: FlowNode[] = [
        createNode('1', 'Start'),
        createNode('2', 'AssignVariable', { expression: new Expression(i, [createLiteralEl(10)]).toObject() }),
        createNode('3', 'Conditional', { expression: new Expression([createVarEl(i)], [createLiteralEl(0)], '>').toObject() }),
        createNode('4', 'Conditional', { expression: new Expression([createVarEl(flag)], [createLiteralEl(true)], '==').toObject() }),
        createNode('5', 'Conditional', { expression: new Expression([createVarEl(i)], [createLiteralEl(5)], '>').toObject() }),
        createNode('6', 'AssignVariable', { expression: new Expression(j, [createLiteralEl(1)]).toObject() }),
        createNode('7', 'AssignVariable', { expression: new Expression(j, [createLiteralEl(2)]).toObject() }),
        createNode('8', 'AssignVariable', { expression: new Expression(i, [createVarEl(i), createOpEl('-'), createLiteralEl(1)]).toObject() }),
        createNode('9', 'End'),
      ];
      const edges: Edge[] = [
        createEdge('1', '2'), createEdge('2', '3'),
        createEdge('3', '4', 'yes'), createEdge('3', '9', 'no'),
        createEdge('4', '5', 'yes'), createEdge('4', '8', 'no'),
        createEdge('5', '6', 'yes'), createEdge('5', '7', 'no'),
        createEdge('6', '8'), createEdge('7', '8'),
        createEdge('8', '3'),
      ];

      const code = generatePythonCode(nodes, edges);
      const expected = `i = 10\nwhile (i > 0):\n  if (flag == True):\n    if (i > 5):\n      j = 1\n    else:\n      j = 2\n    i = (i - 1)\n  else:\n    i = (i - 1)`;
      expect(cleanCode(code)).toBe(expected);
    });

    it('should handle infinite loop with complex break conditions', () => {
      // MARKED -> shoul break and somewhat irrelevant

      const counter = varInt('counter');
      const max_iter = varInt('max_iter');
      const nodes: FlowNode[] = [
        createNode('1', 'Start'),
        createNode('2', 'AssignVariable', { expression: new Expression(counter, [createLiteralEl(0)]).toObject() }),
        createNode('3', 'AssignVariable', { expression: new Expression(max_iter, [createLiteralEl(100)]).toObject() }),
        createNode('4', 'AssignVariable', { expression: new Expression(counter, [createVarEl(counter), createOpEl('+'), createLiteralEl(1)]).toObject() }),
        createNode('5', 'Conditional', { expression: new Expression([createVarEl(counter)], [createVarEl(max_iter)], '>=').toObject() }),
        createNode('6', 'End'),
      ];
      const edges: Edge[] = [
        createEdge('1', '2'), createEdge('2', '3'), createEdge('3', '4'),
        createEdge('4', '5'),
        createEdge('5', '6', 'yes'), // break
        createEdge('5', '4', 'no'), // continue loop
      ];

      const code = generatePythonCode(nodes, edges);
      const expected = `counter = 0\nmax_iter = 100\nwhile True:\n  counter = (counter + 1)\n  if (counter >= max_iter):\n    break`;
      expect(cleanCode(code)).toBe(expected);
    });

    it('should handle triple nested loops', () => {
      const i = varInt('i');
      const j = varInt('j');
      const k = varInt('k');
      const nodes: FlowNode[] = [
        createNode('1', 'Start'),
        createNode('2', 'AssignVariable', { expression: new Expression(i, [createLiteralEl(2)]).toObject() }),
        createNode('3', 'Conditional', { expression: new Expression([createVarEl(i)], [createLiteralEl(0)], '>').toObject() }),
        createNode('4', 'AssignVariable', { expression: new Expression(j, [createLiteralEl(2)]).toObject() }),
        createNode('5', 'Conditional', { expression: new Expression([createVarEl(j)], [createLiteralEl(0)], '>').toObject() }),
        createNode('6', 'AssignVariable', { expression: new Expression(k, [createLiteralEl(2)]).toObject() }),
        createNode('7', 'Conditional', { expression: new Expression([createVarEl(k)], [createLiteralEl(0)], '>').toObject() }),
        createNode('8', 'AssignVariable', { expression: new Expression(k, [createVarEl(k), createOpEl('-'), createLiteralEl(1)]).toObject() }),
        createNode('9', 'AssignVariable', { expression: new Expression(j, [createVarEl(j), createOpEl('-'), createLiteralEl(1)]).toObject() }),
        createNode('10', 'AssignVariable', { expression: new Expression(i, [createVarEl(i), createOpEl('-'), createLiteralEl(1)]).toObject() }),
        createNode('11', 'End'),
      ];
      const edges: Edge[] = [
        createEdge('1', '2'), createEdge('2', '3'),
        createEdge('3', '4', 'yes'), createEdge('3', '11', 'no'),
        createEdge('4', '5'),
        createEdge('5', '6', 'yes'), createEdge('5', '10', 'no'),
        createEdge('6', '7'),
        createEdge('7', '8', 'yes'), createEdge('7', '9', 'no'),
        createEdge('8', '7'), // innermost loop
        createEdge('9', '5'), // middle loop
        createEdge('10', '3'), // outer loop
      ];

      const code = generatePythonCode(nodes, edges);
      const expected = `i = 2\nwhile (i > 0):\n  j = 2\n  while (j > 0):\n    k = 2\n    while (k > 0):\n      k = (k - 1)\n    j = (j - 1)\n  i = (i - 1)`;
      expect(cleanCode(code)).toBe(expected);
    });

    it('should handle loop with multiple exit conditions', () => {
      // MARKED -> should have breaks

      const x = varInt('x');
      const y = varInt('y');
      const nodes: FlowNode[] = [
        createNode('1', 'Start'),
        createNode('2', 'AssignVariable', { expression: new Expression(x, [createLiteralEl(10)]).toObject() }),
        createNode('3', 'AssignVariable', { expression: new Expression(y, [createLiteralEl(5)]).toObject() }),
        createNode('4', 'AssignVariable', { expression: new Expression(x, [createVarEl(x), createOpEl('-'), createLiteralEl(1)]).toObject() }),
        createNode('5', 'AssignVariable', { expression: new Expression(y, [createVarEl(y), createOpEl('-'), createLiteralEl(1)]).toObject() }),
        createNode('6', 'Conditional', { expression: new Expression([createVarEl(x)], [createLiteralEl(0)], '<=').toObject() }),
        createNode('7', 'Conditional', { expression: new Expression([createVarEl(y)], [createLiteralEl(0)], '<=').toObject() }),
        createNode('8', 'End'),
      ];
      const edges: Edge[] = [
        createEdge('1', '2'), createEdge('2', '3'), createEdge('3', '4'),
        createEdge('4', '5'), createEdge('5', '6'),
        createEdge('6', '8', 'yes'), // exit condition 1
        createEdge('6', '7', 'no'),
        createEdge('7', '8', 'yes'), // exit condition 2
        createEdge('7', '4', 'no'), // continue loop
      ];

      const code = generatePythonCode(nodes, edges);
      const expected = `x = 10\ny = 5\nwhile True:\n  x = (x - 1)\n  y = (y - 1)\n  if (x <= 0):\n    break\n  else:\n    if (y <= 0):\n      break`;
      expect(cleanCode(code)).toBe(expected);
    });

    it('should handle loop with variable declarations inside', () => {
      // MARKED -> irrelevant?

      const i = varInt('i');
      const temp = varInt('temp');
      const nodes: FlowNode[] = [
        createNode('1', 'Start'),
        createNode('2', 'AssignVariable', { expression: new Expression(i, [createLiteralEl(5)]).toObject() }),
        createNode('3', 'Conditional', { expression: new Expression([createVarEl(i)], [createLiteralEl(0)], '>').toObject() }),
        createNode('4', 'DeclareVariable', { variable: temp.toObject() }),
        createNode('5', 'AssignVariable', { expression: new Expression(temp, [createVarEl(i), createOpEl('*'), createLiteralEl(2)]).toObject() }),
        createNode('6', 'Output', { expression: new Expression(undefined, [createVarEl(temp)]).toObject() }),
        createNode('7', 'AssignVariable', { expression: new Expression(i, [createVarEl(i), createOpEl('-'), createLiteralEl(1)]).toObject() }),
        createNode('8', 'End'),
      ];
      const edges: Edge[] = [
        createEdge('1', '2'), createEdge('2', '3'),
        createEdge('3', '4', 'yes'), createEdge('3', '8', 'no'),
        createEdge('4', '5'), createEdge('5', '6'), createEdge('6', '7'),
        createEdge('7', '3'),
      ];

      const code = generatePythonCode(nodes, edges);
      const expected = `i = 5\nwhile (i > 0):\n  temp = (i * 2)\n  print(temp)\n  i = (i - 1)`;
      expect(cleanCode(code)).toBe(expected);
    });

    it('should handle early exit with complex condition combinations', () => {
      // MARKED -> should have breaks

      const a = varInt('a');
      const b = varInt('b');
      const c = varInt('c');
      const nodes: FlowNode[] = [
        createNode('1', 'Start'),
        createNode('2', 'AssignVariable', { expression: new Expression(a, [createLiteralEl(10)]).toObject() }),
        createNode('3', 'AssignVariable', { expression: new Expression(b, [createLiteralEl(5)]).toObject() }),
        createNode('4', 'AssignVariable', { expression: new Expression(c, [createLiteralEl(3)]).toObject() }),
        createNode('5', 'Conditional', { 
          expression: new Expression(
            [createOpEl('('), createVarEl(a), createOpEl('>'), createLiteralEl(0), createOpEl(')'), createOpEl('&&'), createOpEl('('), createVarEl(b), createOpEl('>'), createLiteralEl(0), createOpEl(')')], 
            [createLiteralEl(true)], 
            '=='
          ).toObject() 
        }),
        createNode('6', 'AssignVariable', { expression: new Expression(a, [createVarEl(a), createOpEl('-'), createLiteralEl(1)]).toObject() }),
        createNode('7', 'AssignVariable', { expression: new Expression(b, [createVarEl(b), createOpEl('-'), createLiteralEl(1)]).toObject() }),
        createNode('8', 'Conditional', { 
          expression: new Expression(
            [createOpEl('('), createVarEl(a), createOpEl('=='), createVarEl(b), createOpEl(')'), createOpEl('||'), createOpEl('('), createVarEl(c), createOpEl('=='), createLiteralEl(0), createOpEl(')')], 
            [createLiteralEl(true)], 
            '=='
          ).toObject() 
        }),
        createNode('9', 'End'),
      ];
      const edges: Edge[] = [
        createEdge('1', '2'), createEdge('2', '3'), createEdge('3', '4'), createEdge('4', '5'),
        createEdge('5', '6', 'yes'), createEdge('5', '9', 'no'),
        createEdge('6', '7'), createEdge('7', '8'),
        createEdge('8', '9', 'yes'), // early exit
        createEdge('8', '5', 'no'), // continue loop
      ];

      const code = generatePythonCode(nodes, edges);
      const expected = `a = 10\nb = 5\nc = 3\nwhile (((a > 0) and (b > 0)) == True):\n  a = (a - 1)\n  b = (b - 1)\n  if (((a == b) or (c == 0)) == True):\n    break`;
      expect(cleanCode(code)).toBe(expected);
    });

    it('should handle loops with mathematical operations and comparisons', () => {
      // MARKED -> irrelevant?

      const sum = varInt('sum');
      const count = varInt('count');
      const nodes: FlowNode[] = [
        createNode('1', 'Start'),
        createNode('2', 'AssignVariable', { expression: new Expression(sum, [createLiteralEl(0)]).toObject() }),
        createNode('3', 'AssignVariable', { expression: new Expression(count, [createLiteralEl(1)]).toObject() }),
        createNode('4', 'Conditional', { expression: new Expression([createVarEl(sum)], [createLiteralEl(100)], '<').toObject() }),
        createNode('5', 'AssignVariable', { 
          expression: new Expression(sum, [
            createVarEl(sum), createOpEl('+'), 
            createOpEl('('), createVarEl(count), createOpEl('*'), createVarEl(count), createOpEl(')')
          ]).toObject() 
        }),
        createNode('6', 'AssignVariable', { expression: new Expression(count, [createVarEl(count), createOpEl('+'), createLiteralEl(1)]).toObject() }),
        createNode('7', 'End'),
      ];
      const edges: Edge[] = [
        createEdge('1', '2'), createEdge('2', '3'), createEdge('3', '4'),
        createEdge('4', '5', 'yes'), createEdge('4', '7', 'no'),
        createEdge('5', '6'), createEdge('6', '4'),
      ];

      const code = generatePythonCode(nodes, edges);
      const expected = `sum = 0\ncount = 1\nwhile (sum < 100):\n  sum = (sum + (count * count))\n  count = (count + 1)`;
      expect(cleanCode(code)).toBe(expected);
    });

    it('should handle while True with nested if-elif-else pattern', () => {
      // MARK -> start
      const x = varInt('x');
      const y = varInt('y');
      const z = varInt('z');
      const nodes: FlowNode[] = [
        createNode('1', 'Start'),
        createNode('2', 'Input', { variable: x.toObject() }),
        createNode('3', 'Conditional', { expression: new Expression([createVarEl(x)], [createLiteralEl(1)], '==').toObject() }),
        createNode('4', 'AssignVariable', { expression: new Expression(y, [createLiteralEl(10)]).toObject() }),
        createNode('5', 'Conditional', { expression: new Expression([createVarEl(x)], [createLiteralEl(2)], '==').toObject() }),
        createNode('6', 'AssignVariable', { expression: new Expression(y, [createLiteralEl(20)]).toObject() }),
        createNode('7', 'AssignVariable', { expression: new Expression(y, [createLiteralEl(0)]).toObject() }),
        createNode('8', 'Output', { expression: new Expression(undefined, [createVarEl(y)]).toObject() }),
      ];
      const edges: Edge[] = [
        createEdge('1', '2'),
        createEdge('2', '3'),
        createEdge('3', '4', 'yes'),
        createEdge('3', '5', 'no'),
        createEdge('4', '8'),
        createEdge('5', '6', 'yes'),
        createEdge('5', '7', 'no'),
        createEdge('6', '8'),
        createEdge('7', '8'),
        createEdge('8', '2'), // loop back
      ];

      const code = generatePythonCode(nodes, edges);
      const expected = `while True:\n  x = int(input("Enter the value of 'x' by keyboard"))\n  if (x == 1):\n    y = 10\n    print(y)\n  else:\n    if (x == 2):\n      y = 20\n    else:\n      y = 0\n    print(y)`;
      expect(cleanCode(code)).toBe(expected);
    });

    it('should handle a loop with a break in one branch and normal execution in the other', () => {
      const i = varInt('i');
      const nodes: FlowNode[] = [
        createNode('1', 'Start'),
        createNode('2', 'AssignVariable', { expression: new Expression(i, [createLiteralEl(10)]).toObject() }),
        createNode('3', 'Conditional', { expression: new Expression([createVarEl(i)], [createLiteralEl(0)], '>').toObject() }), // while i > 0
        createNode('4', 'Conditional', { expression: new Expression([createVarEl(i)], [createLiteralEl(5)], '==').toObject() }), // if i == 5
        createNode('5', 'Output', { expression: new Expression(undefined, [createVarEl(i)]).toObject() }),
        createNode('6', 'AssignVariable', { expression: new Expression(i, [createVarEl(i), createOpEl('-'), createLiteralEl(1)]).toObject() }),
        createNode('7', 'End'), // break target
      ];
      const edges: Edge[] = [
        createEdge('1', '2'),
        createEdge('2', '3'),
        createEdge('3', '4', 'yes'), // enter loop
        createEdge('3', '7', 'no'),  // exit loop
        createEdge('4', '7', 'yes'), // break
        createEdge('4', '5', 'no'),  // else branch
        createEdge('5', '6'),
        createEdge('6', '3'),        // loop back
      ];

      const code = generatePythonCode(nodes, edges);
      const expected = `i = 10\nwhile (i > 0):\n  if (i == 5):\n    break\n  else:\n    print(i)\n    i = (i - 1)`;
      expect(cleanCode(code)).toBe(expected);
    });

    it('should handle a break from a nested conditional inside a loop', () => {
      const i = varInt('i');
      const condition = new Variable('condition', 'boolean', 'condition', 'node-1');
      const nodes: FlowNode[] = [
        createNode('1', 'Start'),
        createNode('2', 'AssignVariable', { expression: new Expression(i, [createLiteralEl(10)]).toObject() }),
        createNode('3', 'Conditional', { expression: new Expression([createVarEl(i)], [createLiteralEl(0)], '>').toObject() }), // while
        createNode('4', 'Conditional', { expression: new Expression([createVarEl(condition)], [createLiteralEl(true)], '==').toObject() }), // outer if
        createNode('5', 'Conditional', { expression: new Expression([createVarEl(i)], [createLiteralEl(3)], '<').toObject() }), // inner if
        createNode('6', 'AssignVariable', { expression: new Expression(i, [createVarEl(i), createOpEl('-'), createLiteralEl(1)]).toObject() }),
        createNode('7', 'End'), // break target
      ];
      const edges: Edge[] = [
        createEdge('1', '2'),
        createEdge('2', '3'),
        createEdge('3', '4', 'yes'), // enter loop
        createEdge('3', '7', 'no'), // exit loop
        createEdge('4', '5', 'yes'), // outer if-yes
        createEdge('4', '6', 'no'),  // outer if-no
        createEdge('5', '7', 'yes'), // inner if-yes -> break
        createEdge('5', '6', 'no'),  // inner if-no
        createEdge('6', '3'),        // loop back
      ];

      const code = generatePythonCode(nodes, edges);
      const expected = `i = 10\nwhile (i > 0):\n  if (condition == True):\n    if (i < 3):\n      break\n    else:\n      i = (i - 1)\n  else:\n    i = (i - 1)`;
      expect(cleanCode(code)).toBe(expected);
    });

    it('should handle a loop with multiple break conditions from an if-elif structure', () => {
      const x = varInt('x');
      const nodes: FlowNode[] = [
        createNode('1', 'Start'),
        createNode('2', 'AssignVariable', { expression: new Expression(x, [createLiteralEl(0)]).toObject() }),
        createNode('3', 'Conditional', { expression: new Expression([createVarEl(x)], [createLiteralEl(10)], '<').toObject() }), // while
        createNode('4', 'AssignVariable', { expression: new Expression(x, [createVarEl(x), createOpEl('+'), createLiteralEl(1)]).toObject() }),
        createNode('5', 'Conditional', { expression: new Expression([createVarEl(x)], [createLiteralEl(5)], '==').toObject() }), // if x == 5
        createNode('6', 'Conditional', { expression: new Expression([createVarEl(x)], [createLiteralEl(8)], '==').toObject() }), // if x == 8
        createNode('7', 'End'),
      ];
      const edges: Edge[] = [
        createEdge('1', '2'),
        createEdge('2', '3'),
        createEdge('3', '4', 'yes'), // enter loop
        createEdge('3', '7', 'no'),  // exit loop
        createEdge('4', '5'),
        createEdge('5', '7', 'yes'), // break 1
        createEdge('5', '6', 'no'),
        createEdge('6', '7', 'yes'), // break 2
        createEdge('6', '3', 'no'),  // continue loop
      ];
      const code = generatePythonCode(nodes, edges);
      const expected = `x = 0\nwhile (x < 10):\n  x = (x + 1)\n  if (x == 5):\n    break\n  else:\n    if (x == 8):\n      break`;
      expect(cleanCode(code)).toBe(expected);
    });
  });

  describe('Unsupported or Malformed Diagrams', () => {
    it('should return an error for a diagram with no start node', () => {
        const nodes: FlowNode[] = [createNode('1', 'End')];
        const code = generatePythonCode(nodes, []);
        expect(code).toContain('No Start node found');
    });

    it('should handle malformed expressions gracefully', () => {
      const x = varInt('x');
      const nodes: FlowNode[] = [
        createNode('1', 'Start'),
        createNode('2', 'AssignVariable', {
          expression: new Expression(x, [createOpEl('+')]).toObject(), // Invalid expression
        }),
        createNode('3', 'End'),
      ];
      const edges: Edge[] = [createEdge('1', '2'), createEdge('2', '3')];
      const code = generatePythonCode(nodes, edges);
      expect(code).toContain('Unsupported Block ID');
    });
  });
}); 