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

// Define the variable structure
export interface IVariable {
  id: string;
  type: VariableType;
  name: string;
  nodeId: string; // ID of the node that declared this variable
  arraySubtype?: ArraySubtype; // Only applicable when type is 'array'
  arraySize?: number; // Only applicable when type is 'array'
}

export class Variable implements IVariable {
  id: string;
  type: VariableType;
  name: string;
  nodeId: string;
  arraySubtype?: ArraySubtype;
  arraySize?: number;

  constructor(id: string, type: VariableType, name: string, nodeId: string, arraySubtype?: ArraySubtype, arraySize?: number) {
    this.id = id;
    this.type = type;
    this.name = name;
    this.nodeId = nodeId;

    // Ensure array metadata is always valid when the variable is an array
    if (type === 'array') {
      // Fallback to integer subtype if none provided (should not normally happen)
      this.arraySubtype = arraySubtype ?? 'integer';
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
      updates.hasOwnProperty('arraySize') ? updates.arraySize : this.arraySize
    );
  }

  /**
   * Clones the variable
   */
  clone(): Variable {
    return new Variable(this.id, this.type, this.name, this.nodeId, this.arraySubtype, this.arraySize);
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
    return {
      id: this.id, 
      type: this.type, 
      name: this.name, 
      nodeId: this.nodeId,
      arraySubtype: this.arraySubtype,
      arraySize: this.arraySize
    };
  }

  /**
   * Creates a Variable from a plain object
   */
  static fromObject(obj: IVariable): Variable {
    return new Variable(obj.id, obj.type as VariableType, obj.name, obj.nodeId, obj.arraySubtype, obj.arraySize);
  }
}

export type FixedArray<T, N extends number> = { length: N } & T[]; 