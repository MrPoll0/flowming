import { ValuedVariable } from '../../../models/ValuedVariable';
import { VariableType } from '../../../models/Variable';

export type ExpressionElementType = 'variable' | 'operator' | 'literal';

export interface ExpressionElement {
  id: string;
  type: ExpressionElementType;
  value: string; // The display value
  variableId?: string; // For variables, store the ID for resilience
}

export interface NodeProcessor {
    process: () => void; // TODO: change this (?)
}

export interface BaseNode {
    label?: string;
    width?: number;
    height?: number;
    isHovered?: boolean;
    isSelected?: boolean;
    isHighlighted?: boolean;
    currentValuedVariables?: ValuedVariable<VariableType>[];
    processor?: NodeProcessor;
    [key: string]: any; // TODO: remove this?
}