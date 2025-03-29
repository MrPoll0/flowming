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

const assignVariableNodeBlock: NodeBlock = {
  id: 'assign-variable-node',
  type: 'node',
  label: 'Assign variable',
  icon: '✏️',
  nodeType: 'AssignVariable',
  description: 'Assign a value to a variable',
};

// Export all blocks
export const toolbarBlocksList: Block[] = [
  startNodeBlock,
  endNodeBlock,
  declareVariableNodeBlock,
  assignVariableNodeBlock
];

export default toolbarBlocksList;