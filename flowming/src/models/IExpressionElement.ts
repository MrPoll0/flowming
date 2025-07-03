import type { IVariable, ExpressionElementType } from '.';

export interface IExpressionElement {
    id: string;
    type: ExpressionElementType;
    value: string;
    variable?: IVariable;
    nestedExpression?: any;

    // Methods
    setVariable(variable: IVariable): void;
    toString(): string;
    isVariable(): boolean;
    isOperator(): boolean;
    isLiteral(): boolean;
    isFunction(): boolean;
    clone(): IExpressionElement;
    toObject(): any;
} 