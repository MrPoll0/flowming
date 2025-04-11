export type ExpressionElementType = 'variable' | 'operator' | 'literal';

export interface IExpressionElement {
  id: string;
  type: ExpressionElementType;
  value: string;
  variableId?: string;
}

export class ExpressionElement implements IExpressionElement {
  id: string;
  type: ExpressionElementType;
  value: string;
  variableId?: string;

  constructor(id: string, type: ExpressionElementType, value: string, variableId?: string) {
    this.id = id;
    this.type = type;
    this.value = value;
    this.variableId = variableId;
  }

  /**
   * Creates a string representation of the element
   */
  toString(): string {
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
    return new ExpressionElement(this.id, this.type, this.value, this.variableId);
  }

  /**
   * Creates an object representation of the expression element
   */
  toObject(): IExpressionElement {
    return {id: this.id, type: this.type, value: this.value, variableId: this.variableId};
  }

  /**
   * Creates an ExpressionElement from a plain object
   */
  static fromObject(obj: IExpressionElement): ExpressionElement {
    return new ExpressionElement(obj.id, obj.type, obj.value, obj.variableId);
  }
} 