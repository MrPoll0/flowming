import { Variable } from './Variable';
import { ExpressionElement } from './ExpressionElement';

export interface IExpression {
  leftSide: Variable;
  rightSide: ExpressionElement[];
}

export class Expression implements IExpression {
  leftSide: Variable;
  rightSide: ExpressionElement[];

  constructor(leftSide: Variable, rightSide: ExpressionElement[] = []) {
    if (!(leftSide instanceof Variable)) {
      throw new Error('leftSide must be a Variable instance');
    }
    if (!Array.isArray(rightSide)) {
      throw new Error('rightSide must be an array');
    }
    if (rightSide.some(e => !(e instanceof ExpressionElement))) {
      throw new Error('rightSide must contain only ExpressionElement instances');
    }
    
    this.leftSide = leftSide;
    this.rightSide = rightSide;
  }

  /**
   * Creates a string representation of the expression
   */
  toString(): string {
    return `${this.leftSide.toString()} = ${this.rightSide.map(e => e.toString()).join(' ')}`;
  }

  /**
   * Clones the expression
   */
  clone(): Expression {
    return new Expression(this.leftSide.clone(), this.rightSide.map(e => e.clone()));
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
    const leftSideVariable = variables.find(v => v.id === this.leftSide.id);
    if (!leftSideVariable) {
        // If no left side variable is found, expression is invalid
        // TODO: do not unmount expression when LHS variable deselected or not found (?)
        throw new Error(`Variable with id ${this.leftSide.id} not found`);
    }
    this.leftSide = leftSideVariable;

    this.rightSide = this.rightSide.flatMap(e => {
      if (e.type !== 'variable') return [e];
      const variable = variables.find(v => v.id === e.variableId);
      // If no variable is found, delete expression element (by flattening [])
      return variable ? [new ExpressionElement(e.id, e.type, variable.name, variable.id)] : [];
    });
  }

  /**
   * Creates an object representation of the expression
   */
  toObject() {
    return {
      leftSide: this.leftSide.toObject(),
      rightSide: this.rightSide.map(e => e.toObject())
    };
  }

  /**
   * Creates an Expression from a plain object
   */
  static fromObject(obj: IExpression): Expression {
    const leftSide = Variable.fromObject(obj.leftSide);
    const rightSide = obj.rightSide.map(e => ExpressionElement.fromObject(e));
    
    return new Expression(leftSide, rightSide);
  }
} 