import type { VariableType, ArraySubtype, IExpressionElement } from '.';

export interface IVariable {
  id: string;
  type: VariableType;
  name: string;
  nodeId: string; // ID of the node that declared this variable
  arraySubtype?: ArraySubtype; // Only applicable when type is 'array'
  arraySize?: number; // Only applicable when type is 'array'
  indexExpression?: IExpressionElement[]; // Only applicable when type is 'array'

  // Methods
  toString(): string;
  toDeclarationString(): string;
  update(updates: Partial<IVariable>): IVariable;
  clone(): IVariable;
  isEqual(other: IVariable): boolean;
  toObject(): any;
} 