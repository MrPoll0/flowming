import type { IVariable } from './IVariable';
import { ExpressionElement } from './ExpressionElement';
import type { IExpressionElement } from './IExpressionElement';

// Available variable types
export const variableTypes = [
  'integer',
  'string',
  'float',
  'boolean',
  'array'
] as const;

export type VariableType = typeof variableTypes[number];

// Available array subtypes (excluding array itself to prevent nested arrays)
export const arraySubtypes = [
  'integer',
  'string', 
  'float',
  'boolean'
] as const;

export type ArraySubtype = typeof arraySubtypes[number];

export type ValueTypeMap = {
  string: string;
  integer: number;
  float: number;
  boolean: boolean;
  array: any[];
};

export class Variable implements IVariable {
  id: string;
  type: VariableType;
  name: string;
  nodeId: string;
  arraySubtype?: ArraySubtype;
  arraySize?: number;
  indexExpression?: IExpressionElement[];

  constructor(id: string, type: VariableType, name: string, nodeId: string, arraySubtype?: ArraySubtype, arraySize?: number, indexExpression?: IExpressionElement[]) {
    this.id = id;
    this.type = type;
    this.name = name;
    this.nodeId = nodeId;
    this.indexExpression = indexExpression;

    // Ensure array metadata is always valid when the variable is an array
    if (type === 'array') {
      this.arraySubtype = arraySubtype;
      // Enforce a positive, non-zero size. Default to 1 if invalid.
      const validSize = arraySize !== undefined && arraySize >= 1 ? arraySize : 1;
      this.arraySize = validSize;
    } else {
      this.arraySubtype = undefined;
      this.arraySize = undefined;
    }
  }

  /**
   * Creates a string representation of the variable
   */
  toString(): string {
    // Render array element access when an index expression exists
    if (this.indexExpression && this.indexExpression.length > 0) {
      // Manually join to avoid circular dependency on Expression.toString()
      const idxExprStr = this.indexExpression.map(e => (e as ExpressionElement).toString()).join(' ');
      return `${this.name}[${idxExprStr}]`;
    }
    return this.name;
  }

  /**
   * Returns a string representing the variable declaration
   */
  toDeclarationString(): string {
    if (this.type === 'array' && this.arraySubtype && this.arraySize !== undefined) {
      return `${this.arraySubtype}[${this.arraySize}] ${this.name}`;
    }
    return `${this.type} ${this.name}`;
  }

  /**
   * Updates the variable with new values
   */
  update(updates: Partial<Variable>): Variable {
    // If changing to array, ensure subtype/size defaults are present and valid
    if (updates.type === 'array') {
      if (updates.arraySubtype === undefined) {
        updates.arraySubtype = this.arraySubtype ?? 'integer';
      }
      if (updates.arraySize === undefined || (typeof updates.arraySize === 'number' && updates.arraySize < 1)) {
        updates.arraySize = this.arraySize && this.arraySize >= 1 ? this.arraySize : 1;
      }
    }
    // When switching away from array, strip array-specific fields
    if (updates.type && updates.type !== 'array') {
      updates.arraySubtype = undefined;
      updates.arraySize = undefined;
    }

    return new Variable(
      this.id,
      updates.type ?? this.type,
      updates.name ?? this.name,
      updates.nodeId ?? this.nodeId,
      updates.hasOwnProperty('arraySubtype') ? updates.arraySubtype : this.arraySubtype,
      updates.hasOwnProperty('arraySize') ? updates.arraySize : this.arraySize,
      updates.hasOwnProperty('indexExpression') ? updates.indexExpression : this.indexExpression
    );
  }

  /**
   * Clones the variable
   */
  clone(): Variable {
    const clonedIndexExpr = this.indexExpression ? this.indexExpression.map(e => e.clone()) : undefined;
    return new Variable(this.id, this.type, this.name, this.nodeId, this.arraySubtype, this.arraySize, clonedIndexExpr);
  }

  /**
   * Checks if the variable is equal to another variable
   */
  isEqual(other: Variable): boolean {
    return this.id === other.id;
  }

  /**
   * Creates an object representation of the variable
   */
  toObject(): any {
    return {
      id: this.id, 
      type: this.type, 
      name: this.name, 
      nodeId: this.nodeId,
      arraySubtype: this.arraySubtype,
      arraySize: this.arraySize,
      indexExpression: this.indexExpression ? this.indexExpression.map(e => e.toObject()) : undefined,
    };
  }

  /**
   * Creates a Variable from a plain object
   */
  static fromObject(obj: IVariable): Variable {
    const idxExpr = obj.indexExpression
      ? obj.indexExpression.map(e => ExpressionElement.fromObject(e))
      : undefined;
    return new Variable(obj.id, obj.type as VariableType, obj.name, obj.nodeId, obj.arraySubtype, obj.arraySize, idxExpr);
  }

  /**
   * Checks if a variable name is valid (no reserved characters like '[' or ']').
   */
  static isValidName(name: string): boolean {
    return !(/\[|\]/.test(name));
  }
}

export type FixedArray<T, N extends number> = { length: N } & T[]; 