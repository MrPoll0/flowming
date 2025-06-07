// src/tests/Expression.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Expression } from '../models/Expression';
import { ExpressionElement, ExpressionElementType } from '../models/ExpressionElement';
import { Variable } from '../models/Variable';
import { ValuedVariable } from '../models/ValuedVariable';

// --- Test Setup ---
let idCounter = 0;
const freshId = () => `elem-${idCounter++}`;
beforeEach(() => { idCounter = 0; });

const createElement = (type: ExpressionElementType, value: string, variableOrNested?: Variable | Expression): ExpressionElement => {
    return new ExpressionElement(freshId(), type, value, variableOrNested);
};

const createLiteral = (value: any) => createElement('literal', String(value));
const createOperator = (op: string) => createElement('operator', op);
const createVariableEl = (variable: Variable) => createElement('variable', variable.name, variable);
const createFunctionEl = (name: string, nestedExpr: Expression) => createElement('function', name, nestedExpr);

// Variables for use in tests
const varIntX = new Variable('var-x', 'integer', 'x', 'node-1');
const varFloatA = new Variable('var-a', 'float', 'a', 'node-1');
const varStringS = new Variable('var-s', 'string', 's', 'node-1');
const varBoolB = new Variable('var-b', 'boolean', 'b', 'node-1');

// Valued variables for providing context
const valuedX = new ValuedVariable('var-x', 'integer', 'x', 'node-1', 10);
const valuedA = new ValuedVariable('var-a', 'float', 'a', 'node-1', 3.5);
const valuedS = new ValuedVariable('var-s', 'string', 's', 'node-1', 'test');
const valuedB = new ValuedVariable('var-b', 'boolean', 'b', 'node-1', true);
const valuedVariables = [valuedX, valuedA, valuedS, valuedB];

// Helper to evaluate an expression from elements
const evalExpr = (elements: ExpressionElement[], type: Variable['type'] | null = null, context = valuedVariables) => {
    const expr = new Expression(undefined, elements);
    return expr.calculateValue(elements, type, context);
};

