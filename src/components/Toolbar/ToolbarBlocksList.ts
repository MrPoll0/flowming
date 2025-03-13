import { Block, NodeBlock } from './ToolbarTypes';

// Node blocks
const basicNodeBlock: NodeBlock = {
  id: 'basic-node',
  type: 'node',
  label: 'Basic Node',
  icon: '◻️',
  nodeType: 'default',
  description: 'A basic node with default styling',
};

// Export all blocks
export const toolbarBlocksList: Block[] = [
  basicNodeBlock
];

export default toolbarBlocksList; 