import { Variable, VariableType, ValueTypeMap } from './Variable';
import { ExpressionElement } from './ExpressionElement';
import { ValuedVariable } from './ValuedVariable';

export const operators = ['+', '-', '*', '/', '!', '%', '&&', '||', '==', '!=', '>', '<', '>=', '<=', '(', ')'];
export type IOperator = typeof operators[number];

export const equalities = ['==', '!=', '>', '<', '>=', '<='];
export type IEquality = typeof equalities[number];


export interface IExpression {
  leftSide: Variable | ExpressionElement[] | undefined;
  rightSide: ExpressionElement[];
  equality?: IEquality;
}

export class Expression implements IExpression {
  leftSide: Variable | ExpressionElement[] | undefined;
  rightSide: ExpressionElement[];
  equality?: IEquality;

  // TODO: add expression type to handle typing well (VariableLHS/RHS, EE[]LHS/RHS, only RHS)

  constructor(leftSide: Variable | ExpressionElement[] | undefined, rightSide: ExpressionElement[] = [], equality?: IEquality) {
    // If expression has equality, then leftSide can be multiple expression element and rightSide too, with an equality in the middle
    // However, if there is no equality, then leftSide must be a Variable and rightSide must be an array of ExpressionElement, with an equal sign in the middle

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
   * Calculates the value of the expression
   */
  calculateValue(exprElements: ExpressionElement[], exprTyping: ValueTypeMap[VariableType] | null, currentValuedVariables: ValuedVariable<VariableType>[]): ValueTypeMap[VariableType] {
    if (exprElements.length === 0) {
      // Return default value based on the left side variable type
      // TODO: refactor this to not have duplicated code (ValuedVariable)
      // TODO: return error instead?

      // TODO: does this work properly?
      switch (exprTyping) {
        case 'string': return '' as ValueTypeMap[VariableType];
        case 'integer': return 0 as ValueTypeMap[VariableType];
        case 'float': return 0.0 as ValueTypeMap[VariableType];
        case 'boolean': return false as ValueTypeMap[VariableType];
        default: return 0 as ValueTypeMap[VariableType];
      }
    }

    // Process the expression elements
    let currentValue: any;
    let currentOperator = '+';





    // TODO: validation (element, operator, element, etc)
    // test1 = + will lead test1 to be undefined (its not a valid type)
    // TODO: proper type validation too (string test1 = + 1 leads to test1 = 1)
    // TODO: also handle correctly parentheses
    // TODO: añadir operador NOT?
    // TODO: is currentValuedVariables being resetted correctly in new starts? (apparently, why?)

    // TODO: now we can do the conditional node (expression parsing will be very similar)
    // also expression editor will be very similar




    for (let i = 0; i < exprElements.length; i++) {
      const element = exprElements[i];
      
      // Get the value of the current element
      let elementValue: any;
      
      if (element.isVariable()) {
        // Get variable value from the current valued variables
        const variable = currentValuedVariables.find(v => v.id === element.variable?.id);
        if (!variable) {
          console.error(`Variable ${element.value} not found in current valued variables`);
          continue; // Skip this element (TODO: throw error, stop execution)
        }
        elementValue = variable.value;
      } else if (element.isLiteral()) {
        // Parse literal value based on the target variable type
        switch (exprTyping) {
          case 'string':
            elementValue = element.value;
            break;
          case 'integer':
            elementValue = parseInt(element.value, 10);
            break;
          case 'float':
            elementValue = parseFloat(element.value);
            break;
          case 'boolean':
            elementValue = element.value.toLowerCase() === 'true';
            break;
          default:
            elementValue = element.value;
        }
      } else if (element.isOperator()) {
        // Store the operator for the next value
        if (operators.includes(element.value)) {
          currentOperator = element.value;
        }
        continue; // Skip to the next element
      }

      // TODO: model for operators to simplify this?

      // Apply the operation
      if (currentValue === undefined) {
        currentValue = elementValue;
      } else {
        // TODO: validation (should e.g. true + false be allowed?)
        // string - string? etc

        switch (currentOperator) {
          case '+':
            currentValue = exprTyping === 'string' 
              ? String(currentValue) + String(elementValue)
              : currentValue + elementValue;
            break;
          case '-':
            currentValue = currentValue - elementValue;
            break;
          case '*':
            currentValue = currentValue * elementValue;
            break;
          case '/':
            currentValue = currentValue / elementValue;
            break;
          case '%':
            currentValue = currentValue % elementValue;
            break;
          case '&&':
            currentValue = currentValue && elementValue;
            break;
          case '||':
            currentValue = currentValue || elementValue;
            break;
          case '==':
            currentValue = currentValue == elementValue;
            break;
          case '!=':
            currentValue = currentValue != elementValue;
            break;
          case '>':
            currentValue = currentValue > elementValue;
            break;
          case '<':
            currentValue = currentValue < elementValue;
            break;
          case '>=':
            currentValue = currentValue >= elementValue;
            break;
          case '<=':
            currentValue = currentValue <= elementValue;
            break;
          default:
            console.warn(`Unsupported operator: ${currentOperator}`);
        }
      }
    }

    // TODO: this will return NaN or similar in some cases
    // (e.g. 1 + true)

    // Ensure the calculated value matches the expected type
    switch (exprTyping) {
      case 'string':
        return String(currentValue) as ValueTypeMap[VariableType];
      case 'integer':
        return Math.floor(Number(currentValue)) as ValueTypeMap[VariableType];
      case 'float':
        return Number(currentValue) as ValueTypeMap[VariableType];
      case 'boolean':
        return Boolean(currentValue) as ValueTypeMap[VariableType];
      default:
        return currentValue as ValueTypeMap[VariableType];
    }
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
    if (!this.equality) throw new Error('Expression must have an equality operator');
    if (!Array.isArray(this.leftSide) || !(this.leftSide[0] instanceof ExpressionElement)) throw new Error('leftSide must be an ExpressionElement array or a Variable instance');

    // TODO: typing? (consensuated? just not used here?)
    const leftSideValue = this.calculateValue((this.leftSide as ExpressionElement[]), null, currentValuedVariables);
    const rightSideValue = this.calculateValue(this.rightSide, null, currentValuedVariables);

    switch (this.equality) {
      case '==':
        return leftSideValue == rightSideValue;
      case '!=':
        return leftSideValue != rightSideValue;
      case '>':
        return leftSideValue > rightSideValue;
      case '<':
        return leftSideValue < rightSideValue;
      case '>=':
        return leftSideValue >= rightSideValue;
      case '<=':
        return leftSideValue <= rightSideValue;
      default:
        throw new Error(`Unsupported equality operator: ${this.equality}`);
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
    this.rightSide = this.rightSide.filter(e => e.id !== id);
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