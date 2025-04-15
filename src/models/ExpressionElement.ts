import { IVariable, Variable } from './Variable';

export type ExpressionElementType = 'variable' | 'operator' | 'literal';

export interface IExpressionElement {
  id: string;
  type: ExpressionElementType;
  value: string;
  variable?: IVariable;
}

export class ExpressionElement implements IExpressionElement {
  id: string;
  type: ExpressionElementType;
  value: string;
  variable?: Variable;

  constructor(id: string, type: ExpressionElementType, value: string, variable?: Variable) {
    this.id = id;
    this.type = type;
    this.value = value;

    if (type === 'variable' && variable) {
      this.variable = variable;
      this.value = variable.name;
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
   * Clones the expression element
   */
  clone(): ExpressionElement {
    return new ExpressionElement(this.id, this.type, this.value, this.variable);
  }

  /**
   * Creates an object representation of the expression element
   */
  toObject(): IExpressionElement {
    return {id: this.id, type: this.type, value: this.value, variable: this.variable?.toObject()};
  }

  /**
   * Creates an ExpressionElement from a plain object
   */
  static fromObject(obj: IExpressionElement): ExpressionElement {
    return new ExpressionElement(obj.id, obj.type, obj.value, obj.variable ? Variable.fromObject(obj.variable) : undefined);
  }
} 