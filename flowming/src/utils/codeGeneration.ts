import { FlowNode } from '../components/Flow/FlowTypes';
import { Edge } from '@xyflow/react';
import {
  Program, Statement, Expression as PyExpression, AssignmentStatement, IfStatement, WhileStatement, BlockStatement, Identifier, Literal, BinaryExpression, PrintStatement, UnsupportedNode, CallExpression, ASTNode, BreakStatement, SubscriptExpression
} from '../models/pythonAST';
import { Expression as DiagramExpression, ExpressionElement, Variable, IOperator, IExpression as DiagramIExpression, VariableType } from '../models';
import { buildAST, ExpressionASTNode as DiagramASTNode, UnaryOpNode, BinaryOpNode as DiagramBinaryOpNode, FunctionCallNode as DiagramFunctionCallNode, IdentifierNode as DiagramIdentifierNode, LiteralNode as DiagramLiteralNode, MemberAccessNode } from '../models/ExpressionParser';

// TODO: check bugs images + extensive automated testing

// Helper to get the visual identifier for a node (visualId if available, otherwise nodeId)
const getNodeVisualId = (cfg: CFG, nodeId: string): string => {
  const node = cfg.nodesMap.get(nodeId);
  return node?.data?.visualId || nodeId;
};

// Helper to translate a generic Diagram AST to a Python-specific AST
const convertDiagramASTToPythonAST = (diagramNode: DiagramASTNode, nodeId: string, cfg: CFG): PyExpression => {
  const visualId = getNodeVisualId(cfg, nodeId);
  const unsupportedNode = (reason: string): UnsupportedNode =>
    ({ type: 'UnsupportedNode', reason, diagramNodeId: nodeId, visualId } as UnsupportedNode);

  switch(diagramNode.type) {
    case 'Literal': {
      const literal = diagramNode as DiagramLiteralNode;
      if (literal.valueType === 'boolean') {
        return { type: 'Literal', value: literal.value, raw: literal.value ? 'True' : 'False', diagramNodeId: nodeId } as Literal;
      }
      if (literal.valueType === 'string') {
        return { type: 'Literal', value: literal.value, raw: JSON.stringify(literal.value), diagramNodeId: nodeId } as Literal;
      }
       if (literal.value === null) {
        return { type: 'Literal', value: null, raw: 'None', diagramNodeId: nodeId } as Literal;
      }
      // It's a number (integer or float)
      return { type: 'Literal', value: literal.value, raw: String(literal.value), diagramNodeId: nodeId } as Literal;
    }

    case 'Identifier': {
      const identifier = diagramNode as DiagramIdentifierNode;
      if (identifier.variable.type === 'array' && identifier.variable.indexExpression && identifier.variable.indexExpression.length > 0) {
        const indexExpr = convertDiagramExpressionToAST(identifier.variable.indexExpression as ExpressionElement[], nodeId, cfg);
        const objId: Identifier = { type: 'Identifier', name: identifier.name, diagramNodeId: nodeId } as Identifier;
        return { type: 'SubscriptExpression', object: objId, index: indexExpr, diagramNodeId: nodeId } as any;
      }
      return { type: 'Identifier', name: identifier.name, diagramNodeId: nodeId } as Identifier;
    }
    
    case 'UnaryOp': {
      const unaryOp = diagramNode as UnaryOpNode;
      const operand = convertDiagramASTToPythonAST(unaryOp.operand, nodeId, cfg);
      if (operand.type === 'UnsupportedNode') return operand;

      if (unaryOp.operator === '!') {
         return {
          type: 'BinaryExpression',
          operator: '==', // Represent 'not x' as 'x == False'
          left: operand,
          right: { type: 'Literal', value: false, raw: 'False', diagramNodeId: nodeId },
          diagramNodeId: nodeId
        } as BinaryExpression;
      }
      if (unaryOp.operator === '-') {
        return {
          type: 'BinaryExpression',
          operator: '-', // Represent '-x' as '0 - x'
          left: { type: 'Literal', value: 0, raw: '0', diagramNodeId: nodeId },
          right: operand,
          diagramNodeId: nodeId
        } as BinaryExpression;
      }
      if (unaryOp.operator === '+') {
        return operand; // Unary plus is a no-op
      }
      return unsupportedNode(`Unsupported unary operator: ${unaryOp.operator}`);
    }

    case 'BinaryOp': {
      const binaryOp = diagramNode as DiagramBinaryOpNode;
      const left = convertDiagramASTToPythonAST(binaryOp.left, nodeId, cfg);
      const right = convertDiagramASTToPythonAST(binaryOp.right, nodeId, cfg);
      
      if (left.type === 'UnsupportedNode') return left;
      if (right.type === 'UnsupportedNode') return right;

      let opForAST = binaryOp.operator as IOperator | 'and' | 'or';
      if (opForAST === '&&') opForAST = 'and';
      if (opForAST === '||') opForAST = 'or';

      return { type: 'BinaryExpression', operator: opForAST, left, right, diagramNodeId: nodeId } as BinaryExpression;
    }

    case 'FunctionCall': {
      const funcCall = diagramNode as DiagramFunctionCallNode;
      const argument = convertDiagramASTToPythonAST(funcCall.argument, nodeId, cfg);
      if (argument.type === 'UnsupportedNode') return argument;

      const functionNameMap: { [key: string]: string } = {
        'integer': 'int', 'string': 'str', 'float': 'float', 'boolean': 'bool'
      };
      
      const funcName = functionNameMap[funcCall.functionName] || funcCall.functionName;

      return {
        type: 'CallExpression',
        callee: { type: 'Identifier', name: funcName, diagramNodeId: nodeId },
        arguments: [argument],
        diagramNodeId: nodeId
      } as CallExpression;
    }

    case 'MemberAccess': {
      const member = diagramNode as MemberAccessNode;
      const obj = convertDiagramASTToPythonAST(member.object, nodeId, cfg);
      const idx = convertDiagramASTToPythonAST(member.property, nodeId, cfg);
      if (obj.type === 'UnsupportedNode' || idx.type === 'UnsupportedNode') return obj.type==='UnsupportedNode'?obj:idx;
      return { type: 'SubscriptExpression', object: obj as Identifier, index: idx, diagramNodeId: nodeId } as any;
    }

    default:
      return unsupportedNode(`Unknown diagram AST node type: ${(diagramNode as any).type}`);
  }
}

