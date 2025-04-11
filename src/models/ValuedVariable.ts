import { IVariable, ValueTypeMap, Variable, VariableType } from "./Variable";

export interface IValuedVariable<T extends VariableType> extends IVariable {
    value: ValueTypeMap[T];
}

export class ValuedVariable<T extends VariableType> extends Variable implements IValuedVariable<T> {
    value: ValueTypeMap[T];
    
    constructor(id: string, type: T, name: string, nodeId: string, value: ValueTypeMap[T]) {
        super(id, type, name, nodeId);
        this.value = value;
    }

    /**
     * Creates a string representation of the valued variable
     */
    toString(): string {
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
        }
    }

    /**
     * Creates a ValuedVariable from an object representation
     */
    static fromObject<T extends VariableType>(obj: IValuedVariable<T>): ValuedVariable<T> {
        return new ValuedVariable(obj.id, obj.type as T, obj.name, obj.nodeId, obj.value);
    }

    /**
     * Creates a ValuedVariable from a Variable and a value
     * If value is not provided, it will be initialized with the correct type
     */
    static fromVariable<T extends VariableType>(variable: Variable, value: ValueTypeMap[T] | null): ValuedVariable<T> {
        // If value is provided and not null, use it
        if (value !== null && value !== undefined) {
            return new ValuedVariable(variable.id, variable.type as T, variable.name, variable.nodeId, value);
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
            default:
                console.error(`Unsupported variable type: ${variable.type}`);
                initializedValue = '' as ValueTypeMap[T];
        }
        return new ValuedVariable(variable.id, variable.type as T, variable.name, variable.nodeId, initializedValue);
    }
}