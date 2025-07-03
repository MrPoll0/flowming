import { ExpressionElement } from './ExpressionElement';
import { Variable } from './Variable';
import { IOperator } from './Expression';

// AST Node Definitions
export interface BaseASTNode { type: string; }

export interface LiteralNode extends BaseASTNode {
  type: 'Literal';
  value: any;
  valueType: Variable['type'] | 'unknown';
}

export interface IdentifierNode extends BaseASTNode {
  type: 'Identifier';
  name: string;
  variable: Variable;
}

export interface UnaryOpNode extends BaseASTNode {
  type: 'UnaryOp';
  operator: '!' | '-' | '+';
  operand: ExpressionASTNode;
}

export interface BinaryOpNode extends BaseASTNode {
  type: 'BinaryOp';
  operator: IOperator;
  left: ExpressionASTNode;
  right: ExpressionASTNode;
}

export interface MemberAccessNode extends BaseASTNode {
  type: 'MemberAccess';
  object: IdentifierNode;
  property: ExpressionASTNode;
}

export interface FunctionCallNode extends BaseASTNode {
  type: 'FunctionCall';
  functionName: 'integer' | 'string' | 'float' | 'boolean';
  argument: ExpressionASTNode;
}

export type ExpressionASTNode = LiteralNode | IdentifierNode | UnaryOpNode | BinaryOpNode | FunctionCallNode | MemberAccessNode;

// Parser Implementation
export function buildAST(elements: ExpressionElement[]): ExpressionASTNode {
  let tokens = elements;
  let pos = 0;

  function peek(): ExpressionElement | null {
    return pos < tokens.length ? tokens[pos] : null;
  }

  function next(): ExpressionElement {
    return tokens[pos++];
  }

  function expectOperator(val: string): void {
    const tok = peek();
    if (!tok || tok.value !== val) {
      throw new Error(`Expected '${val}' but got '${tok?.value ?? 'end'}'`);
    }
    pos++;
  }

  function parseLiteral(value: string): LiteralNode {
    const trimmed = value.trim();
    if (trimmed.toLowerCase() === 'true') return { type: 'Literal', value: true, valueType: 'boolean' };
    if (trimmed.toLowerCase() === 'false') return { type: 'Literal', value: false, valueType: 'boolean' };
    if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
      return { type: 'Literal', value: trimmed.slice(1, -1), valueType: 'string' };
    }
    if (!isNaN(Number(trimmed)) && trimmed !== '') {
      const num = Number(trimmed);
      if (Number.isInteger(num)) return { type: 'Literal', value: num, valueType: 'integer' };
      return { type: 'Literal', value: num, valueType: 'float' };
    }
    return { type: 'Literal', value, valueType: 'string' };
  }

  function parseEquality(): ExpressionASTNode {
    let node = parseLogicalOr();
    while (true) {
      const tok = peek();
      if (tok && ['==','!=','>','<','>=','<='].includes(tok.value)) {
        const op = next().value as IOperator;
        const right = parseLogicalOr();
        node = { type: 'BinaryOp', operator: op, left: node, right };
      } else break;
    }
    return node;
  }

  function parseLogicalOr(): ExpressionASTNode {
    let node = parseLogicalAnd();
    while (peek()?.value === '||') {
      next();
      const right = parseLogicalAnd();
      node = { type: 'BinaryOp', operator: '||', left: node, right };
    }
    return node;
  }

  function parseLogicalAnd(): ExpressionASTNode {
    let node = parseAdditive();
    while (peek()?.value === '&&') {
      next();
      const right = parseAdditive();
      node = { type: 'BinaryOp', operator: '&&', left: node, right };
    }
    return node;
  }

  function parseAdditive(): ExpressionASTNode {
    let node = parseMultiplicative();
    while (true) {
      const tok = peek();
      if (tok && (tok.value === '+' || tok.value === '-')) {
        const op = next().value as IOperator;
        const right = parseMultiplicative();
        node = { type: 'BinaryOp', operator: op, left: node, right };
      } else break;
    }
    return node;
  }

  function parseMultiplicative(): ExpressionASTNode {
    let node = parseUnary();
    while (true) {
      const tok = peek();
      if (tok && (tok.value === '*' || tok.value === '/' || tok.value === '%')) {
        const op = next().value as IOperator;
        const right = parseUnary();
        node = { type: 'BinaryOp', operator: op, left: node, right };
      } else break;
    }
    return node;
  }

  function parseUnary(): ExpressionASTNode {
    const tok = peek();
    if (tok && tok.value === '!') {
      next();
      const operand = parseUnary();
      return { type: 'UnaryOp', operator: '!', operand };
    }
    if (tok && tok.value === '-') {
      next();
      const operand = parseUnary();
      return { type: 'UnaryOp', operator: '-', operand };
    }
    if (tok && tok.value === '+') {
      next();
      const operand = parseUnary();
      return { type: 'UnaryOp', operator: '+', operand };
    }
    return parsePrimary();
  }

  function parsePrimary(): ExpressionASTNode {
    const tok = peek();
    if (!tok) throw new Error('Unexpected end of expression');
    if (tok.isLiteral()) {
      next();
      return parseLiteral(tok.value);
    }
    if (tok.isVariable() && tok.variable) {
      const idNode: IdentifierNode = { type: 'Identifier', name: tok.variable.name, variable: tok.variable };
      next(); // Consume identifier token

      if (peek()?.value === '[') {
          if (idNode.variable.type !== 'array') {
              throw new Error(`Variable "${idNode.name}" is not an array and cannot be indexed.`);
          }
          next(); // Consume '['
          const indexExpr = parseEquality();
          expectOperator(']');
          return { type: 'MemberAccess', object: idNode, property: indexExpr };
      }
      
      return idNode;
    }
    if (tok.isFunction()) {
      const fnTok = next();
      const nested = fnTok.nestedExpression;
      if (!nested) throw new Error(`Function '${fnTok.value}' missing nested expression`);
      const argAST = buildAST(nested.rightSide);
      return { type: 'FunctionCall', functionName: fnTok.value as any, argument: argAST };
    }
    if (tok.isOperator() && tok.value === '(') {
      next();
      const node = parseEquality();
      expectOperator(')');
      return node;
    }
    throw new Error(`Unexpected token '${tok.value}'`);
  }

  const ast = parseEquality();
  if (pos < tokens.length) {
    throw new Error(`Unexpected trailing token '${tokens[pos].value}'`);
  }
  return ast;
} 