// Helper to convert Diagram ExpressionElement[] to Python AST Expression
const convertDiagramExpressionToAST = (elements: ExpressionElement[], nodeId: string, cfg: CFG): PyExpression => {
  const visualId = getNodeVisualId(cfg, nodeId);
  const unsupportedNode = (reason: string): UnsupportedNode =>
    ({ type: 'UnsupportedNode', reason, diagramNodeId: nodeId, visualId } as UnsupportedNode);

  if (!elements || elements.length === 0) {
    return { type: 'Literal', value: null, raw: 'None', diagramNodeId: nodeId } as Literal; // Empty expression
  }
  
  try {
    const diagramAST = buildAST(elements);
    return convertDiagramASTToPythonAST(diagramAST, nodeId, cfg);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return unsupportedNode(`Failed to parse expression: ${message}`);
  }
};

// Helper to convert Variable (left side) into Python target (Identifier or SubscriptExpression)
const variableToTarget = (v: Variable, nodeId: string, cfg: CFG): Identifier | SubscriptExpression => {
  if (v.type === 'array' && v.indexExpression && v.indexExpression.length > 0) {
    const idxAst = convertDiagramExpressionToAST(v.indexExpression as ExpressionElement[], nodeId, cfg);
    const objId: Identifier = { type: 'Identifier', name: v.name, diagramNodeId: nodeId } as Identifier;
    return { type: 'SubscriptExpression', object: objId, index: idxAst, diagramNodeId: nodeId } as any;
  }
  return { type: 'Identifier', name: v.name, diagramNodeId: nodeId } as Identifier;
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

const generateNodeStatements = (node: FlowNode, nodeId: string, cfg: CFG): Statement[] => {
  // Generate statements for a single diagram node (assignment, input, output)
  const stmts: Statement[] = [];
  const visualId = getNodeVisualId(cfg, nodeId);
  
  switch (node.type) {
    case 'AssignVariable': {
      if (node.data?.expression) {
        const diag = DiagramExpression.fromObject(node.data.expression as DiagramIExpression);
        if (diag.leftSide instanceof Variable) {
          const target = variableToTarget(diag.leftSide, nodeId, cfg);
          const val = convertDiagramExpressionToAST(diag.rightSide, nodeId, cfg);
          stmts.push(
            val.type !== 'UnsupportedNode'
              ? { type: 'AssignmentStatement', target, value: val, diagramNodeId: nodeId, visualId } as AssignmentStatement
              : val as UnsupportedNode
          );
        }
      }
      break;
    }
    case 'Input': {
      if (node.data?.variable) {
        const v = node.data.variable as Variable;
        const target = variableToTarget(v, nodeId, cfg);
        
        const promptText = `Enter the value of '${v.name}' by keyboard`;
        const promptLiteral: Literal = { type: 'Literal', value: promptText, raw: JSON.stringify(promptText), diagramNodeId: nodeId };

        const baseCall: CallExpression = { 
          type: 'CallExpression', 
          callee: { type: 'Identifier', name: 'input', diagramNodeId: nodeId, visualId }, 
          arguments: [promptLiteral], 
          diagramNodeId: nodeId,
          visualId
        } as CallExpression;
        let value: PyExpression = baseCall;
        
        // Handle type conversion.
        let vType: VariableType = v.type;
        if (v.type === 'array') {
          vType = v.arraySubtype as VariableType;
        }

        if (vType === 'integer') {
          // int(input())
          value = { 
            type: 'CallExpression', 
            callee: { type: 'Identifier', name: 'int', diagramNodeId: nodeId, visualId }, 
            arguments: [baseCall], 
            diagramNodeId: nodeId,
            visualId
          } as CallExpression;
        } else if (vType === 'float') {
          // float(input())
          value = { 
            type: 'CallExpression', 
            callee: { type: 'Identifier', name: 'float', diagramNodeId: nodeId, visualId }, 
            arguments: [baseCall], 
            diagramNodeId: nodeId,
            visualId
          } as CallExpression;
        } else if (vType === 'boolean') {
          // bool(input())
          value = { 
            type: 'CallExpression', 
            callee: { type: 'Identifier', name: 'bool', diagramNodeId: nodeId, visualId }, 
            arguments: [baseCall], 
            diagramNodeId: nodeId,
            visualId
          } as CallExpression;
        }
        stmts.push({ type: 'AssignmentStatement', target, value, diagramNodeId: nodeId, visualId } as AssignmentStatement);
      }
      break;
    }
    case 'Output': {
      if (node.data?.expression) {
        const diag = DiagramExpression.fromObject(node.data.expression as DiagramIExpression);
        const val = convertDiagramExpressionToAST(diag.rightSide, nodeId, cfg);
        stmts.push(
          val.type !== 'UnsupportedNode'
            ? { type: 'PrintStatement', arguments: [val], diagramNodeId: nodeId, visualId } as PrintStatement
            : val as UnsupportedNode
        );
      } else {
        stmts.push({ type: 'PrintStatement', arguments: [], diagramNodeId: nodeId, visualId } as PrintStatement);
      }
      break;
    }
    default:
      break;
  }
  return stmts;
};

const generateStatementsFromCFG = (
  cfg: CFG,
  loops: Map<string, Set<string>>,
  nodeId: string,
  visited: Set<string> = new Set(),
  inLoop: string | null = null
): Statement[] => {
  // AST builder: recursively traverse CFG building Python AST

  // Handle invalid nodeId
  if (!nodeId || !cfg.nodesMap.has(nodeId)) {
    return [{ type: 'UnsupportedNode', reason: `Invalid or missing node ID: ${nodeId}`, diagramNodeId: nodeId, visualId: nodeId } as UnsupportedNode];
  }

  // Skip body nodes of do-while style loops from appearing outside the loop
  if (inLoop === null) {
    for (const [hdr, bodySet] of loops) {
      if (hdr !== nodeId && bodySet.has(nodeId)) {
        const succs = cfg.succMap.get(hdr) || [];
        if (succs.some(e => e.target === nodeId)) {
          return []; // Node will be handled inside loop generation
        }
      }
    }
  }

  const visualId = getNodeVisualId(cfg, nodeId);

  // Loop header handling (the header is the loop entry point)
  if (loops.has(nodeId) && inLoop !== nodeId) {
    const headerNode = cfg.nodesMap.get(nodeId)!;

    // --- prepend header's own statements ---
    const headerStmts = generateNodeStatements(headerNode, nodeId, cfg);
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
      const condExpr = convertDiagramExpressionToAST(elems, nodeId, cfg);

      // Detect do-while style: single incoming predecessor implies body before test
      const preds = cfg.predMap.get(nodeId) || [];
      if (preds.length === 1) {
        // Build body assignment from predecessor
        const predNode = cfg.nodesMap.get(preds[0].source)!;
        const bodyStmt = generateNodeStatements(predNode, preds[0].source, cfg);

        // Build conditional pass statement
        const passStmt: Statement[] = [];
        // Build if for do-while exit
        const ifStmt: IfStatement = {
          type: 'IfStatement', test: condExpr,
          consequent: { type: 'BlockStatement', body: passStmt },
          diagramNodeId: nodeId, visualId
        };
        // Build infinite loop AST
        const trueLit: Literal = { type: 'Literal', value: true, raw: 'True', diagramNodeId: nodeId, visualId } as Literal;
        const whileStmt: WhileStatement = {
          type: 'WhileStatement', test: trueLit,
          body: { type: 'BlockStatement', body: [...bodyStmt, ifStmt] }, diagramNodeId: nodeId, visualId
        } as WhileStatement;
        return [whileStmt];
      }

      // Case 1: YES branch loops back only → while(cond)
      if (yesBack.length > 0 && noBack.length === 0) {
        const bodyStmts: Statement[] = [...headerStmts];
        const loopVisited = new Set<string>();

        // Build body statements for YES branch
        yesBack.forEach(e => {
          if (e.target && cfg.nodesMap.has(e.target)) bodyStmts.push(...generateStatementsFromCFG(cfg, loops, e.target, loopVisited, nodeId));
        });

        // Build while statement for YES branch
        const whileStmt: WhileStatement = {
          type: 'WhileStatement', test: condExpr,
          body: { type: 'BlockStatement', body: bodyStmts }, diagramNodeId: nodeId, visualId
        };
        const stmts: Statement[] = [whileStmt];

        // After loop, take NO exit (next code outside loop)
        noEdges.filter(e => e.target && !loopBodyIds.has(e.target) && cfg.nodesMap.has(e.target))
          .forEach(e => stmts.push(...generateStatementsFromCFG(cfg, loops, e.target, visited, inLoop)));

        return stmts;
      }

      // Case 2: NO branch loops back only → while(!cond)
      if (yesBack.length === 0 && noBack.length > 0) {
        const bodyStmts: Statement[] = [...headerStmts];
        const loopVisited = new Set<string>();

        // Build body statements for NO branch
        noBack.forEach(e => {
          if (e.target && cfg.nodesMap.has(e.target)) bodyStmts.push(...generateStatementsFromCFG(cfg, loops, e.target, loopVisited, nodeId));
        });

        // Negate the condition expression (i.e. while(!cond) instead of while(cond))
        const falseLit: Literal = { type: 'Literal', value: false, raw: 'False', diagramNodeId: nodeId, visualId };
        const notExpr: PyExpression = { type: 'BinaryExpression', operator: '==', left: condExpr, right: falseLit, diagramNodeId: nodeId, visualId } as BinaryExpression;

        // Build while statement for NO branch
        const whileStmt: WhileStatement = {
          type: 'WhileStatement', test: notExpr,
          body: { type: 'BlockStatement', body: bodyStmts }, diagramNodeId: nodeId, visualId
        };
        const stmts: Statement[] = [whileStmt];

        // After loop, take YES exit (next code outside loop)
        yesEdges.filter(e => e.target && !loopBodyIds.has(e.target) && cfg.nodesMap.has(e.target))
          .forEach(e => stmts.push(...generateStatementsFromCFG(cfg, loops, e.target, visited, inLoop)));

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
          if (e.target && cfg.nodesMap.has(e.target)) consequent.push(...generateStatementsFromCFG(cfg, loops, e.target, yesVisited, nodeId));
        });

        // Build body statements for NO branch (alternate)
        const alternate: Statement[] = [];
        noBack.forEach(e => {
          if (e.target && cfg.nodesMap.has(e.target)) alternate.push(...generateStatementsFromCFG(cfg, loops, e.target, noVisited, nodeId));
        });

        // Build if statement for YES/NO branches
        const ifStmt: IfStatement = {
          type: 'IfStatement', test: condExpr,
          consequent: { type: 'BlockStatement', body: consequent },
          alternate: { type: 'BlockStatement', body: alternate },
          diagramNodeId: nodeId, visualId
        };
        const bodyStmts: Statement[] = [...headerStmts, ifStmt];

        // test for while is True (infinite loop)
        const trueLit: Literal = { type: 'Literal', value: true, raw: 'True', diagramNodeId: nodeId, visualId };

        // Build while statement for YES/NO branches
        return [{
          type: 'WhileStatement', test: trueLit,
          body: { type: 'BlockStatement', body: bodyStmts },
          diagramNodeId: nodeId, visualId
        } as WhileStatement];
      }
    } else {
      // Unconditional loop (while True)
      const bodyStmts: Statement[] = [...headerStmts];
      const loopVisited = new Set<string>();

      // Build body statements for nodes contained in the loop body
      (cfg.succMap.get(nodeId) || []).forEach(e => {
        if (e.target && loopBodyIds.has(e.target) && cfg.nodesMap.has(e.target)) {
          bodyStmts.push(...generateStatementsFromCFG(cfg, loops, e.target, loopVisited, nodeId));
        }
      });

      // test for while is True (infinite loop)
      const trueLit: Literal = { type: 'Literal', value: true, raw: 'True', diagramNodeId: nodeId, visualId };

      // Build while statement for YES/NO branches
      const whileStmt: WhileStatement = {
        type: 'WhileStatement', test: trueLit,
        body: { type: 'BlockStatement', body: bodyStmts }, diagramNodeId: nodeId, visualId
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
      // Start node: proceed to next node if available and it exists
      const outs = cfg.succMap.get(nodeId) || [];
      if (outs.length > 0 && outs[0].target && cfg.nodesMap.has(outs[0].target)) {
        stmts.push(...generateStatementsFromCFG(cfg, loops, outs[0].target, visited, inLoop));
      }
      return stmts;
    }
    case 'AssignVariable':
    case 'Input':
    case 'Output': {
      stmts.push(...generateNodeStatements(node, nodeId, cfg));
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
      const test = convertDiagramExpressionToAST(elems, nodeId, cfg);

      // Find YES/NO branches
      const outs = cfg.succMap.get(nodeId) || [];
      const yesEdge = outs.find(e => (e.data?.conditionalLabel as string)?.toLowerCase?.() === 'yes'); // TODO: use 0-1 instead of yes-no for language support
      const noEdge  = outs.find(e => (e.data?.conditionalLabel as string)?.toLowerCase?.() === 'no');

      const loopBodyIds = inLoop ? loops.get(inLoop) : undefined;

      // Check for immediate merge: both branches lead to same next node
      if (yesEdge?.target && noEdge?.target) {
        const yesSucc = cfg.succMap.get(yesEdge.target) || [];
        const noSucc  = cfg.succMap.get(noEdge.target) || [];
        if (yesSucc.length > 0 && noSucc.length > 0 && yesSucc[0]?.target && yesSucc[0].target === noSucc[0]?.target) {
          // Merge detected
          const mergeId = yesSucc[0].target;
          // Build only branch statements (single nodes)
          const yesNode = cfg.nodesMap.get(yesEdge.target)!;
          const noNode  = cfg.nodesMap.get(noEdge.target)!;
          const consStmts = generateNodeStatements(yesNode, yesEdge.target, cfg);
          const altStmts  = generateNodeStatements(noNode,  noEdge.target, cfg);

          // Build if statement
          const ifStmt: IfStatement = {
            type: 'IfStatement', test,
            consequent: { type: 'BlockStatement', body: consStmts },
            alternate:  { type: 'BlockStatement', body: altStmts },
            diagramNodeId: nodeId, visualId
          };
          const stmts: Statement[] = [ifStmt];

          // After if-else, process merge node and its successors
          if (!visited.has(mergeId)) {
            stmts.push(...generateStatementsFromCFG(cfg, loops, mergeId, visited, inLoop));
          }
          return stmts;
        }
      }

      // Default non-merge conditional handling
      const trueVisited = new Set(visited);
      const falseVisited = new Set(visited);
      
      const processBranch = (edge: Edge | undefined, branchVisited: Set<string>): Statement[] => {
        if (!edge || !edge.target || !cfg.nodesMap.has(edge.target)) return [];
    
        const targetId = edge.target;
    
        if (inLoop && loopBodyIds) {
            if (!loopBodyIds.has(targetId)) { // Exit from loop
                if (cfg.nodesMap.get(targetId)?.type === 'End') {
                    return [{ type: 'BreakStatement', diagramNodeId: nodeId, visualId } as BreakStatement];
                }
                const exitPathStmts = generateStatementsFromCFG(cfg, loops, targetId, branchVisited, null);
                
                const lastNodeIdOnPath = exitPathStmts.length > 0 ? (exitPathStmts[exitPathStmts.length - 1] as Statement).diagramNodeId : targetId;
                const successors = lastNodeIdOnPath ? cfg.succMap.get(lastNodeIdOnPath) || [] : [];
    
                if (successors.every(e => e.target && !loopBodyIds.has(e.target))) {
                     return [...exitPathStmts, { type: 'BreakStatement', diagramNodeId: nodeId, visualId } as BreakStatement];
                }
                return exitPathStmts;
    
            } else if (targetId === inLoop) { // continue
                return [];
            }
        }
        
        return generateStatementsFromCFG(cfg, loops, targetId, branchVisited, inLoop);
      };

      const cons = processBranch(yesEdge, trueVisited);
      const alt = processBranch(noEdge, falseVisited);

      const commonVisited = new Set([...trueVisited].filter(x => falseVisited.has(x)));
      commonVisited.forEach(id => visited.add(id));

      // Build if statement
      const ifStmt: IfStatement = {
        type: 'IfStatement',
        test,
        consequent: { type: 'BlockStatement', body: cons },
        diagramNodeId: nodeId,
        visualId
      };
      if (alt.length > 0) {
        ifStmt.alternate = { type: 'BlockStatement', body: alt };
      }
      stmts.push(ifStmt);

      return stmts;
    }
    case 'End': {
      return stmts;
    }
    default: {
      stmts.push({ type: 'UnsupportedNode', reason: `Node '${node.type}' not supported.`, diagramNodeId: nodeId, visualId } as UnsupportedNode);
    }
  }

  // Fall through to successors
  const outs = cfg.succMap.get(nodeId) || [];
  if (outs.length && node.type !== 'Conditional' && node.type !== 'End') {
    const next = outs[0].target;
    if (next && cfg.nodesMap.has(next)) stmts.push(...generateStatementsFromCFG(cfg, loops, next, visited, inLoop));
  }

  return stmts;
};

