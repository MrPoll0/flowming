import { Variable, VariableType, ValueTypeMap, ArraySubtype } from './Variable';
import { ExpressionElement } from './ExpressionElement';
import { ValuedVariable } from './ValuedVariable';
import { buildAST } from './ExpressionParser';
import type { IVariable } from './IVariable';

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

interface MemberAccessNode extends BaseASTNode {
  type: 'MemberAccess';
  object: IdentifierNode;
  property: ExpressionASTNode;
}

interface FunctionCallNode extends BaseASTNode {
  type: 'FunctionCall';
  functionName: 'integer' | 'string' | 'float' | 'boolean';
  argument: ExpressionASTNode;
}

type ExpressionASTNode = LiteralNode | IdentifierNode | UnaryOpNode | BinaryOpNode | FunctionCallNode | MemberAccessNode;


export class Expression implements IExpression {
  leftSide: Variable | ExpressionElement[] | undefined;
  rightSide: ExpressionElement[];
  equality?: IEquality;

  constructor(
    leftSide: Variable | ExpressionElement[] | undefined,
    rightSide: ExpressionElement[] = [],
    equality?: IEquality
  ) {
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
    currentValuedVariables: ValuedVariable<VariableType>[],
    arraySubtype?: ArraySubtype
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

        if (exprTyping === 'array') {
          // Make sure that the result is the correct type for the array subtype
          if (result.type !== arraySubtype) {
            throw new Error(`Type mismatch: Cannot assign a value of type '${result.type}' to a variable of type '${arraySubtype}'.`);
          }
          return result.value;
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

        // If the identifier represents an array element (indexExpression present), evaluate the index and return that element
        if (node.variable.type === 'array' && node.variable.indexExpression && node.variable.indexExpression.length > 0) {
          let idx: number;
          try {
            idx = this.calculateValue(
              node.variable.indexExpression as any,
              'integer',
              currentValuedVariables
            ) as number;
          } catch (err: any) {
            const msg = err?.message ?? '';
            if (msg.includes('Type mismatch')) {
              throw new Error(`Array index for "${node.name}" must be an integer.`);
            }
            // Propagate all other errors untouched
            throw err;
          }
          if (!Number.isInteger(idx)) { // This should never happen, as the index expression is already validated to be an integer in calculateValue
            throw new Error(`Array index for "${node.name}" must be an integer.`);
          }

          const arr = Array.isArray(v.value) ? v.value : [];
          const size = v.arraySize ?? arr.length;
          if (idx < 0 || idx >= size) {
            throw new Error(`Array index ${idx} is out of bounds for "${node.name}" (size ${size}).`);
          }
          const subtype = v.arraySubtype!;
          return { value: arr[idx], type: subtype };
        }

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
    // NOTE: operations between arrays will be always single values, as you must always specify an index for the array
    // This means that operations like concatenation and so on are not allowed between whole arrays
    // So the return value will always be a single value (and we only care for type checking for the subtype)

    // NOTE: calculateValue for array element returns the whole array with the corresponding index modified
    // the variable value holds the whole array (for debugging purposes and future implementations)
    
    if (this.leftSide instanceof Variable) {
      // Array variable assignment requires indexExpression stored in Variable
      if (this.leftSide.type === 'array') {
        if (!this.leftSide.indexExpression || this.leftSide.indexExpression.length === 0) {
          throw new Error(`Cannot assign directly to array variable "${this.leftSide.name}". Use array index access instead (e.g., ${this.leftSide.name}[index] = value).`);
        }
        return this.#assignArrayValue(this.leftSide, this.leftSide.indexExpression, currentValuedVariables);
      }

      const value = this.calculateValue(this.rightSide, this.leftSide.type, currentValuedVariables, this.leftSide.arraySubtype);
      return new ValuedVariable(
        this.leftSide.id,
        this.leftSide.type,
        this.leftSide.name,
        this.leftSide.nodeId,
        value as Exclude<ValueTypeMap[VariableType], any[]>, // Type is already validated as non-array above
        this.leftSide.arraySubtype,
        this.leftSide.arraySize
      );
    } else {
      throw new Error('leftSide must be a Variable instance');
    }
  }

  /**
   * Handles array index assignments like arr[i-2] = value
   * 
   * Note: This method performs complex AST operations which can take significant time (non-trivial).
   *         (this is not a problem for now)
   * 
   * @param arrayVarDef The array variable definition
   * @param indexExprElements The array access expression elements
   * @param currentValuedVariables The current state of variables
   * @returns The updated ValuedVariable with the modified array
   */
  #assignArrayValue(arrayVarDef: Variable, indexExprElements: ExpressionElement[], currentValuedVariables: ValuedVariable<VariableType>[]): ValuedVariable<VariableType> {
    try {
      // Construct tokens: Variable token, '[' token, ...indexExprElements, ']' token
      const arrayVarElement = new ExpressionElement(crypto.randomUUID(), 'variable', arrayVarDef.name, arrayVarDef);
      const openBracket = new ExpressionElement(crypto.randomUUID(), 'operator', '[');
      const closeBracket = new ExpressionElement(crypto.randomUUID(), 'operator', ']');

      const tokens: ExpressionElement[] = [arrayVarElement, openBracket, ...indexExprElements, closeBracket];
      const leftAST = buildAST(tokens);
      
      if (leftAST.type !== 'MemberAccess') {
        throw new Error('Left side of array assignment must be an array access expression (e.g., arr[index])');
      }

      const memberAccess = leftAST as MemberAccessNode;
      
      // Find (or lazily initialize) the target array variable in the current valued variables set
      let arrayVar = currentValuedVariables.find(vv => vv.id === memberAccess.object.variable.id);

      // If the array variable has not been initialized yet (i.e., it has been declared but no
      // valued-variable instance exists in the current execution scope), create it on the fly so
      // that the assignment can proceed. This situation can arise when the DeclareVariable node
      // has executed but, due to asynchronous propagation of node data, the valued variable did
      // not reach this node before the assignment executes.
      if (!arrayVar) {
        arrayVar = ValuedVariable.fromVariable(memberAccess.object.variable, null);
        currentValuedVariables.push(arrayVar);
      }

      // Validate array structure and constraints
      if (!Array.isArray(arrayVar.value)) {
        throw new Error(`Variable "${memberAccess.object.name}" is not a valid array.`);
      }
      
      const subtype = arrayVar.arraySubtype;
      const arraySize = arrayVar.arraySize;
      if (!subtype) throw new Error(`Array "${memberAccess.object.name}" does not have a defined subtype.`);
      if (!arraySize || arraySize < 1) throw new Error(`Array "${memberAccess.object.name}" does not have a valid size defined.`);

      // Enforce fixed-length constraint
      if (arrayVar.value.length !== arraySize) {
        throw new Error(`Array "${memberAccess.object.name}" has incorrect length: expected ${arraySize}, but got ${arrayVar.value.length}.`);
      }

      // Evaluate the index expression
      const indexResult = this.#evaluateAST(memberAccess.property, currentValuedVariables);
      if (indexResult.type !== 'integer') {
        throw new Error(`Array index for "${memberAccess.object.name}" must be an integer, but got ${indexResult.type}.`);
      }
      const index = indexResult.value;

      // Bounds checking
      if (index < 0 || index >= arraySize) {
        throw new Error(`Array index ${index} is out of bounds for "${memberAccess.object.name}" (fixed size ${arraySize}).`);
      }

      // Evaluate the right side to get the new value
      const newValue = this.calculateValue(this.rightSide, subtype, currentValuedVariables);

      // Create a copy of the array and update the specified index
      const updatedArray = [...arrayVar.value];
      updatedArray[index] = newValue;

      // Return the updated ValuedVariable with the modified array
      return new ValuedVariable(
        arrayVar.id,
        arrayVar.type,
        arrayVar.name,
        arrayVar.nodeId,
        updatedArray,
        arrayVar.arraySubtype,
        arrayVar.arraySize
      );
    } catch (e) {
      throw e;
    }
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
   * Finds an element by its ID recursively in the expression
   */
  findElement(id: string): ExpressionElement | undefined {
    for (const element of this.rightSide) {
      if (element.id === id) {
        return element;
      }
      if (element.isFunction() && element.nestedExpression) {
        const found = element.nestedExpression.findElement(id);
        if (found) {
          return found;
        }
      }
    }
    return undefined;
  }

  /**
   * Adds an element to the right side of the expression
   */
  addElement(element: ExpressionElement): Expression {
    this.rightSide.push(element);
    return this;
  }

  /**
   * Removes an element from the right side of the expression
   */
  removeElement(id: string): Expression {
    // Recursively remove the element if it exists either on the top level or inside nested function calls
    this.rightSide = this.rightSide.flatMap(e => {
      // If this element matches the id, remove it by filtering it out
      if (e.id === id) {
        return [];
      }

      // If this is a function element, delegate the removal to its nested expression
      if (e.isFunction() && e.nestedExpression) {
        e.nestedExpression.removeElement(id);
      }

      return [e];
    });

    return this;
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
    // Helper to update ExpressionElement lists based on current variable set, removing missing vars
    const processElements = (elements: ExpressionElement[]): ExpressionElement[] => {
      return elements.flatMap(elem => {
        if (elem.type !== 'variable') return [elem];
        const vMatch = variables.find(vv => vv.id === elem.variable?.id);
        if (!vMatch) return []; // Variable deleted -> remove element
        const elemVarClone = vMatch.clone();
        if (elem.variable?.indexExpression && elemVarClone.type === 'array') {
          elemVarClone.indexExpression = processElements(elem.variable.indexExpression as ExpressionElement[]);
        }
        if (elem.variable?.indexExpression && (!elemVarClone.indexExpression || elemVarClone.indexExpression.length === 0)) {
          return []; // index expression emptied -> remove the variable element entirely
        }
        return [new ExpressionElement(elem.id, elem.type, elemVarClone.toString(), elemVarClone)];
      });
    };

    // Update the leftSide variable if it exists in the variable list
    if (this.leftSide != undefined) {
      if (this.leftSide instanceof Variable) {
        const existingIndexExpr = this.leftSide.indexExpression;
        const leftSideVariable = variables.find(v => v.id === (this.leftSide as Variable).id);
        if (!leftSideVariable) {
          // If no left side variable is found, expression is invalid
          // TODO: do not unmount expression when LHS variable deselected or not found (?)
          throw new Error(`Variable with id ${this.leftSide.id} not found`);
        }

        // Preserve array index expression (if any) when replacing the variable reference.
        const updatedVar = leftSideVariable.clone();
        if (existingIndexExpr && updatedVar.type === 'array') {
          updatedVar.indexExpression = existingIndexExpr;
        }
        this.leftSide = updatedVar;
      } else {
        this.leftSide = this.leftSide?.flatMap(e => {
          if (e.type !== 'variable') return [e];
          const variable = variables.find(v => v.id === e.variable?.id);
          // If no variable is found, delete expression element (by flattening [])
          if (!variable) return [];
          
          // Preserve indexExpression if present
          const updatedVar = variable.clone();
          if (e.variable?.indexExpression && updatedVar.type === 'array') {
            updatedVar.indexExpression = processElements(e.variable.indexExpression as ExpressionElement[]);
          }
          if (e.variable?.indexExpression && (!updatedVar.indexExpression || updatedVar.indexExpression.length === 0)) {
            // index became empty -> remove entire variable element
            return [];
          }
          const expressionElement = new ExpressionElement(e.id, e.type, updatedVar.toString(), updatedVar);
          return [expressionElement];
        });
      }
    }

    this.rightSide = this.rightSide.flatMap(e => {
      if (e.type !== 'variable') return [e];
      const variable = variables.find(v => v.id === e.variable?.id);
      // If no variable is found, delete expression element (by flattening [])
      if (!variable) return [];
      
      // Preserve indexExpression if present
      const updatedVar = variable.clone();
      if (e.variable?.indexExpression && updatedVar.type === 'array') {
        updatedVar.indexExpression = processElements(e.variable.indexExpression as ExpressionElement[]);
      }
      if (e.variable?.indexExpression && (!updatedVar.indexExpression || updatedVar.indexExpression.length === 0)) {
        // index became empty -> remove entire variable element
        return [];
      }
      const expressionElement = new ExpressionElement(e.id, e.type, updatedVar.toString(), updatedVar);
      return [expressionElement];
    });
  }

  /**
   * Checks if the expression is empty
   */
  isEmpty(): boolean {
    if(this.leftSide != undefined){ 
      if(this.equality) {
        // For conditionals, leftSide is ExpressionElement[]
        return (this.leftSide as ExpressionElement[]).length === 0 && this.rightSide.length === 0;
      }
      // Array access assignment is ExpressionElement[] (?)
      return (!(this.leftSide as Variable) || (this.leftSide as ExpressionElement[]).length === 0) && this.rightSide.length === 0;
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
    let leftSide: Variable | ExpressionElement[] | undefined;
    if (obj.leftSide) {
      if (Array.isArray(obj.leftSide)) {
        leftSide = obj.leftSide.map(e => ExpressionElement.fromObject(e));
      } else {
        leftSide = Variable.fromObject(obj.leftSide as IVariable);
      }
    } else {
      leftSide = undefined;
    }

    const rightSide = obj.rightSide.map(e => ExpressionElement.fromObject(e));
    
    return new Expression(leftSide, rightSide, obj.equality);
  }
}