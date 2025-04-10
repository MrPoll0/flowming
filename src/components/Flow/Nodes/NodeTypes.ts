export type ExpressionElementType = 'variable' | 'operator' | 'literal';

export interface ExpressionElement {
  id: string;
  type: ExpressionElementType;
  value: string; // The display value
  variableId?: string; // For variables, store the ID for resilience
}

export interface NodeProcessor {
    process: () => void;
}

export interface BaseNode {
    label?: string;
    width?: number;
    height?: number;
    isHovered?: boolean;
    isSelected?: boolean;
    isHighlighted?: boolean;
    processor?: NodeProcessor;
    [key: string]: any; // TODO: remove this?
}