// Main entry: generate Python AST
export const generatePythonAST = (nodes: FlowNode[], edges: Edge[]): Program => {
  // Handle empty diagrams
  if (!nodes || nodes.length === 0) {
    return { 
      type: 'Program', 
      body: [{ type: 'UnsupportedNode', reason: 'No nodes in diagram', diagramNodeId: 'empty', visualId: 'N/A' } as UnsupportedNode] 
    };
  }

  try {
    const cfg = buildCFG(nodes, edges);
    if (cfg.startId === '') {
      return { 
        type: 'Program', 
        body: [{ type: 'UnsupportedNode', reason: 'No Start node found', diagramNodeId: cfg.startId, visualId: 'N/A' } as UnsupportedNode] 
      };
    }

    const dom = computeDominators(cfg);
    // Detect natural loops via back-edge patterns
    const loops = findNaturalLoops(cfg, dom);

    const body = generateStatementsFromCFG(cfg, loops, cfg.startId);

    // Handle empty program body
    if (!body || body.length === 0) {
      const visualId = getNodeVisualId(cfg, cfg.startId);
      return { 
        type: 'Program', 
        body: [{ type: 'UnsupportedNode', reason: 'Empty diagram - only Start node with no meaningful connections', diagramNodeId: cfg.startId, visualId } as UnsupportedNode] 
      };
    }
    
    return { type: 'Program', body };
  } catch (error) {
    return { 
      type: 'Program', 
      body: [{ type: 'UnsupportedNode', reason: `Error building AST: ${(error as Error).message}`, diagramNodeId: 'error', visualId: 'N/A' } as UnsupportedNode] 
    };
  }
};

