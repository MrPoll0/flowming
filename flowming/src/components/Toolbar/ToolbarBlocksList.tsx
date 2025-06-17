import { Block, NodeBlock } from './ToolbarTypes';

// Flowchart shape components
const StartShape = () => (
  <svg width="32" height="20" viewBox="0 0 32 20" className="text-current">
    <rect x="2" y="2" width="28" height="16" rx="8" ry="8" 
          fill="transparent" stroke="black" strokeWidth="1.5"/>
  </svg>
);

const EndShape = () => (
  <svg width="32" height="20" viewBox="0 0 32 20" className="text-current">
    <rect x="2" y="2" width="28" height="16" rx="8" ry="8" 
          fill="transparent" stroke="black" strokeWidth="1.5"/>
  </svg>
);

const ProcessShape = () => (
  <svg width="32" height="20" viewBox="0 0 32 20" className="text-current">
    <rect x="2" y="2" width="28" height="16" 
          fill="transparent" stroke="black" strokeWidth="1.5"/>
  </svg>
);

const ConditionalShape = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" className="text-current">
    <polygon points="16,2 30,16 16,30 2,16" 
             fill="transparent" stroke="black" strokeWidth="1.5"/>
  </svg>
);

const InputOutputShape = () => (
  <svg width="32" height="20" viewBox="0 0 32 20" className="text-current">
    <polygon points="8,2 30,2 24,18 2,18" 
             fill="transparent" stroke="black" strokeWidth="1.5"/>
  </svg>
);

// Node blocks
const startNodeBlock: NodeBlock = {
  id: 'start-node',
  type: 'control',
  label: 'Start',
  icon: <StartShape />,
  nodeType: 'Start',
  description: 'Start node',
  defaultData: {
    width: 100,
    height: 40,
  }
};

const endNodeBlock: NodeBlock = {
  id: 'end-node',
  type: 'control',
  label: 'End',
  icon: <EndShape />,
  nodeType: 'End',
  description: 'End node',
  defaultData: {
    width: 100,
    height: 40,
  }
};

const declareVariableNodeBlock: NodeBlock = {
  id: 'declare-variable-node',
  type: 'process',
  label: 'Declare variable',
  icon: <ProcessShape />,
  nodeType: 'DeclareVariable',
  description: 'Declare a new variable',
  defaultData: {
    width: 250,
    height: 80,
  }
};

const assignVariableNodeBlock: NodeBlock = {
  id: 'assign-variable-node',
  type: 'process',
  label: 'Assign variable',
  icon: <ProcessShape />,
  nodeType: 'AssignVariable',
  description: 'Assign a value to a variable',
  defaultData: {
    width: 250,
    height: 80,
  }
};

const conditionalNodeBlock: NodeBlock = {
  id: 'conditional-node',
  type: 'control',
  label: 'Conditional',
  icon: <ConditionalShape />,
  nodeType: 'Conditional',
  description: 'Conditional node',
  defaultData: {
    width: 100,
    height: 100,
  }
};

const inputNodeBlock: NodeBlock = {
  id: 'input-node',
  type: 'input',
  label: 'Input',
  icon: <InputOutputShape />,
  nodeType: 'Input',
  description: 'Input node',
  defaultData: {
    width: 175,
    height: 50,
  }
};

const outputNodeBlock: NodeBlock = {
  id: 'output-node',
  type: 'output',
  label: 'Output',
  icon: <InputOutputShape />,
  nodeType: 'Output',
  description: 'Output node',
  defaultData: {
    width: 175,
    height: 50,
  }
};

// Export all blocks
export const toolbarBlocksList: Block[] = [
  startNodeBlock,
  endNodeBlock,
  declareVariableNodeBlock,
  assignVariableNodeBlock,
  conditionalNodeBlock,
  inputNodeBlock,
  outputNodeBlock
];

export default toolbarBlocksList; 