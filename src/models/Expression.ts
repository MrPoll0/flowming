import { Variable, VariableType, ValueTypeMap } from './Variable';
import { ExpressionElement } from './ExpressionElement';
import { ValuedVariable } from './ValuedVariable';
import { buildAST } from './ExpressionParser';

export const operators = ['+', '-', '*', '/', '!', '%', '&&', '||', '==', '!=', '>', '<', '>=', '<=', '(', ')'];
export type IOperator = typeof operators[number];

export const equalities = ['==', '!=', '>', '<', '>=', '<='];
export type IEquality = typeof equalities[number];

export interface IExpression {
  leftSide: Variable | ExpressionElement[] | undefined;
  rightSide: ExpressionElement[];
  equality?: IEquality;
}

// --- AST Definition ---
interface BaseASTNode {
  type: string;
}

interface LiteralNode extends BaseASTNode {
  type: 'Literal';
  value: any;
  valueType: VariableType | 'unknown';
}

interface IdentifierNode extends BaseASTNode {
  type: 'Identifier';
  name: string;
  variable: Variable;
}

interface UnaryOpNode extends BaseASTNode {
  type: 'UnaryOp';
  operator: '!' | '-' | '+';
  operand: ExpressionASTNode;
}

interface BinaryOpNode extends BaseASTNode {
  type: 'BinaryOp';
  operator: IOperator;
  left: ExpressionASTNode;
  right: ExpressionASTNode;
}

interface FunctionCallNode extends BaseASTNode {
  type: 'FunctionCall';
  functionName: 'integer' | 'string' | 'float' | 'boolean';
  argument: ExpressionASTNode;
}

type ExpressionASTNode = LiteralNode | IdentifierNode | UnaryOpNode | BinaryOpNode | FunctionCallNode;


export class Expression implements IExpression {
  leftSide: Variable | ExpressionElement[] | undefined;
  rightSide: ExpressionElement[];
  equality?: IEquality;

  constructor(leftSide: Variable | ExpressionElement[] | undefined, rightSide: ExpressionElement[] = [], equality?: IEquality) {
    if(leftSide != undefined){ 
      if (equality && (!Array.isArray(leftSide) || leftSide.some(e => !(e instanceof ExpressionElement)))) {
        throw new Error('leftSide must be an array of ExpressionElement instances');
      }
      if (!equality && !(leftSide instanceof Variable)) {
        throw new Error('leftSide must be a Variable instance');
      }
    }
    if (!Array.isArray(rightSide)) {
      throw new Error('rightSide must be an array');
    }
    if (rightSide.some(e => !(e instanceof ExpressionElement))) {
      throw new Error('rightSide must contain only ExpressionElement instances');
    }
    if (equality && !equalities.includes(equality)) {
      throw new Error(`Invalid equality: ${equality}`);
    }
    
    this.leftSide = leftSide;
    this.rightSide = rightSide;
    if (equality) {
      this.equality = equality;
    }
  }

  /**
   * Evaluates the expression using an AST-based approach with strong type checking.
   * @param exprElements The elements of the expression to evaluate.
   * @param exprTyping The expected result type, used for type coercion if necessary.
   * @param currentValuedVariables The current state of variables in the flow.
   * @returns The calculated value.
   */
  calculateValue(
    exprElements: ExpressionElement[],
    exprTyping: VariableType | null,
    currentValuedVariables: ValuedVariable<VariableType>[]
  ): ValueTypeMap[VariableType] {
    try {
      if (exprElements.length === 0) {
        throw new Error('Expression is empty and cannot be evaluated.');
      }

      const ast = buildAST(exprElements);
      const result = this.#evaluateAST(ast, currentValuedVariables);

      // Final type coercion based on the left-side variable type (if specified)
      if (exprTyping) {
        if (result.type === 'unknown') {
          throw new Error('Cannot assign value from an expression with unknown type.');
        }
        
        if (exprTyping === result.type) {
          return result.value;
        }

        // Allow safe coercions: integer to float, float to integer (anything else requires explicit conversion)
        if (exprTyping === 'float' && result.type === 'integer') {
          return Number(result.value);
        }
        if (exprTyping === 'integer' && result.type === 'float') {
          return Math.floor(Number(result.value));
        }
        
        throw new Error(`Type mismatch: Cannot assign a value of type '${result.type}' to a variable of type '${exprTyping}'.`);
      }

      return result.value;
    } catch (e) {
        throw e;
    }
  }

