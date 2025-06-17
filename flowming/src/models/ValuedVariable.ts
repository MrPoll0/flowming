import { IVariable, ValueTypeMap, Variable, VariableType, ArraySubtype } from "./Variable";

export interface IValuedVariable<T extends VariableType> extends IVariable {
    value: ValueTypeMap[T];
}

export class ValuedVariable<T extends VariableType> extends Variable implements IValuedVariable<T> {
    value: ValueTypeMap[T];
    
    constructor(id: string, type: T, name: string, nodeId: string, value: ValueTypeMap[T], arraySubtype?: ArraySubtype, arraySize?: number) {
        super(id, type, name, nodeId, arraySubtype, arraySize);
        this.value = value;
    }

    /**
     * Creates a string representation of the valued variable
     */
    toString(): string {
        if (this.type === 'array' && Array.isArray(this.value)) {
            return `${this.name}: [${this.value.join(', ')}]`;
        }
        return `${this.name}: ${this.value}`;
    }

    /**
     * Creates an object representation of the valued variable
     */
    toObject(): IValuedVariable<T> {
        return {
            id: this.id,
            type: this.type,
            name: this.name,
            nodeId: this.nodeId,
            value: this.value,
            arraySubtype: this.arraySubtype,
            arraySize: this.arraySize,
        }
    }

    /**
     * Creates a ValuedVariable from an object representation
     */
    static fromObject<T extends VariableType>(obj: IValuedVariable<T>): ValuedVariable<T> {
        return new ValuedVariable(obj.id, obj.type as T, obj.name, obj.nodeId, obj.value, obj.arraySubtype as ArraySubtype, obj.arraySize);
    }

    /**
     * Creates a ValuedVariable from a Variable and a value
     * If value is not provided, it will be initialized with the correct type
     */
    static fromVariable<T extends VariableType>(variable: Variable, value: ValueTypeMap[T] | null): ValuedVariable<T> {
        // If value is provided and not null, use it
        if (value !== null && value !== undefined) {
            return new ValuedVariable(variable.id, variable.type as T, variable.name, variable.nodeId, value, variable.arraySubtype, variable.arraySize);
        }
        
        // Initialize value with correct type (TODO: does this make sense? should it be undefined instead?)
        // TODO: be careful with Javascript's type inference and type casting ('', [], etc)
        let initializedValue: ValueTypeMap[T];
        switch (variable.type) {
            case 'string':
                initializedValue = '' as ValueTypeMap[T];
                break;
            case 'integer':
                initializedValue = 0 as ValueTypeMap[T];
                break;
            case 'float':
                initializedValue = 0.0 as ValueTypeMap[T];
                break;
            case 'boolean':
                initializedValue = false as ValueTypeMap[T];
                break;
            case 'array':
                // Initialize array with default values based on subtype and size
                const size = variable.arraySize || 10;
                const subtype = variable.arraySubtype || 'integer';
                let defaultValue: any;
                
                switch (subtype) {
                    case 'string':
                        defaultValue = '';
                        break;
                    case 'integer':
                        defaultValue = 0;
                        break;
                    case 'float':
                        defaultValue = 0.0;
                        break;
                    case 'boolean':
                        defaultValue = false;
                        break;
                    default:
                        defaultValue = 0;
                }
                
                initializedValue = Array(size).fill(defaultValue) as ValueTypeMap[T];
                break;
            default:
                console.error(`Unsupported variable type: ${variable.type}`);
                initializedValue = '' as ValueTypeMap[T];
        }
        return new ValuedVariable(variable.id, variable.type as T, variable.name, variable.nodeId, initializedValue, variable.arraySubtype, variable.arraySize);
    }
}