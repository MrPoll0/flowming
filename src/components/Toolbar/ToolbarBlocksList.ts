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

// Export all blocks
export const toolbarBlocksList: Block[] = [
  startNodeBlock,
  endNodeBlock
];

export default toolbarBlocksList; 