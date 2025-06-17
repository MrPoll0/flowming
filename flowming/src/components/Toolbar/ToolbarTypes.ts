import React from 'react';

// Base Block interface with common properties
export interface BlockBase {
  id: string;
  type: string;
  label: string;
  icon?: React.ReactElement;
  description?: string;
}

// Specific block types
export interface NodeBlock extends BlockBase {
  type: 'input' | 'output' | 'process' | 'control' | 'default';
  nodeType: string;
  defaultData?: Record<string, any>;
}

// Union type for all block types
export type Block = NodeBlock;