describe('Expression Evaluation', () => {

    describe('Conversion Function Robustness', () => {
        it('should throw when converting an invalid string to integer', () => {
            const expr = new Expression(undefined, [createFunctionEl('integer', new Expression(undefined, [createLiteral("'hello'")]))]);
            expect(() => evalExpr(expr.rightSide)).toThrow("Cannot convert 'hello' to integer.");
        });

        it('should truncate float string when converting to integer', () => {
            const expr = new Expression(undefined, [createFunctionEl('integer', new Expression(undefined, [createLiteral("'3.9'")]))]);
            expect(evalExpr(expr.rightSide)).toBe(3);
        });

        it('should convert a valid number string to float', () => {
            const expr = new Expression(undefined, [createFunctionEl('float', new Expression(undefined, [createLiteral("'7.1'")]))]);
            expect(evalExpr(expr.rightSide)).toBe(7.1);
        });

        it('should convert any non-empty string to true', () => {
            const expr = new Expression(undefined, [createFunctionEl('boolean', new Expression(undefined, [createLiteral("'text'")]))]);
            expect(evalExpr(expr.rightSide)).toBe(true);
        });

        it('should convert an empty string to false', () => {
            const expr = new Expression(undefined, [createFunctionEl('boolean', new Expression(undefined, [createLiteral("''")]))]);
            expect(evalExpr(expr.rightSide)).toBe(false);
        });

        it('should correctly convert numbers 1 and 0 to boolean', () => {
            const expr1 = new Expression(undefined, [createFunctionEl('boolean', new Expression(undefined, [createLiteral(1)]))]);
            expect(evalExpr(expr1.rightSide)).toBe(true);
            const expr0 = new Expression(undefined, [createFunctionEl('boolean', new Expression(undefined, [createLiteral(0)]))]);
            expect(evalExpr(expr0.rightSide)).toBe(false);
        });

        it('should convert any non-zero number to true', () => {
            const expr123 = new Expression(undefined, [createFunctionEl('boolean', new Expression(undefined, [createLiteral(123)]))]);
            expect(evalExpr(expr123.rightSide)).toBe(true);
            const exprNeg = new Expression(undefined, [createFunctionEl('boolean', new Expression(undefined, [createLiteral(-1)]))]);
            expect(evalExpr(exprNeg.rightSide)).toBe(true);
            const exprFloat = new Expression(undefined, [createFunctionEl('boolean', new Expression(undefined, [createLiteral(3.14)]))]);
            expect(evalExpr(exprFloat.rightSide)).toBe(true);
        });
    });

    describe('Arithmetic and Edge Cases', () => {
        it('should throw on division by zero', () => {
            const expr = new Expression(undefined, [createLiteral(10), createOperator('/'), createLiteral(0)]);
            expect(() => evalExpr(expr.rightSide)).toThrow('Division by zero.');
        });

        it('should throw on modulo by zero', () => {
            const expr = new Expression(undefined, [createLiteral(10), createOperator('%'), createLiteral(0)]);
            expect(() => evalExpr(expr.rightSide)).toThrow('Modulo by zero.');
        });

        it('should handle unary minus', () => {
            const expr = new Expression(undefined, [createOperator('-'), createLiteral(5)]);
            expect(evalExpr(expr.rightSide)).toBe(-5);
        });

        it('should handle unary plus as a no-op for numbers', () => {
            const expr = new Expression(undefined, [createOperator('+'), createLiteral(10)]);
            expect(evalExpr(expr.rightSide)).toBe(10);
        });

        it('should throw on unary minus for non-numeric types', () => {
            const expr = new Expression(undefined, [createOperator('-'), createLiteral("'text'")]);
            expect(() => evalExpr(expr.rightSide)).toThrow('Unary minus operator "-" can only be applied to numbers, not string.');
        });

        it('should throw on unary plus for non-numeric types', () => {
            const expr = new Expression(undefined, [createOperator('+'), createLiteral("'text'")]);
            expect(() => evalExpr(expr.rightSide)).toThrow('Unary plus operator "+" can only be applied to numbers, not string.');
        });

        it('should demonstrate floating point inaccuracies', () => {
            const elements = [createLiteral(0.1), createOperator('+'), createLiteral(0.2)];
            // Standard floating point behavior: 0.1 + 0.2 !== 0.3
            expect(evalExpr(elements)).not.toBe(0.3);
            expect(evalExpr(elements)).toBeCloseTo(0.3);
        });

        it('should respect parentheses grouping in arithmetic', () => {
            // (2 + 3) * 4 = 20
            const elements = [
                createOperator('('), createLiteral(2), createOperator('+'), createLiteral(3), createOperator(')'),
                createOperator('*'), createLiteral(4),
            ];
            expect(evalExpr(elements)).toBe(20);
        });
    });
    
    describe('Relational Operators', () => {
        it('should correctly compare mixed integer and float types for all operators', () => {
            expect(new Expression([createLiteral(10)], [createLiteral(3.5)], '>').evaluate([])).toBe(true);
            expect(new Expression([createLiteral(10)], [createLiteral(10.0)], '>=').evaluate([])).toBe(true);
            expect(new Expression([createLiteral(3.5)], [createLiteral(10)], '<').evaluate([])).toBe(true);
            expect(new Expression([createLiteral(3.5)], [createLiteral(3.5)], '<=').evaluate([])).toBe(true);
        });

        it('should compare strings lexicographically', () => {
            expect(new Expression([createLiteral("'apple'")], [createLiteral("'banana'")], '<').evaluate([])).toBe(true);
            expect(new Expression([createLiteral("'100'")], [createLiteral("'20'")], '>').evaluate([])).toBe(false); // '1' < '2'
        });

        it('should handle case-sensitive string comparison', () => {
            expect(new Expression([createLiteral("'Zebra'")], [createLiteral("'aardvark'")], '>').evaluate([])).toBe(false); // 'Z' < 'a'
        });

        it('should respect parentheses grouping in relational comparisons', () => {
            // (x + 2) * 3 > (a - 1) / 2 => 36 > 1.25 => true
            const left = [
                createOperator('('), createVariableEl(varIntX), createOperator('+'), createLiteral(2), createOperator(')'),
                createOperator('*'), createLiteral(3),
            ];
            const right = [
                createOperator('('), createVariableEl(varFloatA), createOperator('-'), createLiteral(1), createOperator(')'),
                createOperator('/'), createLiteral(2),
            ];
            const expr = new Expression(left, right, '>');
            expect(expr.evaluate(valuedVariables)).toBe(true);
        });

        it('should handle complex expressions on both sides of a comparison', () => {
            // (x * 2) > (a + 5) => (10 * 2) > (3.5 + 5) => 20 > 8.5 => true
            const left = [createVariableEl(varIntX), createOperator('*'), createLiteral(2)];
            const right = [createVariableEl(varFloatA), createOperator('+'), createLiteral(5)];
            const expr = new Expression(left, right, '>');
            expect(expr.evaluate(valuedVariables)).toBe(true);
        });

        it('should only allow == and != for booleans', () => {
            const exprEq = new Expression([createLiteral(true)], [createLiteral(true)], '==');
            expect(exprEq.evaluate([])).toBe(true);
            const exprGt = new Expression([createLiteral(true)], [createLiteral(false)], '>');
            expect(() => exprGt.evaluate([])).toThrow('Cannot apply ordering operator ">" to booleans.');
        });
    });

    describe('Logical Operators', () => {
        it('should correctly evaluate all boolean combinations for && and ||', () => {
            expect(evalExpr([createLiteral(true), createOperator('&&'), createLiteral(true)])).toBe(true);
            expect(evalExpr([createLiteral(true), createOperator('&&'), createLiteral(false)])).toBe(false);
            expect(evalExpr([createLiteral(false), createOperator('||'), createLiteral(true)])).toBe(true);
            expect(evalExpr([createLiteral(false), createOperator('||'), createLiteral(false)])).toBe(false);
        });

        it('should handle unary NOT for booleans', () => {
            expect(evalExpr([createOperator('!'), createLiteral(true)])).toBe(false);
            expect(evalExpr([createOperator('!'), createLiteral(false)])).toBe(true);
        });

        it('should throw for logical operator on non-booleans', () => {
            const expr = new Expression(undefined, [createLiteral(1), createOperator('&&'), createLiteral(true)]);
            expect(() => evalExpr(expr.rightSide)).toThrow('Logical operator "&&" can only be applied to booleans, not integer and boolean.');
        });
    });

    describe('Strict Operator Typing', () => {
        it('should throw when subtracting strings', () => {
            const expr = new Expression(undefined, [createLiteral("'text'"), createOperator('-'), createLiteral("'t'")]);
            expect(() => evalExpr(expr.rightSide)).toThrow('Cannot apply operator "-" to types string and string.');
        });

        it('should throw when multiplying a string', () => {
            const expr = new Expression(undefined, [createLiteral("'text'"), createOperator('*'), createLiteral(3)]);
            expect(() => evalExpr(expr.rightSide)).toThrow('Cannot apply operator "*" to types string and integer.');
        });
        
        it('should throw for arithmetic on booleans', () => {
            const expr = new Expression(undefined, [createLiteral(true), createOperator('/'), createLiteral(false)]);
            expect(() => evalExpr(expr.rightSide)).toThrow('Cannot apply operator "/" to types boolean and boolean.');
        });
    });

    describe('String and Whitespace Handling', () => {
        it('should preserve whitespace in string literals', () => {
            const expr = new Expression(undefined, [createLiteral("'  hello  '")]);
            expect(evalExpr(expr.rightSide)).toBe('  hello  ');
        });
        
        it('should handle empty string in concatenation', () => {
            const expr = new Expression(undefined, [createLiteral("'hello'"), createOperator('+'), createLiteral("''")]);
            expect(evalExpr(expr.rightSide)).toBe('hello');
        });
    });

    describe('Assignment and Context', () => {
        it('should throw when a variable is not in the evaluation context', () => {
            const varUnbound = new Variable('var-y', 'integer', 'y', 'node-2');
            const expr = new Expression(undefined, [createVariableEl(varUnbound)]);
            expect(() => evalExpr(expr.rightSide, null, [])).toThrow('Variable "y" does not have a value assigned.');
        });

        it('should truncate float result if expected type is integer', () => {
            const elements = [createLiteral(10.5), createOperator('+'), createLiteral(3.5)]; // 14.0
            expect(evalExpr(elements, 'integer')).toBe(14);
        });

        it('should promote integer result if expected type is float', () => {
            const elements = [createLiteral(10), createOperator('+'), createLiteral(4)]; // 14
            expect(evalExpr(elements, 'float')).toBe(14.0);
        });
    });
});