  /**
   * Recursively evaluates an AST node with strong type checking.
   * @param node The AST node to evaluate.
   * @param currentValuedVariables The current state of variables.
   * @returns An object containing the calculated value and its type.
   */
  #evaluateAST(node: ExpressionASTNode, currentValuedVariables: ValuedVariable<VariableType>[]): { value: any, type: VariableType | 'unknown' } {
    switch (node.type) {
      case 'Literal':
        return { value: node.value, type: node.valueType };

      case 'Identifier':
        const v = currentValuedVariables.find(vv => vv.id === node.variable.id);
        if (!v) throw new Error(`Variable "${node.name}" does not have a value assigned.`);
        return { value: v.value, type: v.type };

      case 'FunctionCall':
        const arg = this.#evaluateAST(node.argument, currentValuedVariables);
        switch (node.functionName) {
            case 'integer':
                if (arg.type === 'integer') return { value: arg.value, type: 'integer' };
                const numInt = parseFloat(arg.value);
                if (isNaN(numInt)) throw new Error(`Cannot convert '${arg.value}' to integer.`);
                return { value: Math.floor(numInt), type: 'integer' };
            case 'float':
                if (arg.type === 'float') return { value: arg.value, type: 'float' };
                const numFloat = parseFloat(arg.value);
                if (isNaN(numFloat)) throw new Error(`Cannot convert '${arg.value}' to float.`);
                return { value: numFloat, type: 'float' };
            case 'string':
                return { value: String(arg.value), type: 'string' };
            case 'boolean':
                if (arg.type === 'boolean') return { value: arg.value, type: 'boolean' };
                if (arg.type === 'string') {
                  // Non-empty truthy/falsy
                  return { value: arg.value !== '', type: 'boolean' };
                }
                if (arg.type === 'integer' || arg.type === 'float') {
                  // 0 is false, everything else is true
                  return { value: arg.value !== 0, type: 'boolean' };
                }
                throw new Error(`Cannot convert '${arg.value}' of type ${arg.type} to boolean.`);
            default: throw new Error(`Unknown function: ${node.functionName}`);
        }

      case 'UnaryOp':
        const operand = this.#evaluateAST(node.operand, currentValuedVariables);
        if (node.operator === '!') {
          if (operand.type !== 'boolean') throw new Error(`Logical NOT operator "!" can only be applied to booleans, not ${operand.type}.`);
          return { value: !operand.value, type: 'boolean' };
        }
        if (node.operator === '-') {
          if (operand.type !== 'integer' && operand.type !== 'float') throw new Error(`Unary minus operator "-" can only be applied to numbers, not ${operand.type}.`);
          return { value: -operand.value, type: operand.type };
        }
        if (node.operator === '+') {
            if (operand.type !== 'integer' && operand.type !== 'float') throw new Error(`Unary plus operator "+" can only be applied to numbers, not ${operand.type}.`);
            return { value: operand.value, type: operand.type }; // It's a no-op for numbers
        }
        throw new Error(`Unknown unary operator: ${node.operator}`);

      case 'BinaryOp':
        const left = this.#evaluateAST(node.left, currentValuedVariables);
        const right = this.#evaluateAST(node.right, currentValuedVariables);

        switch (node.operator) {
          case '+':
            if (left.type === 'string' && right.type === 'string') {
              return { value: left.value + right.value, type: 'string' };
            }
            if ((left.type === 'integer' || left.type === 'float') && (right.type === 'integer' || right.type === 'float')) {
              const resultType = (left.type === 'float' || right.type === 'float') ? 'float' : 'integer';
              return { value: left.value + right.value, type: resultType };
            }
            throw new Error(`Cannot apply operator "+" to types ${left.type} and ${right.type}.`);
          
          case '-':
          case '*':
          case '/':
          case '%':
            if ((left.type === 'integer' || left.type === 'float') && (right.type === 'integer' || right.type === 'float')) {
              const resultType = (left.type === 'float' || right.type === 'float' || node.operator === '/') ? 'float' : 'integer';
              if (node.operator === '/' && right.value === 0) throw new Error("Division by zero.");
              if (node.operator === '%' && right.value === 0) throw new Error("Modulo by zero.");
              let value;
              if (node.operator === '-') value = left.value - right.value;
              else if (node.operator === '*') value = left.value * right.value;
              else if (node.operator === '/') value = left.value / right.value;
              else value = left.value % right.value;
              return { value, type: resultType };
            }
            throw new Error(`Cannot apply operator "${node.operator}" to types ${left.type} and ${right.type}.`);

          case '&&':
          case '||':
            if (left.type !== 'boolean' || right.type !== 'boolean') {
              throw new Error(`Logical operator "${node.operator}" can only be applied to booleans, not ${left.type} and ${right.type}.`);
            }
            const value = node.operator === '&&' ? left.value && right.value : left.value || right.value;
            return { value, type: 'boolean' };
          
          case '==':
          case '!=':
          case '>':
          case '<':
          case '>=':
          case '<=':
            if (left.type === 'boolean' && right.type === 'boolean' && node.operator !== '==' && node.operator !== '!=') {
                throw new Error(`Cannot apply ordering operator "${node.operator}" to booleans.`);
            }
            if (left.type === 'string' && right.type === 'string') {
                let strRes;
                if (node.operator === '==') strRes = left.value == right.value;
                // Lexicographic comparison
                else if (node.operator === '!=') strRes = left.value != right.value;
                else if (node.operator === '>') strRes = left.value > right.value;
                else if (node.operator === '<') strRes = left.value < right.value;
                else if (node.operator === '>=') strRes = left.value >= right.value;
                else strRes = left.value <= right.value;
                return { value: strRes, type: 'boolean' };
            }
            if (left.type !== right.type) {
              // Allow comparison between integer and float
              if (!((left.type === 'integer' && right.type === 'float') || (left.type === 'float' && right.type === 'integer'))) {
                throw new Error(`Cannot compare values of different types: ${left.type} and ${right.type}.`);
              }
            }
            let res;
            if (node.operator === '==') res = left.value == right.value;
            else if (node.operator === '!=') res = left.value != right.value;
            else if (node.operator === '>') res = left.value > right.value;
            else if (node.operator === '<') res = left.value < right.value;
            else if (node.operator === '>=') res = left.value >= right.value;
            else res = left.value <= right.value;
            return { value: res, type: 'boolean' };

          default:
            throw new Error(`Unsupported binary operator: ${node.operator}`);
        }
    }
    throw new Error(`Unknown AST node type: ${(node as any).type}`);
  }

  /**
   * Parses the expression and returns a new ValuedVariable with the leftSide variable
   * and the calculated value from the expression and the current values for variables
   */
  assignValue(currentValuedVariables: ValuedVariable<VariableType>[]): ValuedVariable<VariableType> {
    if (!(this.leftSide instanceof Variable)) throw new Error('leftSide must be a Variable instance');

    const value = this.calculateValue(this.rightSide, this.leftSide.type, currentValuedVariables);
    return new ValuedVariable(this.leftSide.id, this.leftSide.type, this.leftSide.name, this.leftSide.nodeId, value);
  }

  /**
   * Evaluates the expression and returns a boolean value
   */
  evaluate(currentValuedVariables: ValuedVariable<VariableType>[]): boolean {
    if (!this.equality) {
        console.warn('Expression must have an equality operator for evaluation.');
        return false;
    };
    if (!Array.isArray(this.leftSide)) {
        console.warn('leftSide must be an ExpressionElement array for evaluation.');
        return false;
    }

    try {
        if ((this.leftSide as ExpressionElement[]).length === 0 || this.rightSide.length === 0) {
            throw new Error('Conditional expression sides cannot be empty.');
        }

        const leftAst = buildAST(this.leftSide as ExpressionElement[]);
        const rightAst = buildAST(this.rightSide);
        
        const leftResult = this.#evaluateAST(leftAst, currentValuedVariables);
        const rightResult = this.#evaluateAST(rightAst, currentValuedVariables);

        if (leftResult.type === 'boolean' && rightResult.type === 'boolean' && this.equality !== '==' && this.equality !== '!=') {
            throw new Error(`Cannot apply ordering operator "${this.equality}" to booleans.`);
        }

        if (leftResult.type !== rightResult.type) {
            // Allow comparison between integer and float
            if (!((leftResult.type === 'integer' && rightResult.type === 'float') || (leftResult.type === 'float' && rightResult.type === 'integer'))) {
                throw new Error(`Cannot compare values of different types: ${leftResult.type} and ${rightResult.type}.`);
            }
        }

        switch (this.equality) {
          case '==': return leftResult.value == rightResult.value;
          case '!=': return leftResult.value != rightResult.value;
          case '>': return leftResult.value > rightResult.value;
          case '<': return leftResult.value < rightResult.value;
          case '>=': return leftResult.value >= rightResult.value;
          case '<=': return leftResult.value <= rightResult.value;
          default:
            throw new Error(`Unsupported equality operator: ${this.equality}`);
        }
    } catch (e) {
        throw e;
    }
  }

  /**
   * Creates a string representation of the expression
   */
  toString(): string {
    const leftSideStr = Array.isArray(this.leftSide) 
      ? this.leftSide.map(e => e.toString()).join(' ')
      : this.leftSide?.toString();

    if(this.leftSide != undefined){ 
      return `${leftSideStr} ${this.equality ? this.equality : '='} ${this.rightSide.map(e => e.toString()).join(' ')}`;
    }
      
    return `${this.rightSide.map(e => e.toString()).join(' ')}`;
  }

  /**
   * Clones the expression
   */
  clone(): Expression {
    let cloneLeftSide: Variable | ExpressionElement[] | undefined = undefined;
    if(this.leftSide != undefined){ 
      cloneLeftSide = this.leftSide instanceof Variable ? this.leftSide.clone() : this.leftSide?.map(e => e.clone());
    }
    return new Expression(cloneLeftSide, this.rightSide.map(e => e.clone()), this.equality);
  }

  /**
   * Adds an element to the expression
   */
  addElement(element: ExpressionElement): void {
    this.rightSide.push(element);
  }

  /**
   * Removes an element from the expression by id
   */
  removeElement(id: string): void {
    const filterRecursive = (elements: ExpressionElement[]): ExpressionElement[] => {
      if (!elements) return [];
      return elements.filter(e => {
        if (e.id === id) {
          return false;
        }
        if (e.isFunction() && e.nestedExpression) {
          e.nestedExpression.removeElement(id);
        }
        return true;
      });
    };

    if (Array.isArray(this.leftSide)) {
      this.leftSide = filterRecursive(this.leftSide as ExpressionElement[]);
    }
    this.rightSide = filterRecursive(this.rightSide);
  }

  /**
   * Inserts an element at a specific position
   */
  insertElementAt(element: ExpressionElement, index: number): void {
    this.rightSide.splice(index, 0, element);
  }

  /**
   * Updates the variable in the leftSide of the expression
   */
  updateLeftSide(variable: Variable): void {
    this.leftSide = variable;
  }

  /**
   * Updates the expression with new values
   */
  update(updates: Partial<Expression>): void {
    if (updates.leftSide && this.leftSide != undefined) {
        this.leftSide = updates.leftSide;
    }
    if (updates.rightSide) {
        this.rightSide = updates.rightSide;
    }
  }

  /**
   * Updates the variables in the expression
   */
  updateVariables(variables: Variable[]): void {
    // Update the leftSide variable if it exists in the variable list
    if(this.leftSide != undefined){ 
      if (this.leftSide instanceof Variable) {
        const leftSideVariable = variables.find(v => v.id === (this.leftSide as Variable).id);
        if (!leftSideVariable) {
            // If no left side variable is found, expression is invalid
            // TODO: do not unmount expression when LHS variable deselected or not found (?)
            throw new Error(`Variable with id ${this.leftSide.id} not found`);
        }
        this.leftSide = leftSideVariable;
      } else {
        this.leftSide = this.leftSide?.flatMap(e => {
          if (e.type !== 'variable') return [e];
          const variable = variables.find(v => v.id === e.variable?.id);
          // If no variable is found, delete expression element (by flattening [])
          if (!variable) return [];
          
          const expressionElement = new ExpressionElement(e.id, e.type, variable.name, variable);
          return [expressionElement];
        });
      }
    }

    this.rightSide = this.rightSide.flatMap(e => {
      if (e.type !== 'variable') return [e];
      const variable = variables.find(v => v.id === e.variable?.id);
      // If no variable is found, delete expression element (by flattening [])
      if (!variable) return [];
      
      const expressionElement = new ExpressionElement(e.id, e.type, variable.name, variable);
      return [expressionElement];
    });
  }

  /**
   * Checks if the expression is empty
   */
  isEmpty(): boolean {
    if(this.leftSide != undefined){ 
      if(this.equality) {
        return (this.leftSide as ExpressionElement[]).length === 0 && this.rightSide.length === 0;
      }
      return !(this.leftSide as Variable) && this.rightSide.length === 0;
    }

    return this.rightSide.length === 0;
  }

  /**
   * Creates an object representation of the expression
   */
  toObject() {
    return {
      leftSide: this.leftSide instanceof Variable ? this.leftSide.toObject() : this.leftSide != undefined ? this.leftSide?.map(e => e.toObject()) : undefined,
      rightSide: this.rightSide.map(e => e.toObject()),
      equality: this.equality
    };
  }

  /**
   * Creates an Expression from a plain object
   */
  static fromObject(obj: IExpression): Expression {
    const leftSide = obj.equality ? (obj.leftSide as ExpressionElement[]).map(e => ExpressionElement.fromObject(e)) : obj.leftSide != undefined ? Variable.fromObject(obj.leftSide as Variable) : undefined;
    const rightSide = obj.rightSide.map(e => ExpressionElement.fromObject(e));
    const equality = obj.equality;
    return new Expression(leftSide, rightSide, equality);
  }
}