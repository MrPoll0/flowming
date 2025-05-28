import { FlowNode } from '../components/Flow/FlowTypes';
import { Edge } from '@xyflow/react';
import {
  Program, Statement, Expression as PyExpression, AssignmentStatement, IfStatement, WhileStatement, BlockStatement, Identifier, Literal, BinaryExpression, PrintStatement, UnsupportedNode, CallExpression, ASTNode
} from '../models/pythonAST';
import { Expression as DiagramExpression, ExpressionElement, Variable, IOperator, IExpression as DiagramIExpression } from '../models';

// Helper to find a node by ID
const findNodeById = (nodes: FlowNode[], id: string): FlowNode | undefined => nodes.find(n => n.id === id);

// Helper to find outgoing edges from a node
const findOutgoingEdges = (edges: Edge[], nodeId: string): Edge[] => edges.filter(edge => edge.source === nodeId);

// Helper to convert Diagram ExpressionElement[] to Python AST Expression
// This is a simplified version and needs to handle operator precedence and parentheses correctly if expressions get complex.
// For now, it will handle simple binary operations.
const convertDiagramExpressionToAST = (elements: ExpressionElement[], diagramNodeId: string): PyExpression => {
  const unsupportedNode = (reason: string): UnsupportedNode =>
    ({ type: 'UnsupportedNode', reason, diagramNodeId } as UnsupportedNode);

  let idx = 0;
  const tokens = elements;
  const peek = (): ExpressionElement | undefined => tokens[idx];
  const consume = (): ExpressionElement | undefined => tokens[idx++];

  const parseExpression = (): PyExpression => parseLogicalOr();

  const parsePrimary = (): PyExpression => {
    const token = peek();
    if (!token) return { type: 'Literal', value: null, diagramNodeId } as Literal;
    if (token.isOperator() && token.value === '(') {
      consume();
      const expr = parseExpression();
      const next = peek();
      if (next && next.isOperator() && next.value === ')') {
        consume();
      } else {
        return unsupportedNode('Missing closing parenthesis');
      }
      return expr;
    }
    if (token.isVariable() && token.variable) {
      consume();
      return { type: 'Identifier', name: token.variable.name, diagramNodeId } as Identifier;
    }
    if (token.isLiteral()) {
      consume();
      const num = parseFloat(token.value);
      return { type: 'Literal', value: isNaN(num) ? token.value : num, raw: token.value, diagramNodeId } as Literal;
    }
    consume();
    return unsupportedNode(`Unexpected token: ${token.value}`);
  };

  const parseUnary = (): PyExpression => {
    const token = peek();
    if (token && token.isOperator() && (token.value === '!' || token.value === '-')) {
      const op = token.value;
      consume();
      const expr = parseUnary();
      if (op === '!') {
        return {
          type: 'BinaryExpression',
          operator: '==',
          left: expr,
          right: { type: 'Literal', value: false, raw: 'False', diagramNodeId } as Literal,
          diagramNodeId
        } as BinaryExpression;
      } else {
        return {
          type: 'BinaryExpression',
          operator: '-',
          left: { type: 'Literal', value: 0, raw: '0', diagramNodeId } as Literal,
          right: expr,
          diagramNodeId
        } as BinaryExpression;
      }
    }
    return parsePrimary();
  };

  const parseBinary = (nextFn: () => PyExpression, ops: string[]): PyExpression => {
    let node = nextFn();
    while (true) {
      const token = peek();
      if (token && token.isOperator() && ops.includes(token.value)) {
        const op = consume()!.value as IOperator;
        const right = nextFn();
        node = { type: 'BinaryExpression', operator: op, left: node, right, diagramNodeId } as BinaryExpression;
      } else break;
    }
    return node;
  };

  const parseMultiplicative = () => parseBinary(parseUnary, ['*','/','%']);
  const parseAdditive       = () => parseBinary(parseMultiplicative, ['+','-']);
  const parseRelational     = () => parseBinary(parseAdditive, ['>','<','>=','<=']);
  const parseEquality       = () => parseBinary(parseRelational, ['==','!=']);
  const parseLogicalAnd     = () => parseBinary(parseEquality, ['&&']);
  const parseLogicalOr      = () => parseBinary(parseLogicalAnd, ['||']);

  try {
    if (elements.length === 0) {
      return { type: 'Literal', value: null, diagramNodeId } as Literal;
    }
    const result = parseExpression();
    if (idx < tokens.length) {
      return unsupportedNode(`Unexpected token: ${tokens[idx].value}`);
    }
    return result;
  } catch (err) {
    return unsupportedNode(`Expression parse error: ${(err as Error).message}`);
  }
};

