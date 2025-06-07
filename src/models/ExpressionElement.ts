import { IVariable, Variable } from './Variable';
import { Expression } from './Expression';

export type ExpressionElementType = 'variable' | 'operator' | 'literal' | 'function';

export interface IExpressionElement {
  id: string;
  type: ExpressionElementType;
  value: string;
  variable?: IVariable;
  nestedExpression?: any;
}

export class ExpressionElement implements IExpressionElement {
  id: string;
  type: ExpressionElementType;
  value: string;
  variable?: Variable;
  nestedExpression?: Expression;

  constructor(
    id: string,
    type: ExpressionElementType,
    value: string,
    variableOrNested?: Variable | Expression
  ) {
    this.id = id;
    this.type = type;
    this.value = value;
    if (type === 'variable' && variableOrNested instanceof Variable) {
      this.variable = variableOrNested;
      this.value = variableOrNested.name;
    } else if (type === 'function' && variableOrNested instanceof Expression) {
      this.nestedExpression = variableOrNested;
    }
  }

  /**
   * Sets the associated variable for this element
   */
  setVariable(variable: Variable): void {
    if (this.type !== 'variable') {
      throw new Error('Cannot set variable on non-variable element');
    }
    this.variable = variable;
    this.value = variable.name;
  }

  /**
   * Creates a string representation of the element
   */
  toString(): string {
    if (this.isVariable() && this.variable) {
      return this.variable.toString();
    }
    if (this.isFunction()) {
      return `${this.value}(${this.nestedExpression?.toString()})`;
    }
    return this.value;
  }

  /**
   * Check if this element is a variable
   */
  isVariable(): boolean {
    return this.type === 'variable';
  }

  /**
   * Check if this element is an operator
   */
  isOperator(): boolean {
    return this.type === 'operator';
  }

  /**
   * Check if this element is a literal
   */
  isLiteral(): boolean {
    return this.type === 'literal';
  }

  /**
   * Check if this element is a function call
   */
  isFunction(): boolean {
    return this.type === 'function';
  }

  /**
   * Clones the expression element
   */
  clone(): ExpressionElement {
    const cloned = new ExpressionElement(
      this.id,
      this.type,
      this.value,
      this.type === 'variable' ? this.variable : this.type === 'function' ? this.nestedExpression?.clone() : undefined
    );
    if (this.type === 'function' && this.nestedExpression) {
      cloned.nestedExpression = this.nestedExpression.clone();
    }
    return cloned;
  }

  /**
   * Creates an object representation of the expression element
   */
  toObject(): IExpressionElement {
    return {
      id: this.id, 
      type: this.type, 
      value: this.value, 
      variable: this.variable?.toObject(), 
      nestedExpression: this.nestedExpression?.toObject()
    };
  }

  /**
   * Creates an ExpressionElement from a plain object
   */
  static fromObject(obj: IExpressionElement): ExpressionElement {
    let elem: ExpressionElement;
    if (obj.type === 'function' && obj.nestedExpression) {
      const nested = Expression.fromObject(obj.nestedExpression);
      elem = new ExpressionElement(obj.id, obj.type, obj.value, nested);
    } else {
      elem = new ExpressionElement(
        obj.id,
        obj.type,
        obj.value,
        obj.variable ? Variable.fromObject(obj.variable) : undefined
      );
    }
    return elem;
  }
} 