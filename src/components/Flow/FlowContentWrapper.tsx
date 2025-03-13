import React from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import FlowContent from './FlowContent';

const FlowContentWrapper: React.FC = () => {
  return (
    <ReactFlowProvider>
      <FlowContent />
    </ReactFlowProvider>
  );
};

export default FlowContentWrapper; 