/**
 * Checks if there is a path from a start node to a target node in the graph (used to detect loops).
 */
const isNodeReachable = (startId: string, targetId: string, edges: Edge[]): boolean => {
  const visited = new Set<string>();
  const stack = [startId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === targetId) {
      return true;
    }
    visited.add(current);
    for (const edge of edges) {
      if (edge.source === current && edge.target != null && !visited.has(edge.target)) {
        stack.push(edge.target);
      }
    }
  }
  return false;
};

export const generatePythonAST = (nodes: FlowNode[], edges: Edge[]): Program => {
  const program: Program = { type: 'Program', body: [] };
  const startNode = nodes.find(node => node.type === 'Start');

  if (!startNode) {
    console.warn('No Start node found. Cannot generate code.');
    program.body.push({ type: 'UnsupportedNode', reason: 'No Start node found' } as UnsupportedNode);
    return program;
  }

  const visitedNodes = new Set<string>(); // To handle loops and prevent infinite recursion

  // Recursive function to process nodes
  const processNode = (nodeId: string, skipNext: boolean = false): Statement[] => {
    if (visitedNodes.has(nodeId)) {
      // Handle loops: for now, just add a comment or unsupported node
      // In Python, this might translate to a 'continue' or 'break' in specific contexts,
      // or simply stopping the generation for that path if it's an infinite loop.
      return [{ 
        type: 'UnsupportedNode', 
        reason: `Loop detected or node already visited: ${nodeId}`,
        diagramNodeId: nodeId
      } as UnsupportedNode];
    }
    visitedNodes.add(nodeId);

    const node = findNodeById(nodes, nodeId);
    if (!node) return [];

    let currentStatements: Statement[] = [];

    switch (node.type) {
      case 'Start':
        // Typically, a Start node itself doesn't translate to a Python statement,
        // but it might initialize something or be a comment.
        // For now, we can add a comment.
        // Or, if we wrap the whole thing in a main function:
        // statements.push({ type: 'FunctionDeclaration', name: {type: 'Identifier', name: 'main'}, params: [], body: {type: 'BlockStatement', body: []} });
        break; // Handled by initial setup, just proceed to next

      case 'DeclareVariable':
        // Python is dynamically typed. Declarations like "int x" aren't strictly needed.
        // We could add a comment with type information if desired.
        // const vars = (node.data.variables as Variable[]) || []; // Assuming data.variables exists
        // vars.forEach(v => {
        //   currentStatements.push({ type: 'CommentStatement', value: `Variable: ${v.name} (${v.type})`, diagramNodeId: node.id });
        // });
        // For now, let's treat it as a no-op in Python code generation unless variables are initialized here.
        // If variables are initialized (e.g. int x = 0), it would be an Assignment.
        // Based on DeclareVariable.tsx, it seems variables are just declared, not initialized.
        // We will rely on VariablesContext to get these, if needed elsewhere.
        break;

      case 'AssignVariable':
        if (node.data.expression) {
          const diagExpr = DiagramExpression.fromObject(node.data.expression as DiagramIExpression);
          if (diagExpr.leftSide instanceof Variable) {
            const target: Identifier = { type: 'Identifier', name: diagExpr.leftSide.name, diagramNodeId: node.id };
            const valueAst = convertDiagramExpressionToAST(diagExpr.rightSide, node.id);
            if (valueAst.type !== 'UnsupportedNode') {
              currentStatements.push({ type: 'AssignmentStatement', target, value: valueAst, diagramNodeId: node.id } as AssignmentStatement);
            } else {
              currentStatements.push(valueAst as UnsupportedNode);
            }
          } else {
            currentStatements.push({ type: 'UnsupportedNode', reason: 'AssignVariable left side is not a simple variable', diagramNodeId: node.id } as UnsupportedNode);
          }
        } else {
            currentStatements.push({ type: 'UnsupportedNode', reason: 'AssignVariable has no expression', diagramNodeId: node.id } as UnsupportedNode);
        }
        break;

      case 'Conditional':
        if (node.data.expression) {
          const diagCondExpr = DiagramExpression.fromObject(node.data.expression as DiagramIExpression);
          // Construct elements for conditional expression
          const conditionElements: ExpressionElement[] = [];
          if (Array.isArray(diagCondExpr.leftSide)) {
            conditionElements.push(...diagCondExpr.leftSide);
          }
          if (diagCondExpr.equality) {
            conditionElements.push(new ExpressionElement(diagCondExpr.equality, 'operator', diagCondExpr.equality));
          }
          conditionElements.push(...diagCondExpr.rightSide);
          const testAst = convertDiagramExpressionToAST(conditionElements, node.id);
          if (testAst.type !== 'UnsupportedNode') {
            const outgoing = findOutgoingEdges(edges, node.id);
            const trueEdge = outgoing.find(e => e.data?.conditionalLabel === 'Yes' || e.data?.conditionalLabel === 'True');
            const falseEdge = outgoing.find(e => e.data?.conditionalLabel === 'No' || e.data?.conditionalLabel === 'False');
            // Detect loops: if trueEdge path comes back to this conditional
            if (trueEdge?.target && isNodeReachable(trueEdge.target, node.id, edges)) {
              // Loop detected: build a single Python while, filtering nested loop markers
              const rawBody = processNode(trueEdge.target);
              const loopBody = rawBody.filter(stmt => !(stmt.type === 'UnsupportedNode' &&
                (stmt as UnsupportedNode).reason.includes('already visited')));
              const whileStmt: WhileStatement = {
                type: 'WhileStatement',
                test: testAst,
                body: { type: 'BlockStatement', body: loopBody },
                diagramNodeId: node.id
              } as WhileStatement;
              currentStatements.push(whileStmt);
              // Process exit (false) path
              if (falseEdge?.target) {
                currentStatements.push(...processNode(falseEdge.target));
              }
            } else {
              // Regular if statement
              const consequentBlock: Statement[] = [];
              const alternateBlock: Statement[] = [];
              if (trueEdge?.target) {
                consequentBlock.push(...processNode(trueEdge.target));
              }
              if (falseEdge?.target) {
                alternateBlock.push(...processNode(falseEdge.target));
              }
              const ifStmt: IfStatement = {
                type: 'IfStatement',
                test: testAst,
                consequent: { type: 'BlockStatement', body: consequentBlock },
                diagramNodeId: node.id
              };
              if (alternateBlock.length > 0) {
                ifStmt.alternate = { type: 'BlockStatement', body: alternateBlock };
              }
              currentStatements.push(ifStmt);
            }
          } else {
            currentStatements.push(testAst as UnsupportedNode);
          }
        } else {
          currentStatements.push({ type: 'UnsupportedNode', reason: 'Conditional has no expression', diagramNodeId: node.id } as UnsupportedNode);
        }
        return currentStatements;

      case 'Output':
        if (node.data.expression) {
          const diagOutputExpr = DiagramExpression.fromObject(node.data.expression as DiagramIExpression);
          // Output node's expression seems to be stored entirely in rightSide in the Expression model
          const argsAst = convertDiagramExpressionToAST(diagOutputExpr.rightSide, node.id);
          if (argsAst.type !== 'UnsupportedNode') {
            currentStatements.push({ type: 'PrintStatement', arguments: [argsAst], diagramNodeId: node.id } as PrintStatement);
          } else {
             currentStatements.push(argsAst as UnsupportedNode);
          }
        } else {
            // Output node with no expression could be print() or print("")
            currentStatements.push({ type: 'PrintStatement', arguments: [], diagramNodeId: node.id } as PrintStatement);
        }
        break;

      case 'End':
        // End node typically signifies termination. Could be a 'return' if inside a function.
        // For a simple script, it might not translate to any specific code.
        // currentStatements.push({ type: 'ReturnStatement', diagramNodeId: node.id }); // If we wrap in main()
        visitedNodes.delete(nodeId); // Allow re-visiting End node if multiple paths lead to it.
        return currentStatements; // Stop processing this path

      case 'Input':
        if (node.data.variable) {
          const inputVar = node.data.variable as Variable;
          const target: Identifier = { type: 'Identifier', name: inputVar.name, diagramNodeId: node.id };
          const baseCall: CallExpression = {
            type: 'CallExpression',
            callee: { type: 'Identifier', name: 'input', diagramNodeId: node.id },
            arguments: [],
            diagramNodeId: node.id
          };
          let valueAst: PyExpression = baseCall;
          if (inputVar.type === 'integer') {
            valueAst = ({
              type: 'CallExpression',
              callee: { type: 'Identifier', name: 'int', diagramNodeId: node.id },
              arguments: [baseCall],
              diagramNodeId: node.id
            } as CallExpression);
          } else if (inputVar.type === 'float') {
            valueAst = ({
              type: 'CallExpression',
              callee: { type: 'Identifier', name: 'float', diagramNodeId: node.id },
              arguments: [baseCall],
              diagramNodeId: node.id
            } as CallExpression);
          } else if (inputVar.type === 'boolean') {
            valueAst = {
              type: 'BinaryExpression',
              operator: '==',
              left: baseCall,
              right: { type: 'Literal', value: true, raw: 'True', diagramNodeId: node.id },
              diagramNodeId: node.id
            } as BinaryExpression;
          }
          currentStatements.push({ type: 'AssignmentStatement', target, value: valueAst, diagramNodeId: node.id } as AssignmentStatement);
        } else {
          currentStatements.push({ type: 'UnsupportedNode', reason: 'Input node has no target variable defined', diagramNodeId: node.id } as UnsupportedNode);
        }
        break;

      default:
        currentStatements.push({ 
            type: 'UnsupportedNode', 
            originalNodeType: node.type, 
            reason: `Node type '${node.type}' not supported for Python generation.`, 
            diagramNodeId: node.id 
        } as UnsupportedNode);
    }

    // Find next node in sequence (for non-branching nodes)
    const outgoingEdges = findOutgoingEdges(edges, nodeId);
    if (!skipNext && node.type !== 'Conditional' && node.type !== 'End' && outgoingEdges.length > 0) {
      const nextNodeId = outgoingEdges[0].target;
      if (nextNodeId) {
        if (!visitedNodes.has(nextNodeId)) {
          currentStatements.push(...processNode(nextNodeId));
        } else {
          // Infinite loop detected: walk the simple cycle and generate a while True loop including all nodes
          currentStatements.push({
            type: 'UnsupportedNode',
            reason: 'Unsupported loop structure (non-conditional loops are not supported reliably).',
            diagramNodeId: nodeId
          } as UnsupportedNode);
          /*const entry = nextNodeId;
          let curr = entry;
          const loopBody: Statement[] = [];
          do {
            visitedNodes.delete(curr);
            // Collect only this node's own statements
            loopBody.push(...processNode(curr, true));
            visitedNodes.add(curr);
            const loopEdges = findOutgoingEdges(edges, curr);
            if (loopEdges.length === 0 || !loopEdges[0].target) break;
            curr = loopEdges[0].target;
          } while (curr !== entry);
          const trueTest: Literal = { type: 'Literal', value: true, raw: 'True', diagramNodeId: node.id };
          const whileStmt: WhileStatement = {
            type: 'WhileStatement',
            test: trueTest,
            body: { type: 'BlockStatement', body: loopBody },
            diagramNodeId: node.id
          } as WhileStatement;
          currentStatements.push(whileStmt);*/
        }
      }
    }
    
    // Clean up recursion stack
    visitedNodes.delete(nodeId);
    return currentStatements;
  };
  
  // Start processing from the Start node's first successor
  const initialOutgoingEdges = findOutgoingEdges(edges, startNode.id);
  if (initialOutgoingEdges.length > 0 && initialOutgoingEdges[0].target) {
    program.body = processNode(initialOutgoingEdges[0].target);
  } else if (nodes.length === 1 && startNode) {
    // Special case: only a Start node exists
    program.body.push({ type: 'UnsupportedNode', reason: 'Only Start node present. Diagram is empty.', diagramNodeId: startNode.id } as UnsupportedNode);
  }

  return program;
};

