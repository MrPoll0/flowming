import { FlowNode } from '../components/Flow/FlowTypes';
import { Edge } from '@xyflow/react';
import {
  Program, Statement, Expression as PyExpression, AssignmentStatement, IfStatement, WhileStatement, BlockStatement, Identifier, Literal, BinaryExpression, PrintStatement, UnsupportedNode, CallExpression, ASTNode
} from '../models/pythonAST';
import { Expression as DiagramExpression, ExpressionElement, Variable, IOperator, IExpression as DiagramIExpression } from '../models';

// Helper to convert Diagram ExpressionElement[] to Python AST Expression
// TODO: This is a simplified version and needs to handle operator precedence and parentheses correctly if expressions get complex.
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
      const lowerValue = token.value.toLowerCase();
      if (lowerValue === 'true') {
        return { type: 'Literal', value: true, raw: 'True', diagramNodeId } as Literal;
      }
      if (lowerValue === 'false') {
        return { type: 'Literal', value: false, raw: 'False', diagramNodeId } as Literal;
      }
      // Attempt to parse as a number, otherwise treat as a string literal
      const num = parseFloat(token.value);
      if (!isNaN(num)) {
        return { type: 'Literal', value: num, raw: token.value, diagramNodeId } as Literal;
      }
      // For string literals, the value should be the string itself, and raw should also be the string (or quoted version if necessary for Python)
      // Assuming string literals from the diagram are already appropriately formatted (e.g., not needing extra quotes for Python here, as generateCodeFromASTNode handles JSON.stringify)
      return { type: 'Literal', value: token.value, raw: JSON.stringify(token.value), diagramNodeId } as Literal; 
    }
    consume(); // Consume the unexpected token before reporting
    return unsupportedNode(`Unexpected token: ${token.value}`); // TODO: error handling (e.g. "test" True)
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

// Build a Control-Flow Graph (CFG) from nodes and edges
interface CFG {
  nodesMap: Map<string, FlowNode>;
  succMap: Map<string, Edge[]>;
  predMap: Map<string, Edge[]>;
  startId: string;
}

const buildCFG = (nodes: FlowNode[], edges: Edge[]): CFG => {
  // Create a map of nodes by their ID
  const nodesMap = new Map(nodes.map(n => [n.id, n] as [string, FlowNode]));
  const succMap = new Map<string, Edge[]>();
  const predMap = new Map<string, Edge[]>();

  // Initialize all nodes with empty succMap and predMap
  nodes.forEach(n => { succMap.set(n.id, []); predMap.set(n.id, []); });

  // Populate succMap and predMap based on edges
  edges.forEach(e => {
    succMap.get(e.source)?.push(e);
    if (e.target) predMap.get(e.target)?.push(e);
  });
  const start = nodes.find(n => n.type === 'Start');
  if (!start) {
    // If no Start node, return an empty CFG
    return { nodesMap, succMap, predMap, startId: '' };
  }
  return { nodesMap, succMap, predMap, startId: start.id };
};

// Compute dominators for each node via iterative algorithm
const computeDominators = (cfg: CFG): Map<string, Set<string>> => {
  const ids = Array.from(cfg.nodesMap.keys());
  const dom = new Map<string, Set<string>>();
  const all = new Set(ids);

  ids.forEach(id => dom.set(id, new Set(all)));
  dom.set(cfg.startId, new Set([cfg.startId]));
  
  let changed = true;
  while (changed) {
    changed = false;

    for (const id of ids) {
      // Skip start node
      if (id === cfg.startId) continue;

      const preds = cfg.predMap.get(id) || [];
      if (preds.length === 0) continue; // Skip nodes with no predecessors

      // Intersect dominators of predecessors
      let intersection = new Set<string>(dom.get(preds[0].source)!);
      preds.slice(1).forEach(p => {
        const pdom = dom.get(p.source)!;
        intersection = new Set([...intersection].filter(x => pdom.has(x)));
      });
      // A node always dominates itself
      intersection.add(id);

      // At this point, intersection is the set of nodes that dominate all predecessors of node id, so they dominate node id too
      // Update dominators if necessary and mark as changed
      const old = dom.get(id)!;
      if (old.size !== intersection.size || [...old].some(x => !intersection.has(x))) {
        dom.set(id, intersection);
        changed = true;
      }
    }
  }

  return dom;
};

