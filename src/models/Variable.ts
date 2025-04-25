// Available variable types
export const variableTypes = [
  'string',
  'integer',
  'float',
  'boolean',
  //'array'
] as const;

export type VariableType = typeof variableTypes[number];

export type ValueTypeMap = {
  string: string;
  integer: number;
  float: number;
  boolean: boolean;
  //array: any[];
};

// Define the variable structure
export interface IVariable {
  id: string;
  type: VariableType;
  name: string;
  nodeId: string; // ID of the node that declared this variable
}

export class Variable implements IVariable {
  id: string;
  type: VariableType;
  name: string;
  nodeId: string;

  constructor(id: string, type: VariableType, name: string, nodeId: string) {
    this.id = id;
    this.type = type;
    this.name = name;
    this.nodeId = nodeId;
  }

  /**
   * Creates a string representation of the variable
   */
  toString(): string {
    return this.name;
  }

  /**
   * Returns a string representing the variable declaration
   */
  toDeclarationString(): string {
    return `${this.type} ${this.name}`;
  }

  /**
   * Updates the variable with new values
   */
  update(updates: Partial<Variable>): Variable {
    return new Variable(this.id, 
        updates.type ?? this.type, 
        updates.name ?? this.name, 
        updates.nodeId ?? this.nodeId
    );
  }

  /**
   * Clones the variable
   */
  clone(): Variable {
    return new Variable(this.id, this.type, this.name, this.nodeId);
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
  toObject(): IVariable {
    return {id: this.id, type: this.type, name: this.name, nodeId: this.nodeId};
  }

  /**
   * Creates a Variable from a plain object
   */
  static fromObject(obj: IVariable): Variable {
    return new Variable(obj.id, obj.type as VariableType, obj.name, obj.nodeId);
  }
} 