describe('Expression.calculateValue() - Core Functionality', () => {
    it('should throw on an empty expression', () => {
        const expr = new Expression(undefined, []);
        expect(() => expr.calculateValue([], null, [])).toThrow('Expression is empty and cannot be evaluated.');
    });

    it('should handle basic arithmetic with operator precedence', () => {
        const elements = [createLiteral(2), createOperator('+'), createLiteral(3), createOperator('*'), createLiteral(4)];
        const expr = new Expression(undefined, elements);
        expect(expr.calculateValue(elements, 'integer', [])).toBe(14);
    });
    
    it('should correctly coerce integer to float in arithmetic', () => {
        const elements = [createVariableEl(varIntX), createOperator('+'), createVariableEl(varFloatA)];
        const expr = new Expression(undefined, elements);
        expect(expr.calculateValue(elements, 'float', valuedVariables)).toBe(13.5);
    });

    it('should handle explicit type conversion using functions', () => {
        const nestedExpr = new Expression(undefined, [createLiteral('3.14')]);
        const funcEl = createFunctionEl('integer', nestedExpr);
        const expr = new Expression(undefined, [funcEl]);
        expect(expr.calculateValue([funcEl], 'integer', [])).toBe(3);
    });

    it('should handle nested type conversions', () => {
        const nestedStringExpr = new Expression(undefined, [createLiteral('3.7')]);
        const stringFuncEl = createFunctionEl('string', nestedStringExpr);
        const nestedFloatExpr = new Expression(undefined, [stringFuncEl]);
        const floatFuncEl = createFunctionEl('float', nestedFloatExpr);
        const nestedIntExpr = new Expression(undefined, [floatFuncEl]);
        const intFuncEl = createFunctionEl('integer', nestedIntExpr);

        const expr = new Expression(undefined, [intFuncEl]);
        expect(expr.calculateValue([intFuncEl], 'integer', [])).toBe(3);
    });
});

