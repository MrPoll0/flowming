// Base Block interface with common properties
export interface BlockBase {
  id: string;
  type: string;
  label: string;
  icon?: string;
  description?: string;
}

// Specific block types
export interface NodeBlock extends BlockBase {
  type: 'node';
  nodeType: string;
  defaultData?: Record<string, any>;
}

// Union type for all block types
export type Block = NodeBlock;