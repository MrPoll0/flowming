import { Variable, VariableType, ValueTypeMap } from './Variable';
import { ExpressionElement } from './ExpressionElement';
import { ValuedVariable } from './ValuedVariable';

export const operators = ['+', '-', '*', '/', '!', '%', '&&', '||', '==', '!=', '>', '<', '>=', '<=', '(', ')'];
export type IOperator = typeof operators[number];

export const equalities = ['==', '!=', '>', '<', '>=', '<='];
export type IEquality = typeof equalities[number];


export interface IExpression {
  leftSide: Variable | ExpressionElement[];
  rightSide: ExpressionElement[];
  equality?: IEquality;
}

export class Expression implements IExpression {
  leftSide: Variable | ExpressionElement[];
  rightSide: ExpressionElement[];
  equality?: IEquality;

  constructor(leftSide: Variable | ExpressionElement[], rightSide: ExpressionElement[] = [], equality?: IEquality) {
    // If expression has equality, then leftSide can be multiple expression element and rightSide too, with an equality in the middle
    // However, if there is no equality, then leftSide must be a Variable and rightSide must be an array of ExpressionElement, with an equal sign in the middle

    if (equality && (!Array.isArray(leftSide) || leftSide.some(e => !(e instanceof ExpressionElement)))) {
      throw new Error('leftSide must be an array of ExpressionElement instances');
    }
    if (!equality && !(leftSide instanceof Variable)) {
      throw new Error('leftSide must be a Variable instance');
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
  calculateValue(currentValuedVariables: ValuedVariable<VariableType>[]): ValueTypeMap[VariableType] {
    if (this.rightSide.length === 0) {
      // Return default value based on the left side variable type
      // TODO: refactor this to not have duplicated code (ValuedVariable)
      // TODO: return error instead?
      if (!(this.leftSide instanceof Variable)) throw new Error('leftSide must be a Variable instance');
      switch (this.leftSide.type) {
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




    for (let i = 0; i < this.rightSide.length; i++) {
      const element = this.rightSide[i];
      
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
        if (!(this.leftSide instanceof Variable)) throw new Error('leftSide must be a Variable instance');
        switch (this.leftSide.type) {
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
            currentValue = this.leftSide instanceof Variable && this.leftSide.type === 'string' 
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
    if (!(this.leftSide instanceof Variable)) throw new Error('leftSide must be a Variable instance');
    switch (this.leftSide.type) {
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

    const value = this.calculateValue(currentValuedVariables);
    return new ValuedVariable(this.leftSide.id, this.leftSide.type, this.leftSide.name, this.leftSide.nodeId, value);
  }

  /**
   * Creates a string representation of the expression
   */
  toString(): string {
    return `${this.leftSide.toString()} ${this.equality ? this.equality : '='} ${this.rightSide.map(e => e.toString()).join(' ')}`;
  }

  /**
   * Clones the expression
   */
  clone(): Expression {
    let cloneLeftSide = this.leftSide instanceof Variable ? this.leftSide.clone() : this.leftSide.map(e => e.clone());
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
    if (updates.leftSide) {
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
    if (this.leftSide instanceof Variable) {
      const leftSideVariable = variables.find(v => v.id === (this.leftSide as Variable).id);
      if (!leftSideVariable) {
          // If no left side variable is found, expression is invalid
          // TODO: do not unmount expression when LHS variable deselected or not found (?)
          throw new Error(`Variable with id ${this.leftSide.id} not found`);
      }
      this.leftSide = leftSideVariable;
    } else {
      this.leftSide = this.leftSide.flatMap(e => {
        if (e.type !== 'variable') return [e];
        const variable = variables.find(v => v.id === e.variable?.id);
        // If no variable is found, delete expression element (by flattening [])
        if (!variable) return [];
        
        const expressionElement = new ExpressionElement(e.id, e.type, variable.name, variable);
        return [expressionElement];
      });
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
   * Creates an object representation of the expression
   */
  toObject() {
    return {
      leftSide: this.leftSide instanceof Variable ? this.leftSide.toObject() : this.leftSide.map(e => e.toObject()),
      rightSide: this.rightSide.map(e => e.toObject()),
      equality: this.equality
    };
  }

  /**
   * Creates an Expression from a plain object
   */
  static fromObject(obj: IExpression): Expression {
    const leftSide = obj.equality ? (obj.leftSide as ExpressionElement[]).map(e => ExpressionElement.fromObject(e)) : Variable.fromObject(obj.leftSide as Variable);
    const rightSide = obj.rightSide.map(e => ExpressionElement.fromObject(e));
    const equality = obj.equality;
    return new Expression(leftSide, rightSide, equality);
  }
} 