const INDENT_SPACE = '  '; // Two spaces for indentation

const generateCodeFromASTNode = (astNode: ASTNode, indentLevel = 0): string => {
  const indent = INDENT_SPACE.repeat(indentLevel);
  let code = '';

  // Add a comment with the visualId (preferred) or diagramNodeId for linking, if available
  if (astNode.visualId || astNode.diagramNodeId) {
    const blockId = astNode.visualId || astNode.diagramNodeId;
    code += `${indent}# Block ID: ${blockId}\n`;
  }

  switch (astNode.type) {
    case 'Program':
      return (astNode as Program).body.map(stmt => generateCodeFromASTNode(stmt, indentLevel)).filter(s => s.trim()).join('\n');
    
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
        const altCode = generateCodeFromASTNode(ifStmt.alternate, indentLevel + 1);
        if (altCode.trim() !== '') {
          code += '\n' + `${indent}else:` + '\n';
          code += altCode;
        }
      }
      return code;

    case 'BlockStatement':
      const block = astNode as BlockStatement;
      if (block.body.length === 0) {
        return `${indent}pass`;
      }
      return block.body.map(stmt => generateCodeFromASTNode(stmt, indentLevel)).filter(s => s.trim()).join('\n');

    case 'PrintStatement':
      const printStmt = astNode as PrintStatement;
      const args = printStmt.arguments.map(arg => generateCodeFromASTNode(arg)).join(', ');
      code += `${indent}print(${args})`;
      return code;

    case 'BreakStatement':
      return `${indent}break`;

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

    case 'SubscriptExpression':
      const sub = astNode as SubscriptExpression;
      return `${generateCodeFromASTNode(sub.object)}[${generateCodeFromASTNode(sub.index)}]`;

    case 'UnsupportedNode':
      const unsupported = astNode as UnsupportedNode;
      const blockId = unsupported.visualId || unsupported.diagramNodeId || 'N/A';
      let comment = `${indent}# Unsupported Block ID: ${blockId} - ${unsupported.reason}`;
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
  const ASTProgram = generatePythonAST(nodes, edges);
  return generateCodeFromASTNode(ASTProgram).trim();
};
