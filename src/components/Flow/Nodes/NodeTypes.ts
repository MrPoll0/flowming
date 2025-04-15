import { ValuedVariable } from '../../../models/ValuedVariable';
import { VariableType } from '../../../models/Variable';

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