const INDENT_SPACE = '  '; // Two spaces for indentation

const generateCodeFromASTNode = (astNode: ASTNode, indentLevel = 0): string => {
  const indent = INDENT_SPACE.repeat(indentLevel);
  let code = '';

  // Add a comment with the diagramNodeId for linking, if available
  if (astNode.diagramNodeId) {
    code += `${indent}# Block ID: ${astNode.diagramNodeId}\n`;
  }

  switch (astNode.type) {
    case 'Program':
      return (astNode as Program).body.map(stmt => generateCodeFromASTNode(stmt, indentLevel)).join('\n');
    
    case 'AssignmentStatement':
      const assign = astNode as AssignmentStatement;
      code += `${indent}${generateCodeFromASTNode(assign.target)} = ${generateCodeFromASTNode(assign.value)}`;
      return code;
    
    case 'WhileStatement':
      const whileStmt = astNode as WhileStatement;
      code += `${indent}while ${generateCodeFromASTNode(whileStmt.test)}:` + '\n';
      code += generateCodeFromASTNode(whileStmt.body, indentLevel + 1);
      return code;

    case 'IfStatement':
      const ifStmt = astNode as IfStatement;
      code += `${indent}if ${generateCodeFromASTNode(ifStmt.test)}:` + '\n';
      code += generateCodeFromASTNode(ifStmt.consequent, indentLevel + 1);
      if (ifStmt.alternate) {
        code += `\n${indent}else:` + '\n';
        code += generateCodeFromASTNode(ifStmt.alternate, indentLevel + 1);
      }
      return code;

    case 'BlockStatement':
      const block = astNode as BlockStatement;
      if (block.body.length === 0) {
        return `${indent}${INDENT_SPACE}pass\n`; // Python requires a statement in a block
      }
      return block.body.map(stmt => generateCodeFromASTNode(stmt, indentLevel)).join('\n') + (block.body.length > 0 ? '\n' : '');

    case 'PrintStatement':
      const printStmt = astNode as PrintStatement;
      const args = printStmt.arguments.map(arg => generateCodeFromASTNode(arg)).join(', ');
      code += `${indent}print(${args})`;
      return code;

    case 'Identifier':
      return (astNode as Identifier).name;

    case 'Literal':
      const literal = astNode as Literal;
      if (typeof literal.value === 'string') {
        return `"${literal.value.replace(/"/g, '\\"')}"`;
      } else if (literal.value === null) {
        return 'None';
      }
      return String(literal.value);

    case 'BinaryExpression':
      const binExpr = astNode as BinaryExpression;
      let op = binExpr.operator;
      if (op === '&&') op = 'and';
      if (op === '||') op = 'or';
      return `(${generateCodeFromASTNode(binExpr.left)} ${op} ${generateCodeFromASTNode(binExpr.right)})`;

    case 'CallExpression':
      const callExpr = astNode as CallExpression;
      const callArgs = callExpr.arguments.map(arg => generateCodeFromASTNode(arg)).join(', ');
      return `${generateCodeFromASTNode(callExpr.callee)}(${callArgs})`;

    case 'UnsupportedNode':
      const unsupported = astNode as UnsupportedNode;
      let comment = `${indent}# Unsupported Block ID: ${unsupported.diagramNodeId || 'N/A'} - ${unsupported.reason}`;
      if ((unsupported as any).originalNodeType) {
        comment += ` (Original Type: ${(unsupported as any).originalNodeType})`;
      }
      return comment;
      
    case 'ExpressionStatement':
      return `${indent}${generateCodeFromASTNode((astNode as any).expression)}`;

    default:
      return `${indent}# AST Node type ${(astNode as any).type} not implemented for code generation.`;
  }
};

export const generatePythonCode = (nodes: FlowNode[], edges: Edge[]): string => {
  const ast = generatePythonAST(nodes, edges);
  return generateCodeFromASTNode(ast).trim();
};
