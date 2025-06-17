// Utility helpers for parsing expression-related strings
// Intended to be used by the panel editors to avoid code duplication

import { Expression, ExpressionElement, Variable } from "@/models";
import { operators } from "@/models/Expression";

// Parses array access literal strings (e.g., "arr[i]" or "arr[0:5]") and returns parts
export function parseArrayAccess(value: string): {
  arrayName: string;
  indexExpression?: string;
  rangeStart?: string;
  rangeEnd?: string;
  isRange: boolean;
} | null {
  const match = value.match(/^(.+?)\[(.+)\]$/);
  if (!match) return null;
  const arrayName = match[1];
  const indexPart = match[2];

  if (indexPart.includes(":")) {
    const [start, end] = indexPart.split(":");
    if (start !== undefined && end !== undefined) {
      return {
        arrayName,
        rangeStart: start.trim(),
        rangeEnd: end.trim(),
        isRange: true,
      };
    }
  }
  return {
    arrayName,
    indexExpression: indexPart.trim(),
    isRange: false,
  };
}

// Converts a raw string expression back into an Expression instance
// Requires the current list of variables to resolve identifiers
export function parseExpressionString(exprStr: string, allVariables: Variable[]): Expression {
  const elements: ExpressionElement[] = [];

  const splitTokens = (s: string): string[] => {
    const toks: string[] = [];
    let current = "";
    let depth = 0;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === " " && depth === 0) {
        if (current !== "") {
          toks.push(current);
          current = "";
        }
        continue;
      }
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      current += ch;
    }
    if (current.trim() !== "") toks.push(current);
    return toks;
  };

  const tokens = splitTokens(exprStr.trim());
  const functionRegex = /^(integer|string|float|boolean)\((.*)\)$/;

  tokens.forEach((tok) => {
    // Function call
    const funcMatch = tok.match(functionRegex);
    if (funcMatch) {
      const funcName = funcMatch[1];
      const inner = funcMatch[2];
      const nestedExpr = parseExpressionString(inner, allVariables); // recursion
      elements.push(
        new ExpressionElement(crypto.randomUUID(), "function", funcName, nestedExpr)
      );
      return;
    }

    // Operator token
    if (operators.includes(tok as any)) {
      elements.push(new ExpressionElement(crypto.randomUUID(), "operator", tok));
      return;
    }

    // Variable or literal
    const variable = allVariables.find((v) => v.name === tok);
    if (variable) {
      elements.push(
        new ExpressionElement(
          crypto.randomUUID(),
          "variable",
          variable.name,
          variable
        )
      );
    } else {
      elements.push(new ExpressionElement(crypto.randomUUID(), "literal", tok));
    }
  });

  return new Expression(undefined, elements);
} 