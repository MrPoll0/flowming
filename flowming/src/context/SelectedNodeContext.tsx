import React, { createContext, useState, ReactNode } from 'react';
import { FlowNode } from '../components/Flow/FlowTypes';

// Create a context for the selected node
interface SelectedNodeContextType {
  selectedNode: FlowNode | null;
  setSelectedNode: (node: FlowNode | null) => void;
}

export const SelectedNodeContext = createContext<SelectedNodeContextType>({
  selectedNode: null,
  setSelectedNode: () => {},
});

interface SelectedNodeProviderProps {
  children: ReactNode;
}

export const SelectedNodeProvider: React.FC<SelectedNodeProviderProps> = ({ children }) => {
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);

  return (
    <SelectedNodeContext.Provider value={{ selectedNode, setSelectedNode }}>
      {children}
    </SelectedNodeContext.Provider>
  );
}; 