describe('Expression.evaluate() - Core Functionality', () => {
    it('should compare a variable with a complex expression', () => {
        const elements = [createLiteral('5'), createOperator('+'), createLiteral('5')];
        const expr = new Expression([createVariableEl(varIntX)], elements, '==');
        expect(expr.evaluate(valuedVariables)).toBe(true);
    });

    it('should correctly compare integer and float values', () => {
        const expr = new Expression([createLiteral('10')], [createLiteral('10.0')], '==');
        expect(expr.evaluate([])).toBe(true);
    });
});

describe('Expression.toString()', () => {
    it('should correctly format a complex conditional expression with a function call', () => {
        const left = [createVariableEl(varIntX), createOperator('+'), createLiteral('5')];
        const nestedExpr = new Expression(undefined, [createVariableEl(varFloatA)]);
        const right = [createFunctionEl('integer', nestedExpr)];
        const expr = new Expression(left, right, '>');
        expect(expr.toString()).toBe('x + 5 > integer(a)');
    });
});

describe('Expression - Strict Type Checking', () => {
    it('should throw error when concatenating string with a number', () => {
        const elements = [createLiteral("'Score: '"), createOperator('+'), createLiteral(10)];
        const expr = new Expression(undefined, elements);
        expect(() => expr.calculateValue(elements, 'string', valuedVariables))
            .toThrow('Cannot apply operator "+" to types string and integer.');
    });

    it('should allow concatenating two strings', () => {
        const elements = [createLiteral("'Hello '"), createOperator('+'), createLiteral("'World'")];
        const expr = new Expression(undefined, elements);
        expect(expr.calculateValue(elements, 'string', valuedVariables)).toBe('Hello World');
    });

    it('should require explicit conversion to concatenate number to string', () => {
        const nestedExpr = new Expression(undefined, [createVariableEl(varIntX)]);
        const funcEl = createFunctionEl('string', nestedExpr);
        const elements = [createLiteral("'Value: '"), createOperator('+'), funcEl];
        const expr = new Expression(undefined, elements);
        expect(expr.calculateValue(elements, 'string', valuedVariables)).toBe('Value: 10');
    });

    it('should throw when assigning a number to a string variable without explicit conversion', () => {
        const elements = [createLiteral(123)];
        const expr = new Expression(varStringS, elements);
        expect(() => expr.assignValue(valuedVariables))
            .toThrow("Type mismatch: Cannot assign a value of type 'integer' to a variable of type 'string'.");
    });
    
    it('should throw using a number in a boolean context for logical AND', () => {
        const elements = [createLiteral(1), createOperator('&&'), createLiteral(true)];
        const expr = new Expression(undefined, elements);
        expect(() => expr.calculateValue(elements, 'boolean', []))
            .toThrow('Logical operator "&&" can only be applied to booleans, not integer and boolean.');
    });

    it('should throw applying logical NOT to a non-boolean', () => {
        const elements = [createOperator('!'), createLiteral(0)];
        const expr = new Expression(undefined, elements);
        expect(() => expr.calculateValue(elements, 'boolean', []))
            .toThrow('Logical NOT operator "!" can only be applied to booleans, not integer.');
    });

    it('should throw when assigning a non-boolean expression to a boolean variable', () => {
        const elements = [createLiteral(1)]; // "truthy" but not a boolean
        const expr = new Expression(varBoolB, elements);
        expect(() => expr.assignValue(valuedVariables))
            .toThrow("Type mismatch: Cannot assign a value of type 'integer' to a variable of type 'boolean'.");
    });

    it('should throw adding a number and a boolean', () => {
        const elements = [createLiteral(5), createOperator('+'), createLiteral(true)];
        const expr = new Expression(undefined, elements);
        expect(() => expr.calculateValue(elements, 'integer', [])).toThrow('Cannot apply operator "+" to types integer and boolean.');
    });

    it('should throw when comparing a number with a boolean', () => {
        const expr = new Expression([createLiteral(1)], [createLiteral(true)], '==');
        expect(() => expr.evaluate([])).toThrow('Cannot compare values of different types: integer and boolean.');
    });
});