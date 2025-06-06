import React, { createContext, useContext, ReactNode } from 'react';
import { useFlowExecutor, IExecutorState, IExecutorActions } from '../hooks/useFlowExecutor';

const FlowExecutorStateContext = createContext<IExecutorState | null>(null);
const FlowExecutorActionsContext = createContext<IExecutorActions | null>(null);

export const useFlowExecutorState = () => {
  const context = useContext(FlowExecutorStateContext);
  if (!context) {
    throw new Error(
      "useFlowExecutorState must be used within a FlowExecutorProvider"
    );
  }
  return context;
};

export const useFlowExecutorActions = () => {
  const context = useContext(FlowExecutorActionsContext);
  if (!context) {
    throw new Error(
      "useFlowExecutorActions must be used within a FlowExecutorProvider"
    );
  }
  return context;
};

export const FlowExecutorProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { state, actions } = useFlowExecutor();

  return (
    <FlowExecutorStateContext.Provider value={state}>
      <FlowExecutorActionsContext.Provider value={actions}>
        {children}
      </FlowExecutorActionsContext.Provider>
    </FlowExecutorStateContext.Provider>
  );
};