// Detect all natural loops (back edges)
const findNaturalLoops = (cfg: CFG, dom: Map<string, Set<string>>): Map<string, Set<string>> => {
  const loops = new Map<string, Set<string>>();

  // Iterates over all the nodes (with its predecessors)
  cfg.predMap.forEach((preds, header) => {
    // For each predecessor of the current node (header)
    preds.forEach(e => {
      const node = e.source;
      // We have edge node -> header

      // If the current node (header) dominates the predecessor (the source of the predecessor edge; node), it means that every path from Start to node must pass
      // through header, so it's a natural loop (back edge); the incoming edge is a back edge (since domination implies header -> ... ->  node; back edge is node -> header)
      if (dom.get(node)?.has(header)) {
        // Find the body of the loop, which is the set of all nodes found by backwards traversal from the source of the back edge until the header
        const body = new Set<string>([header, node]);
        const stack = [node];
        while (stack.length) {
          const n = stack.pop()!;
          (cfg.predMap.get(n) || []).forEach(pe => {
            // The body is complete when pe.source = header so it's already been added to the body and so the backwards traversal is done
            if (!body.has(pe.source)) {
              body.add(pe.source);
              stack.push(pe.source);
            }
          });
        }
        // Accumulate nodes if this header already has a loop body from another back-edge (e.g. case 3: both branches loop back → while True with inner if/else)
        // All body nodes are part of the loop region, without specific distinction between the two branches (not needed)
        // Not accumulating them would mean the last branch would overwrite the loop body from the first branch and the loop would only be the last branch
        if (loops.has(header)) {
          const existing_body = loops.get(header)!;
          body.forEach(bodyNode => existing_body.add(bodyNode));
        } else {
          loops.set(header, body);
        }
      }
    });
  });
  return loops;
};

const generateNodeStatements = (node: FlowNode, nodeId: string): Statement[] => {
  // Generate statements for a single diagram node (assignment, input, output)
  const stmts: Statement[] = [];
  switch (node.type) {
    case 'AssignVariable': {
      if (node.data?.expression) {
        const diag = DiagramExpression.fromObject(node.data.expression as DiagramIExpression);
        if (diag.leftSide instanceof Variable) {
          const target: Identifier = { type: 'Identifier', name: diag.leftSide.name, diagramNodeId: nodeId };
          const val = convertDiagramExpressionToAST(diag.rightSide, nodeId);
          stmts.push(
            val.type !== 'UnsupportedNode'
              ? { type: 'AssignmentStatement', target, value: val, diagramNodeId: nodeId } as AssignmentStatement
              : val as UnsupportedNode
          );
        }
      }
      break;
    }
    case 'Input': {
      if (node.data?.variable) {
        const v = node.data.variable as Variable;
        const target: Identifier = { type: 'Identifier', name: v.name, diagramNodeId: nodeId };
        const baseCall: CallExpression = { type: 'CallExpression', callee: { type: 'Identifier', name: 'input', diagramNodeId: nodeId }, arguments: [], diagramNodeId: nodeId } as CallExpression;
        let value: PyExpression = baseCall;
        if (v.type === 'integer') value = { type: 'CallExpression', callee: { type: 'Identifier', name: 'int', diagramNodeId: nodeId }, arguments: [baseCall], diagramNodeId: nodeId } as CallExpression;
        else if (v.type === 'float') value = { type: 'CallExpression', callee: { type: 'Identifier', name: 'float', diagramNodeId: nodeId }, arguments: [baseCall], diagramNodeId: nodeId } as CallExpression;
        else if (v.type === 'boolean') value = { type: 'BinaryExpression', operator: '==', left: baseCall, right: { type: 'Literal', value: true, raw: 'True', diagramNodeId: nodeId } as Literal, diagramNodeId: nodeId } as BinaryExpression;
        stmts.push({ type: 'AssignmentStatement', target, value, diagramNodeId: nodeId } as AssignmentStatement);
      }
      break;
    }
    case 'Output': {
      if (node.data?.expression) {
        const diag = DiagramExpression.fromObject(node.data.expression as DiagramIExpression);
        const val = convertDiagramExpressionToAST(diag.rightSide, nodeId);
        stmts.push(
          val.type !== 'UnsupportedNode'
            ? { type: 'PrintStatement', arguments: [val], diagramNodeId: nodeId } as PrintStatement
            : val as UnsupportedNode
        );
      } else {
        stmts.push({ type: 'PrintStatement', arguments: [], diagramNodeId: nodeId } as PrintStatement);
      }
      break;
    }
    default:
      break;
  }
  return stmts;
};

