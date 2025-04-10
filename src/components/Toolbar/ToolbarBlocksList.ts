import { Block, NodeBlock } from './ToolbarTypes';

// Node blocks
const startNodeBlock: NodeBlock = {
  id: 'start-node',
  type: 'node',
  label: 'Start',
  icon: '◻️',
  nodeType: 'Start',
  description: 'Start node',
  defaultData: {
    width: 100,
    height: 40,
  }
};

const endNodeBlock: NodeBlock = {
  id: 'end-node',
  type: 'node',
  label: 'End',
  icon: '◼️',
  nodeType: 'End',
  description: 'End node',
  defaultData: {
    width: 100,
    height: 40,
  }
};

const declareVariableNodeBlock: NodeBlock = {
  id: 'declare-variable-node',
  type: 'node',
  label: 'Declare variable',
  icon: '📝',
  nodeType: 'DeclareVariable',
  description: 'Declare a new variable',
  defaultData: {
    width: 250,
    height: 80,
  }
};

const assignVariableNodeBlock: NodeBlock = {
  id: 'assign-variable-node',
  type: 'node',
  label: 'Assign variable',
  icon: '✏️',
  nodeType: 'AssignVariable',
  description: 'Assign a value to a variable',
  defaultData: {
    width: 250,
    height: 80,
  }
};

// Export all blocks
export const toolbarBlocksList: Block[] = [
  startNodeBlock,
  endNodeBlock,
  declareVariableNodeBlock,
  assignVariableNodeBlock
];

export default toolbarBlocksList;