import React, { createContext, useContext, ReactNode } from 'react';
import { useFlowExecutor, IExecutor } from '../hooks/useFlowExecutor';


const FlowExecutorContext = createContext<IExecutor | null>(null);

export const useFlowExecutorContext = () => {
  const context = useContext(FlowExecutorContext);
  if (!context) {
    throw new Error(
      "useFlowExecutorContext must be used within a FlowExecutorProvider"
    );
  }
  return context;
};

export const FlowExecutorProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const executor = useFlowExecutor();

  return (
    <FlowExecutorContext.Provider value={executor}>
      {children}
    </FlowExecutorContext.Provider>
  );
};
