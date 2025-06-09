import { ValuedVariable } from '../../../models/ValuedVariable';
import { VariableType } from '../../../models/Variable';

export interface NodeProcessor {
    process: () => ValuedVariable<VariableType>[] | { valuedVariables: ValuedVariable<VariableType>[], result: boolean } | Promise<ValuedVariable<VariableType>[]> | Promise<{ valuedVariables: ValuedVariable<VariableType>[], result: boolean }>;
}

export interface BaseNode {
    label?: string;
    width?: number;
    height?: number;
    isHovered?: boolean;
    isSelected?: boolean;
    isHighlighted?: boolean;
    isCodeHighlighted?: boolean;
    hasBreakpoint?: boolean;
    isBreakpointTriggered?: boolean;
    currentValuedVariables?: ValuedVariable<VariableType>[];
    processor?: NodeProcessor;
    [key: string]: any; // TODO: remove this?
}