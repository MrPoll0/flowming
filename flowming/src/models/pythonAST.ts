// Base AST Node
export interface ASTNode {
  type: string;
  // Optional: for linking generated code to diagram nodes
  diagramNodeId?: string; 
  // Optional: user-friendly visual block ID
  visualId?: string;
}

// Statements
export interface Statement extends ASTNode {}

export interface Expression extends ASTNode {}

export interface AssignmentStatement extends Statement {
  type: 'AssignmentStatement';
  target: Identifier;
  value: Expression;
}

export interface ExpressionStatement extends Statement {
  type: 'ExpressionStatement';
  expression: Expression;
}

export interface IfStatement extends Statement {
  type: 'IfStatement';
  test: Expression;
  consequent: BlockStatement;
  alternate?: BlockStatement; // for else/elif
}

export interface WhileStatement extends Statement {
  type: 'WhileStatement';
  test: Expression;
  body: BlockStatement;
}

export interface BlockStatement extends Statement {
  type: 'BlockStatement';
  body: Statement[];
}

export interface FunctionDeclaration extends Statement {
  type: 'FunctionDeclaration';
  name: Identifier;
  params: Identifier[];
  body: BlockStatement;
}

export interface ReturnStatement extends Statement {
    type: 'ReturnStatement';
    argument?: Expression;
}

export interface BreakStatement extends Statement {
    type: 'BreakStatement';
}

// Expressions
export interface Identifier extends Expression {
  type: 'Identifier';
  name: string;
}

export interface Literal extends Expression {
  type: 'Literal';
  value: string | number | boolean | null;
  raw?: string; // e.g., "'hello'" for a string literal
}

export interface BinaryExpression extends Expression {
  type: 'BinaryExpression';
  operator: string; // e.g., '+', '-', '*', '/', '==', '!=', '<', '>', etc.
  left: Expression;
  right: Expression;
}

export interface CallExpression extends Expression {
  type: 'CallExpression';
  callee: Identifier; // For now, simple function calls
  arguments: Expression[];
}

// arr[index]
export interface SubscriptExpression extends Expression {
  type: 'SubscriptExpression';
  object: Identifier;
  index: Expression;
}

// Special node for print (Python-specific convenience)
export interface PrintStatement extends Statement {
  type: 'PrintStatement';
  arguments: Expression[];
}

// Placeholder for unsupported nodes
export interface UnsupportedNode extends ASTNode {
  type: 'UnsupportedNode';
  originalNodeType?: string;
  reason: string;
}

// Represents the whole program
export interface Program extends ASTNode {
  type: 'Program';
  body: Statement[];
} 