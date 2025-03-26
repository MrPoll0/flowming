import { Block, NodeBlock } from './ToolbarTypes';

// Node blocks
const startNodeBlock: NodeBlock = {
  id: 'start-node',
  type: 'node',
  label: 'Start',
  icon: '◻️',
  nodeType: 'Start',
  description: 'Start node',
};

const endNodeBlock: NodeBlock = {
  id: 'end-node',
  type: 'node',
  label: 'End',
  icon: '◼️',
  nodeType: 'End',
  description: 'End node',
};

const declareVariableNodeBlock: NodeBlock = {
  id: 'declare-variable-node',
  type: 'node',
  label: 'Declare variable',
  icon: '📝',
  nodeType: 'DeclareVariable',
  description: 'Declare a new variable',
};

// Export all blocks
export const toolbarBlocksList: Block[] = [
  startNodeBlock,
  endNodeBlock,
  declareVariableNodeBlock
];

export default toolbarBlocksList; 