const buildAST = (
  cfg: CFG,
  loops: Map<string, Set<string>>,
  nodeId: string,
  visited: Set<string> = new Set(),
  inLoop: string | null = null
): Statement[] => {
  // AST builder: recursively traverse CFG building Python AST

  // Handle invalid nodeId
  if (!nodeId || !cfg.nodesMap.has(nodeId)) {
    return [{ type: 'UnsupportedNode', reason: `Invalid or missing node ID: ${nodeId}`, diagramNodeId: nodeId } as UnsupportedNode];
  }

  // Loop header handling (the header is the loop entry point)
  if (loops.has(nodeId) && inLoop !== nodeId) {
    const headerNode = cfg.nodesMap.get(nodeId)!;

    // --- prepend header's own statements ---
    const headerStmts = generateNodeStatements(headerNode, nodeId);
    // -------------------------------------------------------------

    // Build a loop based on back-edge patterns
    const loopBodyIds = loops.get(nodeId)!;
    if (headerNode.type === 'Conditional') {
      const outs = cfg.succMap.get(nodeId) || [];
      const yesEdges = outs.filter(e => (e.data?.conditionalLabel as string)?.toLowerCase?.() === 'yes');
      const noEdges  = outs.filter(e => (e.data?.conditionalLabel as string)?.toLowerCase?.() === 'no');
      const yesBack = yesEdges.filter(e => e.target && loopBodyIds.has(e.target));
      const noBack  = noEdges.filter(e => e.target && loopBodyIds.has(e.target));
      
      // Build condition expression AST
      const diag = DiagramExpression.fromObject(headerNode.data?.expression as DiagramIExpression);
      const elems: ExpressionElement[] = [];
      if (Array.isArray(diag.leftSide)) elems.push(...diag.leftSide);
      if (diag.equality) elems.push(new ExpressionElement(diag.equality, 'operator', diag.equality));
      elems.push(...diag.rightSide);
      const condExpr = convertDiagramExpressionToAST(elems, nodeId);

      // Case 1: YES branch loops back only → while(cond)
      if (yesBack.length > 0 && noBack.length === 0) {
        const bodyStmts: Statement[] = [...headerStmts];
        const loopVisited = new Set<string>();

        // Build body statements for YES branch
        yesBack.forEach(e => {
          if (e.target) bodyStmts.push(...buildAST(cfg, loops, e.target, loopVisited, nodeId));
        });

        // Build while statement for YES branch
        const whileStmt: WhileStatement = {
          type: 'WhileStatement', test: condExpr,
          body: { type: 'BlockStatement', body: bodyStmts }, diagramNodeId: nodeId
        };
        const stmts: Statement[] = [whileStmt];

        // After loop, take NO exit (next code outside loop)
        noEdges.filter(e => e.target && !loopBodyIds.has(e.target))
          .forEach(e => stmts.push(...buildAST(cfg, loops, e.target, visited, inLoop)));

        return stmts;
      }

      // Case 2: NO branch loops back only → while(!cond)
      if (yesBack.length === 0 && noBack.length > 0) {
        const bodyStmts: Statement[] = [...headerStmts];
        const loopVisited = new Set<string>();

        // Build body statements for NO branch
        noBack.forEach(e => {
          if (e.target) bodyStmts.push(...buildAST(cfg, loops, e.target, loopVisited, nodeId));
        });

        // Negate the condition expression (i.e. while(!cond) instead of while(cond))
        const falseLit: Literal = { type: 'Literal', value: false, raw: 'False', diagramNodeId: nodeId };
        const notExpr: PyExpression = { type: 'BinaryExpression', operator: '==', left: condExpr, right: falseLit, diagramNodeId: nodeId } as BinaryExpression;

        // Build while statement for NO branch
        const whileStmt: WhileStatement = {
          type: 'WhileStatement', test: notExpr,
          body: { type: 'BlockStatement', body: bodyStmts }, diagramNodeId: nodeId
        };
        const stmts: Statement[] = [whileStmt];

        // After loop, take YES exit (next code outside loop)
        yesEdges.filter(e => e.target && !loopBodyIds.has(e.target))
          .forEach(e => stmts.push(...buildAST(cfg, loops, e.target, visited, inLoop)));

        return stmts;
      }

      // Case 3: both branches loop back → while True { if(cond) else }
      if (yesBack.length > 0 && noBack.length > 0) {
        // Case 3: both branches loop back → while True with inner if/else
        const yesVisited = new Set<string>();
        const noVisited  = new Set<string>();

        // Build body statements for YES branch (consequent)
        const consequent: Statement[] = [];
        yesBack.forEach(e => {
          if (e.target) consequent.push(...buildAST(cfg, loops, e.target, yesVisited, nodeId));
        });

        // Build body statements for NO branch (alternate)
        const alternate: Statement[] = [];
        noBack.forEach(e => {
          if (e.target) alternate.push(...buildAST(cfg, loops, e.target, noVisited, nodeId));
        });

        // Build if statement for YES/NO branches
        const ifStmt: IfStatement = {
          type: 'IfStatement', test: condExpr,
          consequent: { type: 'BlockStatement', body: consequent },
          alternate: { type: 'BlockStatement', body: alternate },
          diagramNodeId: nodeId
        };
        const bodyStmts: Statement[] = [...headerStmts, ifStmt];

        // test for while is True (infinite loop)
        const trueLit: Literal = { type: 'Literal', value: true, raw: 'True', diagramNodeId: nodeId };

        // Build while statement for YES/NO branches
        return [{
          type: 'WhileStatement', test: trueLit,
          body: { type: 'BlockStatement', body: bodyStmts },
          diagramNodeId: nodeId
        } as WhileStatement];
      }
    } else {
      // Unconditional loop (while True)
      const bodyStmts: Statement[] = [...headerStmts];
      const loopVisited = new Set<string>();

      // Build body statements for nodes contained in the loop body
      (cfg.succMap.get(nodeId) || []).forEach(e => {
        if (e.target && loopBodyIds.has(e.target)) {
          bodyStmts.push(...buildAST(cfg, loops, e.target, loopVisited, nodeId));
        }
      });

      // test for while is True (infinite loop)
      const trueLit: Literal = { type: 'Literal', value: true, raw: 'True', diagramNodeId: nodeId };

      // Build while statement for YES/NO branches
      const whileStmt: WhileStatement = {
        type: 'WhileStatement', test: trueLit,
        body: { type: 'BlockStatement', body: bodyStmts }, diagramNodeId: nodeId
      };

      return [whileStmt];
    }
  }
  
  // If this is a loop header and we're inside its own loop, don't process as regular conditional
  if (loops.has(nodeId) && inLoop === nodeId) {
    return []; // Skip processing the loop header again within its own loop
  }
  
  // Prevent revisiting
  if (visited.has(nodeId)) return [];
  visited.add(nodeId);

  const node = cfg.nodesMap.get(nodeId)!;
  const stmts: Statement[] = [];

  switch (node.type) {
    case 'Start': {
      // Start node: proceed to next node if available
      const outs = cfg.succMap.get(nodeId) || [];
      if (outs.length > 0 && outs[0].target) {
        stmts.push(...buildAST(cfg, loops, outs[0].target, visited, inLoop));
      }
      return stmts;
    }
    case 'AssignVariable':
    case 'Input':
    case 'Output': {
      stmts.push(...generateNodeStatements(node, nodeId));
    } break;
    case 'DeclareVariable': {
      // no-op
    } break;
    case 'Conditional': {
      // non-loop conditional (loops are handled prior to this)
      const diag = DiagramExpression.fromObject(node.data!.expression as DiagramIExpression);
      const elems: ExpressionElement[] = [];

      // Build condition expression AST
      if (Array.isArray(diag.leftSide)) elems.push(...diag.leftSide);
      if (diag.equality) elems.push(new ExpressionElement(diag.equality, 'operator', diag.equality));
      elems.push(...diag.rightSide);
      const test = convertDiagramExpressionToAST(elems, nodeId);

      // Find YES/NO branches
      const outs = cfg.succMap.get(nodeId) || [];
      const t = outs.find(e => (e.data?.conditionalLabel as string)?.toLowerCase?.() === 'yes'); // TODO: use 0-1 instead of yes-no for language support
      const f = outs.find(e => (e.data?.conditionalLabel as string)?.toLowerCase?.() === 'no');
      
      // Create separate visited sets for each branch to avoid cross-contamination
      const trueVisited = new Set(visited);
      const falseVisited = new Set(visited);
      
      // Build body statements for YES branch (consequent)
      const cons = t?.target ? buildAST(cfg, loops, t.target, trueVisited, inLoop) : [];
      // Build body statements for NO branch (alternate)
      const alt = f?.target ? buildAST(cfg, loops, f.target, falseVisited, inLoop) : [];

      // Build if statement for YES/NO branches
      const ifStmt: IfStatement = { type: 'IfStatement', test,
        consequent: { type: 'BlockStatement', body: cons }, diagramNodeId: nodeId };
      if (alt.length) ifStmt.alternate = { type: 'BlockStatement', body: alt };
      stmts.push(ifStmt);

      return stmts;
    }
    case 'End': {
      return stmts;
    }
    default: {
      stmts.push({ type: 'UnsupportedNode', reason: `Node '${node.type}' not supported.`, diagramNodeId: nodeId } as UnsupportedNode);
    }
  }

  // Fall through to successors
  const outs = cfg.succMap.get(nodeId) || [];
  if (outs.length && node.type !== 'Conditional' && node.type !== 'End') {
    const next = outs[0].target;
    if (next) stmts.push(...buildAST(cfg, loops, next, visited, inLoop));
  }

  return stmts;
};

// Main entry: generate Python AST
export const generatePythonAST = (nodes: FlowNode[], edges: Edge[]): Program => {
  // Handle empty diagrams
  if (!nodes || nodes.length === 0) {
    return { 
      type: 'Program', 
      body: [{ type: 'UnsupportedNode', reason: 'No nodes in diagram', diagramNodeId: 'empty' } as UnsupportedNode] 
    };
  }

  try {
    const cfg = buildCFG(nodes, edges);
    if (cfg.startId === '') {
      return { 
        type: 'Program', 
        body: [{ type: 'UnsupportedNode', reason: 'No Start node found', diagramNodeId: cfg.startId } as UnsupportedNode] 
      };
    }

    const dom = computeDominators(cfg);
    const loops = findNaturalLoops(cfg, dom); // Natural loop: back edges
    const body = buildAST(cfg, loops, cfg.startId);

    // Handle empty program body
    if (!body || body.length === 0) {
      return { 
        type: 'Program', 
        body: [{ type: 'UnsupportedNode', reason: 'Empty diagram - only Start node with no connections', diagramNodeId: cfg.startId } as UnsupportedNode] 
      };
    }
    
    return { type: 'Program', body };
  } catch (error) {
    return { 
      type: 'Program', 
      body: [{ type: 'UnsupportedNode', reason: `Error building AST: ${(error as Error).message}`, diagramNodeId: 'error' } as UnsupportedNode] 
    };
  }
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
      if (literal.raw !== undefined) { // Prioritize raw if available
        return literal.raw;
      }
      // Fallback logic if raw is not provided
      if (typeof literal.value === 'string') {
        return JSON.stringify(literal.value);
      } else if (literal.value === null) {
        return 'None';
      } else if (typeof literal.value === 'boolean') {
        return literal.value ? 'True' : 'False'; // Ensure Pythonic booleans
      }
      return String(literal.value); // For numbers and other types

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
